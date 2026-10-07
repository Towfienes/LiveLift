import type { Session } from "@/contracts";
import type { Review } from "@/lib/domain";
import { parseSnapshot } from "./parse";
import type { AttributionCoverage, LiveIntelligenceResult, MetricKey } from "./types";
import { MINUTE_MS, isInside, overlaps, recordedWindows, type RecordedWindow } from "./windows";

/**
 * FIXTURE provider evidence: deterministic demo data for SIMULATED rehearsals and for tests.
 *
 * Three guarantees:
 *   1. It is generated only from the show's own recorded times, with no randomness: the same show always yields the
 *      same evidence, so a browser state is reproducible.
 *   2. It is emitted as the raw JSON a server would send and read back through the same `parseSnapshot` real data
 *      goes through, so the parser's missing-vs-zero rules apply to it too.
 *   3. `fixtureResultFor` returns null for a REAL show. Fixture numbers can never be shown for REAL.
 *
 * The attribution step here only exists to make the fixture self-consistent. Real attribution belongs to the
 * provider-core lane; the UI shows whatever the server attributed.
 */

export const FIXTURE_SCENARIOS = [
  { id: "rich", label: "Rich post-LIVE evidence", blurb: "Every metric, a few real holes, boundary minutes, product rows." },
  { id: "ambiguous", label: "Ambiguous minute boundary", blurb: "Provider minutes shifted so each segment edge overlaps two segments." },
  { id: "repeated_product", label: "Repeated product mapping", blurb: "One LiveLift product listed twice by the provider, plus an unmapped listing." },
  { id: "zero_clicks", label: "Zero clicks", blurb: "Clicks recorded as 0 every minute. A real zero." },
  { id: "missing_clicks", label: "Missing clicks", blurb: "Clicks not recorded at all. Not zero." },
  { id: "zero_gmv", label: "Zero GMV", blurb: "GMV and orders recorded as 0." },
  { id: "missing_gmv", label: "Missing GMV", blurb: "Orders recorded, GMV not recorded." },
  { id: "unsupported_comments", label: "Unsupported raw comments", blurb: "Comment counts not offered; raw chat text never exists." },
  { id: "not_configured", label: "No provider configured", blurb: "The server has no provider evidence at all." },
  { id: "access_not_granted", label: "Access not granted", blurb: "A provider exists; the seller has not granted access." },
  { id: "auth_expired", label: "Authorization expired", blurb: "Access was granted and has since expired or been revoked." },
  { id: "rate_limited", label: "Rate limited", blurb: "The provider is limiting requests." },
  { id: "unavailable", label: "Provider unavailable", blurb: "The provider could not be reached." },
] as const;

export type FixtureScenarioId = (typeof FIXTURE_SCENARIOS)[number]["id"];

export const DEFAULT_FIXTURE_SCENARIO: FixtureScenarioId = "rich";

export const isFixtureScenario = (v: string | null | undefined): v is FixtureScenarioId => FIXTURE_SCENARIOS.some((s) => s.id === v);

const CURRENCY = "VND";
const FIXTURE_PROVIDER_SESSION = "FIXTURE-LIVE-0001";

/** A fixed pseudo-random value in [0, 1) for (minute index, stream). Pure arithmetic, no state. */
const rnd = (i: number, k: number): number => ((((i + 1) * 2654435761 + k * 40503) >>> 0) % 997) / 997;

type Row = Record<MetricKey, number | null>;

interface Built {
  g0: number;
  rows: Array<{ startMs: number; endMs: number } & Row>;
}

function buildMinutes(review: Review, windows: RecordedWindow[], scenario: FixtureScenarioId): Built {
  const offset = scenario === "ambiguous" ? 30_000 : 0;
  const g0 = Math.floor((review.summary.startedAtMs - offset) / MINUTE_MS) * MINUTE_MS + offset;
  const count = Math.min(240, Math.max(1, Math.ceil((review.summary.endedAtMs - g0) / MINUTE_MS)));
  const holes = scenario === "rich" || scenario === "ambiguous" || scenario === "repeated_product";
  const rows: Built["rows"] = [];
  for (let i = 0; i < count; i += 1) {
    const startMs = g0 + i * MINUTE_MS;
    const mid = startMs + MINUTE_MS / 2;
    const seg = windows.find((w) => mid >= w.startMs && mid < w.endMs);
    const boost = seg ? (seg.productId ? 1 : 0.2) : 0;
    const viewers = Math.round(150 + 60 * Math.sin(i / 7) + 25 * rnd(i, 1) + boost * 40);
    const impressions = Math.round(viewers * 1.6 + 40 * rnd(i, 2));
    const clicks = Math.round(impressions * (0.03 + 0.05 * boost) + 3 * rnd(i, 3));
    const orders = Math.round(clicks * (0.12 + 0.1 * rnd(i, 4)));
    const row: Row = {
      viewers,
      impressions,
      clicks,
      orders,
      gmv: orders * (240_000 + Math.round(120_000 * rnd(i, 5))),
      comments: Math.round(10 + 14 * rnd(i, 6) + 8 * boost),
      likes: Math.round(viewers * 0.35 * (0.5 + rnd(i, 7))),
      shares: Math.round(2 + 5 * rnd(i, 8)),
    };
    switch (scenario) {
      case "zero_clicks":
        row.clicks = 0;
        row.orders = 0;
        row.gmv = 0;
        break;
      case "missing_clicks":
        row.clicks = null;
        break;
      case "zero_gmv":
        row.orders = 0;
        row.gmv = 0;
        break;
      case "missing_gmv":
        row.gmv = null;
        break;
      case "unsupported_comments":
        row.comments = null;
        break;
      default:
        break;
    }
    if (holes && count > 6) {
      if (i === 2) row.clicks = null;
      if (i === 4) row.viewers = null;
    }
    rows.push({ startMs, endMs: startMs + MINUTE_MS, ...row });
  }
  return { g0, rows };
}

const ADDITIVE: MetricKey[] = ["impressions", "clicks", "orders", "gmv", "comments"];

function attribute(windows: RecordedWindow[], built: Built, scenario: FixtureScenarioId, fetchedAtMs: number): unknown[] {
  return windows.map((w) => {
    const inside = built.rows.filter((b) => isInside(b, w));
    const straddling = built.rows.filter((b) => overlaps(b, w) && !isInside(b, w));
    const ambiguous = straddling.flatMap((b) => {
      const other = windows.find((o) => o.segmentId !== w.segmentId && overlaps(b, o));
      return other ? [{ startMs: b.startMs, endMs: b.endMs, otherSegmentId: other.segmentId }] : [];
    });
    const edge = straddling.length - ambiguous.length;
    const limitations: string[] = [];
    if (ambiguous.length > 0) limitations.push(`${ambiguous.length} boundary minute${ambiguous.length === 1 ? "" : "s"} overlap another segment and were not assigned to either.`);
    if (edge > 0) limitations.push(`${edge} provider minute${edge === 1 ? "" : "s"} reach past this segment's recorded window and were not attributed.`);

    let holes = 0;
    const metrics: unknown[] = [];
    const push = (key: MetricKey, unit: string, value: number | null, availability: string, note: string | null): void => {
      metrics.push({ key, unit, value, availability, source: "performance_per_minutes", evidenceTier: "provider_observed", observedAt: fetchedAtMs, note });
    };
    for (const key of ["viewers", ...ADDITIVE] as MetricKey[]) {
      if (scenario === "unsupported_comments" && key === "comments") {
        push(key, "count", null, "unsupported", "Not offered for this show.");
        continue;
      }
      const recorded = inside.map((b) => b[key]).filter((v): v is number => v !== null);
      if (inside.length === 0 || recorded.length === 0) {
        push(key, key === "gmv" ? CURRENCY : "count", null, "missing", null);
        continue;
      }
      if (recorded.length < inside.length) holes += inside.length - recorded.length;
      const partial = recorded.length < inside.length ? `${recorded.length} of ${inside.length} full minutes recorded.` : null;
      if (key === "viewers") push(key, "peak per minute", Math.max(...recorded), "available", partial ?? "Highest single minute in the window.");
      else push(key, key === "gmv" ? CURRENCY : "count", recorded.reduce((a, b) => a + b, 0), "available", partial);
    }
    if (holes > 0) limitations.push("Some full minutes had no recorded value for one or more metrics; those totals count recorded minutes only.");

    let coverage: AttributionCoverage;
    if (inside.length === 0 && ambiguous.length === 0) coverage = "none";
    else if (ambiguous.length > 0) coverage = "ambiguous";
    else if (holes > 0 || edge > 0 || inside.length === 0) coverage = "partial";
    else coverage = "complete";
    return {
      segmentId: w.segmentId,
      title: w.title,
      plannedDurationMs: w.plannedSec === null ? null : w.plannedSec * 1000,
      actualStartMs: w.startMs,
      actualEndMs: w.endMs,
      coverage,
      metrics,
      ambiguousBuckets: ambiguous,
      limitations,
    };
  });
}

function productRows(session: Pick<Session, "products">, windows: RecordedWindow[], built: Built, scenario: FixtureScenarioId): unknown[] {
  const used = [...new Set(windows.map((w) => w.productId).filter((id): id is string => id !== null))];
  const rows: Array<Record<string, unknown>> = [];
  for (const id of used) {
    const product = session.products.find((p) => p.id === id);
    if (!product) continue;
    const mine = windows.filter((w) => w.productId === id);
    const sum = (key: MetricKey): number | null => {
      const values = mine.flatMap((w) => built.rows.filter((b) => isInside(b, w)).map((b) => b[key]));
      const recorded = values.filter((v): v is number => v !== null);
      return recorded.length === 0 ? null : recorded.reduce((a, b) => a + b, 0);
    };
    const clicks = sum("clicks");
    const orders = sum("orders");
    rows.push({
      productId: product.id,
      productLabel: product.name,
      impressions: sum("impressions"),
      clicks,
      orders,
      gmv: sum("gmv"),
      ctor: clicks !== null && clicks > 0 && orders !== null ? Math.min(1, orders / clicks) : null,
      currency: CURRENCY,
      availability: "available",
      evidenceTier: "provider_observed",
      limitations: [],
    });
  }
  if (scenario === "repeated_product" && rows.length > 0) {
    const first = rows[0];
    rows.splice(1, 0, {
      ...first,
      skuId: "SKU-B",
      impressions: typeof first.impressions === "number" ? Math.round(first.impressions / 3) : null,
      clicks: typeof first.clicks === "number" ? Math.round(first.clicks / 3) : null,
      orders: typeof first.orders === "number" ? Math.round(first.orders / 3) : null,
      gmv: typeof first.gmv === "number" ? Math.round(first.gmv / 3) : null,
      ctor: null,
      limitations: ["The provider listed this product twice (two SKUs). LiveLift shows them separately and does not merge them."],
    });
    rows[0] = { ...first, skuId: "SKU-A" };
  }
  if (scenario === "rich" || scenario === "repeated_product") {
    rows.push({
      productId: "tt-889102",
      productLabel: "Unmapped provider listing",
      impressions: 420,
      clicks: 31,
      orders: 2,
      gmv: 880_000,
      ctor: 2 / 31,
      currency: CURRENCY,
      availability: "available",
      evidenceTier: "provider_observed",
      limitations: ["This listing does not match any product in this show's pack."],
    });
  }
  // Scenario transforms apply to the product rows too, so the table never contradicts the minutes.
  return rows.map((r) => {
    if (scenario === "zero_clicks") return { ...r, clicks: 0, orders: 0, gmv: 0, ctor: null };
    if (scenario === "missing_clicks") return { ...r, clicks: null, ctor: null };
    if (scenario === "zero_gmv") return { ...r, orders: 0, gmv: 0, ctor: r.ctor === null ? null : 0 };
    if (scenario === "missing_gmv") return { ...r, gmv: null };
    return r;
  });
}

export interface ScenarioOptions {
  /** "fixture" for a SIMULATED demo (default). A test double standing in for the real server uses another name. */
  provider?: string;
  fetchedAtMs?: number;
}

/** The raw JSON a server would send for a snapshot scenario. Not valid for the six state-only scenarios. */
export function buildScenarioRaw(session: Pick<Session, "id" | "environment" | "products">, review: Review, scenario: FixtureScenarioId, opts: ScenarioOptions = {}): Record<string, unknown> {
  const windows = recordedWindows(review);
  const built = buildMinutes(review, windows, scenario);
  const fetchedAtMs = opts.fetchedAtMs ?? review.summary.endedAtMs + 2 * 3_600_000;
  const limits: Array<Record<string, unknown>> = [
    { text: "Raw LIVE chat text is not available from the official API. Comment figures, where offered, are counts only." },
    { text: "Figures can still change while TikTok finalises them, which can take up to 48 hours after the LIVE." },
  ];
  if (scenario === "unsupported_comments") limits.push({ metricKey: "comments", availability: "unsupported", text: "Comment counts are not offered for this show by the provider." });
  return {
    sessionId: session.id,
    mode: session.environment,
    perspective: "later_evidence",
    provider: opts.provider ?? "fixture",
    // A test double standing in for a server must not borrow the fixture's identity.
    providerSessionId: (opts.provider ?? "fixture") === "fixture" ? FIXTURE_PROVIDER_SESSION : "TEST-DOUBLE-LIVE-0001",
    fetchedAt: fetchedAtMs,
    providerWindow: { startMs: built.g0, endMs: built.g0 + built.rows.length * MINUTE_MS },
    currency: CURRENCY,
    minuteBuckets: built.rows,
    segmentAttributions: attribute(windows, built, scenario, fetchedAtMs),
    productPerformance: productRows(session, windows, built, scenario),
    evidenceLimits: limits,
    reconciliationVersion: (opts.provider ?? "fixture") === "fixture" ? "fixture-1" : "test-double-1",
  };
}

/**
 * The result a SIMULATED rehearsal shows for a scenario. REAL shows get null, always: fixture evidence is never
 * available for a REAL show, whatever the caller asks.
 */
export function fixtureResultFor(session: Pick<Session, "id" | "environment" | "products">, review: Review, scenario: FixtureScenarioId): LiveIntelligenceResult | null {
  if (session.environment !== "SIMULATED") return null;
  switch (scenario) {
    case "not_configured":
      return { kind: "not_configured" };
    case "access_not_granted":
      return { kind: "access_not_granted" };
    case "auth_expired":
      return { kind: "auth_expired" };
    case "rate_limited":
      return { kind: "rate_limited", retryAfterSec: 90 };
    case "unavailable":
      return { kind: "unavailable", reason: "server", message: "The provider could not be reached." };
    default: {
      const parsed = parseSnapshot(buildScenarioRaw(session, review, scenario));
      return parsed.ok ? { kind: "available", snapshot: parsed.snapshot, origin: "fixture" } : { kind: "unavailable", reason: "malformed", message: "The fixture could not be read." };
    }
  }
}
