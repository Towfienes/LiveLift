import {
  METRIC_KEYS,
  type AmbiguousBucket,
  type Availability,
  type AttributionCoverage,
  type EvidenceLimit,
  type EvidenceOrigin,
  type LiveIntelligenceSnapshot,
  type MalformedReason,
  type MetricKey,
  type MinuteEvidenceBucket,
  type ProductPerformance,
  type ProviderMetric,
  type SegmentAttribution,
  type TimeWindow,
} from "./types";

/**
 * A tolerant but truthful reader for the server's later-evidence snapshot.
 *
 * Tolerant: timestamps may be epoch milliseconds or ISO strings, `fetchedAt`/`fetchedAtMs` both work, numbers may
 * arrive as numeric strings, optional fields may be absent.
 * Truthful: an absent number is `null` (missing), never 0; a metric that is not `available` can never carry a
 * value; an unrecognised `availability` or `coverage` word rejects the snapshot instead of guessing what it meant.
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** A finite, non-negative number, or null. Numeric strings are accepted because provider APIs send them. */
export function asCount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

function asTimeMs(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function pickTime(r: Record<string, unknown>, ...names: string[]): number | null {
  for (const n of names) {
    const t = asTimeMs(r[n]);
    if (t !== null) return t;
  }
  return null;
}

const AVAILABILITIES: readonly string[] = ["available", "missing", "unknown", "unsupported"];
const COVERAGES: readonly string[] = ["complete", "partial", "ambiguous", "none"];

const METRIC_ALIAS: Record<string, MetricKey> = {
  viewers: "viewers",
  impressions: "impressions",
  product_impressions: "impressions",
  clicks: "clicks",
  product_clicks: "clicks",
  produt_clicks: "clicks",
  orders: "orders",
  order_count: "orders",
  gmv: "gmv",
  comments: "comments",
  comment_count: "comments",
  likes: "likes",
  like_count: "likes",
  shares: "shares",
  share_count: "shares",
};

export function normalizeMetricKey(key: string): string {
  return METRIC_ALIAS[key.trim().toLowerCase()] ?? key;
}

function window_(v: unknown): TimeWindow | null {
  if (!isRecord(v)) return null;
  const startMs = pickTime(v, "startMs", "start");
  const endMs = pickTime(v, "endMs", "end");
  return startMs !== null && endMs !== null && endMs > startMs ? { startMs, endMs } : null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false };

function parseMetric(raw: unknown): Parsed<ProviderMetric> {
  if (!isRecord(raw)) return { ok: false };
  const key = str(raw.key);
  if (!key) return { ok: false };
  let availability: Availability;
  if (raw.availability === undefined || raw.availability === null) {
    availability = asCount(raw.value) !== null ? "available" : "unknown";
  } else if (typeof raw.availability === "string" && AVAILABILITIES.includes(raw.availability)) {
    availability = raw.availability as Availability;
  } else return { ok: false };
  let value = availability === "available" ? asCount(raw.value) : null;
  // "available" without a number is a hole, and a hole is "missing", never zero.
  if (availability === "available" && value === null) availability = "missing";
  if (availability !== "available") value = null;
  return {
    ok: true,
    value: {
      key: normalizeMetricKey(key),
      value,
      unit: str(raw.unit),
      availability,
      source: str(raw.source),
      evidenceTier: str(raw.evidenceTier),
      observedAtMs: pickTime(raw, "observedAt", "observedAtMs"),
      window: window_(raw.window),
      note: str(raw.note),
    },
  };
}

function parseBucket(raw: unknown): MinuteEvidenceBucket | null {
  if (!isRecord(raw)) return null;
  const startMs = pickTime(raw, "startMs", "start");
  const endMs = pickTime(raw, "endMs", "end");
  if (startMs === null || endMs === null || endMs <= startMs) return null;
  const bucket: MinuteEvidenceBucket = { startMs, endMs, viewers: null, impressions: null, clicks: null, orders: null, gmv: null, comments: null, likes: null, shares: null };
  for (const k of METRIC_KEYS) bucket[k] = asCount(raw[k]);
  return bucket;
}

function parseAmbiguous(raw: unknown): AmbiguousBucket | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return { startMs: raw, endMs: raw + 60_000, otherSegmentId: null };
  if (!isRecord(raw)) return null;
  const startMs = pickTime(raw, "startMs", "start");
  if (startMs === null) return null;
  const endMs = pickTime(raw, "endMs", "end") ?? startMs + 60_000;
  return { startMs, endMs, otherSegmentId: str(raw.otherSegmentId) ?? str(raw.segmentId) };
}

const stringList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);

function parseAttribution(raw: unknown): Parsed<SegmentAttribution> {
  if (!isRecord(raw)) return { ok: false };
  const segmentId = str(raw.segmentId);
  if (!segmentId || typeof raw.coverage !== "string" || !COVERAGES.includes(raw.coverage)) return { ok: false };
  const metrics: ProviderMetric[] = [];
  for (const m of Array.isArray(raw.metrics) ? raw.metrics : []) {
    const parsed = parseMetric(m);
    if (!parsed.ok) return { ok: false };
    metrics.push(parsed.value);
  }
  const plannedMs = typeof raw.plannedDurationMs === "number" && Number.isFinite(raw.plannedDurationMs) ? raw.plannedDurationMs : null;
  return {
    ok: true,
    value: {
      segmentId,
      title: str(raw.title),
      plannedDurationMs: plannedMs,
      actualStartMs: pickTime(raw, "actualStartMs", "actualStart"),
      actualEndMs: pickTime(raw, "actualEndMs", "actualEnd"),
      coverage: raw.coverage as AttributionCoverage,
      metrics,
      ambiguousBuckets: (Array.isArray(raw.ambiguousBuckets) ? raw.ambiguousBuckets : []).map(parseAmbiguous).filter((b): b is AmbiguousBucket => b !== null),
      limitations: stringList(raw.limitations),
    },
  };
}

function parseProduct(raw: unknown): Parsed<ProductPerformance> {
  if (!isRecord(raw)) return { ok: false };
  let availability: Availability = "unknown";
  if (raw.availability !== undefined && raw.availability !== null) {
    if (typeof raw.availability !== "string" || !AVAILABILITIES.includes(raw.availability)) return { ok: false };
    availability = raw.availability as Availability;
  } else if (["impressions", "clicks", "orders", "gmv"].some((k) => asCount(raw[k]) !== null)) availability = "available";
  const limitations = stringList(raw.limitations);
  let ctor = asCount(raw.ctor);
  if (ctor !== null && ctor > 1) {
    ctor = null;
    limitations.push("The provider sent a click-to-order rate above 100%, which LiveLift discarded.");
  }
  return {
    ok: true,
    value: {
      matchedProductId: str(raw.matchedProductId),
      productId: str(raw.productId),
      skuId: str(raw.skuId),
      productLabel: str(raw.productLabel),
      impressions: asCount(raw.impressions),
      clicks: asCount(raw.clicks),
      orders: asCount(raw.orders),
      gmv: asCount(raw.gmv),
      ctor,
      currency: str(raw.currency),
      availability,
      evidenceTier: str(raw.evidenceTier),
      limitations,
    },
  };
}

function parseLimit(raw: unknown): EvidenceLimit | null {
  if (typeof raw === "string") return str(raw) ? { text: raw, metricKey: null, availability: null } : null;
  if (!isRecord(raw)) return null;
  const text = str(raw.text) ?? str(raw.note) ?? str(raw.message);
  if (!text) return null;
  const key = str(raw.metricKey) ?? str(raw.key);
  const availability = typeof raw.availability === "string" && AVAILABILITIES.includes(raw.availability) ? (raw.availability as Availability) : null;
  return { text, metricKey: key ? normalizeMetricKey(key) : null, availability };
}

export type SnapshotParse = { ok: true; snapshot: LiveIntelligenceSnapshot; origin: EvidenceOrigin } | { ok: false; reason: MalformedReason };

export function parseSnapshot(raw: unknown): SnapshotParse {
  if (!isRecord(raw)) return { ok: false, reason: "malformed" };
  if (raw.perspective !== "later_evidence") return { ok: false, reason: "wrong_perspective" };
  const sessionId = str(raw.sessionId);
  const provider = str(raw.provider);
  const fetchedAtMs = pickTime(raw, "fetchedAt", "fetchedAtMs");
  if (!sessionId || !provider || fetchedAtMs === null) return { ok: false, reason: "malformed" };

  const seen = new Set<number>();
  const minuteBuckets: MinuteEvidenceBucket[] = [];
  for (const b of Array.isArray(raw.minuteBuckets) ? raw.minuteBuckets : []) {
    const parsed = parseBucket(b);
    if (!parsed) return { ok: false, reason: "malformed" };
    if (seen.has(parsed.startMs)) continue; // one provider minute is one bucket
    seen.add(parsed.startMs);
    minuteBuckets.push(parsed);
  }
  minuteBuckets.sort((a, b) => a.startMs - b.startMs);

  const segmentAttributions: SegmentAttribution[] = [];
  for (const a of Array.isArray(raw.segmentAttributions) ? raw.segmentAttributions : []) {
    const parsed = parseAttribution(a);
    if (!parsed.ok) return { ok: false, reason: "malformed" };
    segmentAttributions.push(parsed.value);
  }
  const productPerformance: ProductPerformance[] = [];
  for (const p of Array.isArray(raw.productPerformance) ? raw.productPerformance : []) {
    const parsed = parseProduct(p);
    if (!parsed.ok) return { ok: false, reason: "malformed" };
    productPerformance.push(parsed.value);
  }

  const origin: EvidenceOrigin =
    /fixture/i.test(provider) || raw.fixture === true || (typeof raw.origin === "string" && /fixture/i.test(raw.origin)) ? "fixture" : "provider";

  return {
    ok: true,
    origin,
    snapshot: {
      sessionId,
      mode: str(raw.mode) ?? "unspecified",
      perspective: "later_evidence",
      provider,
      providerSessionId: str(raw.providerSessionId),
      fetchedAtMs,
      providerWindow: window_(raw.providerWindow),
      currency: str(raw.currency),
      minuteBuckets,
      segmentAttributions,
      productPerformance,
      evidenceLimits: (Array.isArray(raw.evidenceLimits) ? raw.evidenceLimits : []).map(parseLimit).filter((l): l is EvidenceLimit => l !== null),
      reconciliationVersion: str(raw.reconciliationVersion) ?? "unspecified",
    },
  };
}
