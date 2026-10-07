import { describe, expect, it } from "vitest";
import type { Session } from "@/contracts";
import { applyCommand, buildReview, createScenarioSession, lastRecordedMs, runScript, type Review } from "@/lib/domain";
import {
  FIXTURE_SCENARIOS,
  INTELLIGENCE_ROUTES,
  QUICK_CUES,
  buildLedger,
  buildProductRows,
  buildReplay,
  buildScenarioRaw,
  createLiveIntelligenceClient,
  deriveObservations,
  fixtureResultFor,
  interpretSnapshotResponse,
  matchProduct,
  parseQuickCue,
  parseSnapshot,
  quickCueNoteText,
  recordedWindows,
  seriesStat,
  type FixtureScenarioId,
  type LiveIntelligenceSnapshot,
} from "@/lib/intelligence";

const ended = (): Session => runScript(createScenarioSession("buffered"));
const reviewOf = (s: Session): Review => {
  const r = buildReview(s);
  if (!r) throw new Error("scenario session did not end");
  return r;
};

const res = (status: number, body: unknown, headers: Record<string, string> = {}) => ({ ok: true as const, status, body, text: "", headers: new Headers(headers) });

const base = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  sessionId: "s1",
  mode: "REAL",
  perspective: "later_evidence",
  provider: "tiktok_shop",
  fetchedAt: 1_000_000,
  reconciliationVersion: "r1",
  minuteBuckets: [],
  segmentAttributions: [],
  productPerformance: [],
  evidenceLimits: [],
  ...over,
});

describe("missing != zero (parser)", () => {
  it("keeps a recorded 0 as 0 and an absent value as null, bucket by bucket", () => {
    const p = parseSnapshot(base({ minuteBuckets: [{ startMs: 0, endMs: 60_000, clicks: 0, orders: null, gmv: undefined, viewers: 12 }] }));
    if (!p.ok) throw new Error("should parse");
    const b = p.snapshot.minuteBuckets[0];
    expect(b.clicks).toBe(0);
    expect(b.orders).toBeNull();
    expect(b.gmv).toBeNull();
    expect(b.viewers).toBe(12);
    expect(b.comments).toBeNull();
  });

  it("never lets a metric that is not available carry a value, and turns an available-without-number into missing", () => {
    const p = parseSnapshot(
      base({
        segmentAttributions: [
          {
            segmentId: "a",
            coverage: "partial",
            metrics: [
              { key: "product_clicks", value: 7, availability: "missing" },
              { key: "orders", availability: "available" },
              { key: "comment_count", value: 0, availability: "available" },
              { key: "gmv", value: 5, availability: "unsupported" },
            ],
          },
        ],
      })
    );
    if (!p.ok) throw new Error("should parse");
    const m = Object.fromEntries(p.snapshot.segmentAttributions[0].metrics.map((x) => [x.key, x]));
    expect(m.clicks).toMatchObject({ value: null, availability: "missing" }); // alias normalised, value dropped
    expect(m.orders).toMatchObject({ value: null, availability: "missing" });
    expect(m.comments).toMatchObject({ value: 0, availability: "available" }); // a real zero survives
    expect(m.gmv).toMatchObject({ value: null, availability: "unsupported" });
  });

  it("rejects a snapshot that is not later evidence, or uses an availability word it does not know", () => {
    expect(parseSnapshot(base({ perspective: "live" }))).toEqual({ ok: false, reason: "wrong_perspective" });
    expect(parseSnapshot(base({ segmentAttributions: [{ segmentId: "a", coverage: "great", metrics: [] }] }))).toEqual({ ok: false, reason: "malformed" });
    expect(parseSnapshot(base({ segmentAttributions: [{ segmentId: "a", coverage: "none", metrics: [{ key: "gmv", availability: "maybe" }] }] }))).toEqual({ ok: false, reason: "malformed" });
  });

  it("accepts ISO times, numeric strings, and refuses negative counts as missing", () => {
    const p = parseSnapshot(base({ fetchedAt: "2026-10-07T10:00:00Z", minuteBuckets: [{ start: "2026-10-07T09:00:00Z", end: "2026-10-07T09:01:00Z", clicks: "5", orders: -3 }] }));
    if (!p.ok) throw new Error("should parse");
    expect(p.snapshot.fetchedAtMs).toBe(Date.parse("2026-10-07T10:00:00Z"));
    expect(p.snapshot.minuteBuckets[0].clicks).toBe(5);
    expect(p.snapshot.minuteBuckets[0].orders).toBeNull();
  });

  it("a sum of nothing is not zero", () => {
    const stat = seriesStat([{ startMs: 0, endMs: 1, viewers: null, impressions: null, clicks: null, orders: null, gmv: null, comments: null, likes: null, shares: null }], "clicks");
    expect(stat.sum).toBeNull();
    expect(stat.state).toBe("all_missing");
    const zero = seriesStat([{ startMs: 0, endMs: 1, viewers: null, impressions: null, clicks: 0, orders: null, gmv: null, comments: null, likes: null, shares: null }], "clicks");
    expect(zero.sum).toBe(0);
    expect(zero.state).toBe("all_zero");
  });
});

describe("client adapter states", () => {
  const id = "s1";
  it("names every way the evidence can be absent", () => {
    expect(interpretSnapshotResponse(res(200, { status: "not_configured" }), id)).toEqual({ kind: "not_configured" });
    expect(interpretSnapshotResponse(res(200, { status: "access_not_granted" }), id)).toEqual({ kind: "access_not_granted" });
    expect(interpretSnapshotResponse(res(200, { status: "auth_expired" }), id)).toEqual({ kind: "auth_expired" });
    expect(interpretSnapshotResponse(res(200, { status: "unsupported" }), id)).toEqual({ kind: "unsupported" });
    expect(interpretSnapshotResponse(res(200, { status: "rate_limited", retryAfterSec: 30 }), id)).toEqual({ kind: "rate_limited", retryAfterSec: 30 });
    expect(interpretSnapshotResponse(res(429, null, { "retry-after": "120" }), id)).toEqual({ kind: "rate_limited", retryAfterSec: 120 });
    expect(interpretSnapshotResponse(res(401, null), id)).toEqual({ kind: "signed_out" });
    expect(interpretSnapshotResponse(res(403, { error: { code: "forbidden" } }), id)).toEqual({ kind: "forbidden" });
    expect(interpretSnapshotResponse(res(501, null), id)).toEqual({ kind: "not_configured" });
    expect(interpretSnapshotResponse(res(404, undefined), id)).toEqual({ kind: "not_configured" }); // a server without the route
    expect(interpretSnapshotResponse(res(404, { error: { code: "not_found", message: "x" } }), id)).toMatchObject({ kind: "unavailable", reason: "not_found" });
    expect(interpretSnapshotResponse(res(503, { error: { code: "authority_unavailable" } }), id)).toMatchObject({ kind: "unavailable", reason: "server" });
    expect(interpretSnapshotResponse(res(200, { status: "pending" }), id)).toMatchObject({ kind: "unavailable", reason: "settling" });
    expect(interpretSnapshotResponse({ ok: false, kind: "timeout", message: "slow" }, id)).toEqual({ kind: "unavailable", reason: "timeout", message: "slow" });
  });

  it("accepts a real provider snapshot, in an envelope or bare", () => {
    for (const body of [{ status: "available", snapshot: base() }, base()]) {
      const r = interpretSnapshotResponse(res(200, body), id);
      expect(r).toMatchObject({ kind: "available", origin: "provider" });
    }
  });

  it("refuses fixture or SIMULATED evidence for a REAL show, and evidence for a different show", () => {
    expect(interpretSnapshotResponse(res(200, base({ provider: "fixture" })), id)).toMatchObject({ kind: "unavailable", reason: "rejected_fixture" });
    expect(interpretSnapshotResponse(res(200, base({ fixture: true })), id)).toMatchObject({ kind: "unavailable", reason: "rejected_fixture" });
    expect(interpretSnapshotResponse(res(200, base({ mode: "SIMULATED" })), id)).toMatchObject({ kind: "unavailable", reason: "rejected_fixture" });
    expect(interpretSnapshotResponse(res(200, base({ sessionId: "other" })), id)).toMatchObject({ kind: "unavailable", reason: "session_mismatch" });
    expect(interpretSnapshotResponse(res(200, base({ perspective: "live" })), id)).toMatchObject({ kind: "unavailable", reason: "wrong_perspective" });
  });

  it("sends the CSRF marker and workspace context, GET for reads and POST for a refresh, and parses capabilities", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      const body = String(url).endsWith("/capabilities") ? { capabilities: [{ key: "shop_analytics", state: "access_not_granted", note: "Seller has not granted access." }] } : base();
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const client = createLiveIntelligenceClient({ fetchImpl });
    const ctx = { workspaceId: "ws-1", generation: "g1" };
    expect((await client.getSnapshot(ctx, "s 1")).kind).toBe("unavailable"); // base() is for s1, the id was s 1: mismatch is caught
    expect(calls[0].url).toBe(INTELLIGENCE_ROUTES.snapshot("s 1"));
    expect(calls[0].url).toContain("s%201");
    expect(calls[0].init.method).toBe("GET");
    expect((calls[0].init.headers as Record<string, string>)["X-LiveLift-Request"]).toBe("1");
    expect((calls[0].init.headers as Record<string, string>)["X-LiveLift-Workspace"]).toBe("ws-1");
    expect((await client.requestRefresh(ctx, "s1")).kind).toBe("available");
    expect(calls[1].init.method).toBe("POST");
    expect(await client.getCapabilities(ctx)).toEqual({ kind: "ok", capabilities: [{ key: "shop_analytics", state: "access_not_granted", note: "Seller has not granted access.", checkedAtMs: null }] });
  });
});

describe("fixture provider evidence", () => {
  it("never exists for a REAL show, whatever the scenario", () => {
    const s = ended();
    const real = { id: s.id, environment: "REAL" as const, products: s.products };
    for (const sc of FIXTURE_SCENARIOS) expect(fixtureResultFor(real, reviewOf(s), sc.id)).toBeNull();
  });

  it("is deterministic and reads back through the same parser as real data", () => {
    const s = ended();
    const r = reviewOf(s);
    const a = fixtureResultFor(s, r, "rich");
    const b = fixtureResultFor(s, r, "rich");
    expect(a).toEqual(b);
    expect(a).toMatchObject({ kind: "available", origin: "fixture" });
    if (a?.kind !== "available") throw new Error("not available");
    expect(a.snapshot.provider).toBe("fixture");
    expect(a.snapshot.perspective).toBe("later_evidence");
    expect(a.snapshot.minuteBuckets.length).toBeGreaterThan(5);
    expect(a.snapshot.fetchedAtMs).toBeGreaterThan(r.summary.endedAtMs); // fetched afterwards, never during
  });

  const snap = (id: FixtureScenarioId): LiveIntelligenceSnapshot => {
    const s = ended();
    const r = fixtureResultFor(s, reviewOf(s), id);
    if (r?.kind !== "available") throw new Error(`${id} is not a snapshot scenario`);
    return r.snapshot;
  };
  const metric = (snapshot: LiveIntelligenceSnapshot, key: string) => snapshot.segmentAttributions.flatMap((a) => a.metrics.filter((m) => m.key === key));

  it("zero clicks is a recorded 0; missing clicks is not recorded; the two never look alike in the data", () => {
    const zero = snap("zero_clicks");
    expect(zero.minuteBuckets.every((b) => b.clicks === 0)).toBe(true);
    expect(metric(zero, "clicks").filter((m) => m.availability === "available").every((m) => m.value === 0)).toBe(true);
    expect(zero.productPerformance.every((p) => p.clicks === 0 && p.ctor === null)).toBe(true);
    const missing = snap("missing_clicks");
    expect(missing.minuteBuckets.every((b) => b.clicks === null)).toBe(true);
    expect(metric(missing, "clicks").every((m) => m.value === null && m.availability === "missing")).toBe(true);
    expect(missing.productPerformance.every((p) => p.clicks === null)).toBe(true);
  });

  it("zero GMV is a recorded 0 and missing GMV is not recorded (orders can still be recorded)", () => {
    const zero = snap("zero_gmv");
    expect(zero.minuteBuckets.every((b) => b.gmv === 0 && b.orders === 0)).toBe(true);
    const missing = snap("missing_gmv");
    expect(missing.minuteBuckets.every((b) => b.gmv === null)).toBe(true);
    expect(missing.minuteBuckets.some((b) => (b.orders ?? 0) > 0)).toBe(true);
    expect(missing.productPerformance.every((p) => p.gmv === null)).toBe(true);
  });

  it("comments can be unsupported, and raw chat text is always stated as unavailable", () => {
    const s = snap("unsupported_comments");
    expect(s.minuteBuckets.every((b) => b.comments === null)).toBe(true);
    expect(metric(s, "comments").every((m) => m.availability === "unsupported" && m.value === null)).toBe(true);
    expect(s.evidenceLimits.some((l) => l.metricKey === "comments" && l.availability === "unsupported")).toBe(true);
    expect(snap("rich").evidenceLimits.some((l) => /raw live chat text/i.test(l.text))).toBe(true);
  });

  it("a minute that overlaps two segments is listed as ambiguous and is NOT counted for either", () => {
    const s = ended();
    const r = reviewOf(s);
    const rawSnapshot = buildScenarioRaw(s, r, "ambiguous");
    const parsed = parseSnapshot(rawSnapshot);
    if (!parsed.ok) throw new Error("should parse");
    const snapshot = parsed.snapshot;
    const withAmbiguity = snapshot.segmentAttributions.filter((a) => a.ambiguousBuckets.length > 0);
    expect(withAmbiguity.length).toBeGreaterThan(0);
    for (const a of withAmbiguity) {
      expect(a.coverage).toBe("ambiguous");
      const window = recordedWindows(r).find((w) => w.segmentId === a.segmentId)!;
      const inside = snapshot.minuteBuckets.filter((b) => b.startMs >= window.startMs && b.endMs <= window.endMs);
      const expected = inside.reduce((n, b) => n + (b.orders ?? 0), 0);
      const reported = a.metrics.find((m) => m.key === "orders")!;
      expect(reported.value).toBe(expected); // only full minutes: the boundary minute is not added
      for (const amb of a.ambiguousBuckets) {
        expect(inside.some((b) => b.startMs === amb.startMs)).toBe(false);
        expect(amb.otherSegmentId).not.toBeNull();
      }
    }
  });

  it("covers every scenario the brief asks for, and the five state-only ones are not snapshots", () => {
    const s = ended();
    const r = reviewOf(s);
    const kinds = Object.fromEntries(FIXTURE_SCENARIOS.map((sc) => [sc.id, fixtureResultFor(s, r, sc.id)?.kind]));
    expect(kinds).toMatchObject({ not_configured: "not_configured", access_not_granted: "access_not_granted", auth_expired: "auth_expired", rate_limited: "rate_limited", unavailable: "unavailable" });
    for (const id of ["rich", "ambiguous", "repeated_product", "zero_clicks", "missing_clicks", "zero_gmv", "missing_gmv", "unsupported_comments"] as const) expect(kinds[id]).toBe("available");
  });
});

describe("product matching never invents a match", () => {
  const product = (id: string, code: string, name: string) => ({ id, code, name, price: null, currency: "USD", priority: "normal" as const, status: "enabled" as const, talkingPoints: [], constraints: [], initials: "PR" });
  const row = (over: Record<string, unknown>) => ({ matchedProductId: null, productId: null, skuId: null, productLabel: null, impressions: null, clicks: null, orders: null, gmv: null, ctor: null, currency: null, availability: "available" as const, evidenceTier: null, limitations: [], ...over });

  it("matches only on an exact identifier, or an exact name when there is no identifier", () => {
    const ps = [product("p1", "A01", "Zip Hoodie"), product("p2", "A02", "Tee")];
    expect(matchProduct(row({ productId: "p1" }), ps)).toMatchObject({ kind: "matched", basis: "id" });
    expect(matchProduct(row({ productId: "a02" }), ps)).toMatchObject({ kind: "matched", basis: "code" });
    expect(matchProduct(row({ productLabel: " zip hoodie " }), ps)).toMatchObject({ kind: "matched", basis: "name" });
    expect(matchProduct(row({ productId: "tt-1", productLabel: "Zip Hoodie" }), ps)).toEqual({ kind: "unmatched" }); // a foreign id is never rescued by a similar name
    expect(matchProduct(row({ productLabel: "Zip Hoodies" }), ps)).toEqual({ kind: "unmatched" });
  });

  it("says ambiguous when more than one product qualifies, and prefers the server's own mapping", () => {
    const ps = [product("p1", "A01", "Same"), product("p2", "A02", "Same")];
    expect(matchProduct(row({ productLabel: "same" }), ps)).toMatchObject({ kind: "ambiguous", basis: "name" });
    expect((matchProduct(row({ productLabel: "same" }), ps) as { candidates: unknown[] }).candidates).toHaveLength(2);
    expect(matchProduct(row({ matchedProductId: "p2", productLabel: "same" }), ps)).toMatchObject({ kind: "matched", basis: "server" });
  });

  it("flags a product that ran in several segments as session-level, and two provider rows for one product as siblings", () => {
    const ps = [product("p1", "A01", "Zip Hoodie")];
    const review = {
      rows: [
        { productId: "p1", title: "Hoodie pitch", actual: { startMs: 0, endMs: 1, durSec: 1 }, outcome: "completed" },
        { productId: "p1", title: "Hoodie recap", actual: { startMs: 2, endMs: 3, durSec: 1 }, outcome: "completed" },
        { productId: "p1", title: "Hoodie skipped", actual: null, outcome: "skipped" },
      ],
    } as unknown as Review;
    const rows = buildProductRows([row({ productId: "p1", skuId: "A" }), row({ productId: "p1", skuId: "B" })], ps, review);
    expect(rows[0].segmentTitles).toEqual(["Hoodie pitch", "Hoodie recap"]); // a skipped segment did not run
    expect(rows.every((r) => r.siblingRows === 2)).toBe(true);
  });
});

describe("observations are associations, never causes", () => {
  it("uses only association language across every scenario", () => {
    const s = ended();
    const r = reviewOf(s);
    const windows = recordedWindows(r);
    let seen = 0;
    for (const sc of FIXTURE_SCENARIOS) {
      const result = fixtureResultFor(s, r, sc.id);
      if (result?.kind !== "available") continue;
      const { observations, reason } = deriveObservations(windows, result.snapshot, s.timezone);
      for (const o of observations) {
        seen += 1;
        expect(`${o.text} ${o.basis}`).not.toMatch(/\b(caus\w*|because|led to|drove|driven|generated|resulted in|due to|thanks to|boosted|lifted)\b/i);
        expect(o.text).toMatch(/provider-observed|overran/i);
      }
      if (observations.length === 0) expect(reason).toMatch(/no observed pattern/i);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("leaves boundary minutes out and refuses to state a rate over a hole", () => {
    const w = (id: string, startMs: number, endMs: number) => ({ segmentId: id, title: id, kind: "product", productId: null, startMs, endMs, plannedSec: null, actualSec: (endMs - startMs) / 1000, varianceSec: null, overran: false, underran: false });
    const windows = [w("A", 0, 180_000), w("B", 180_000, 360_000)];
    const bucket = (i: number, clicks: number | null) => ({ startMs: i * 60_000, endMs: (i + 1) * 60_000, viewers: null, impressions: null, clicks, orders: null, gmv: null, comments: null, likes: null, shares: null });
    const snapshot = (clicks: Array<number | null>): LiveIntelligenceSnapshot => {
      const parsed = parseSnapshot(base({ minuteBuckets: clicks.map((c, i) => bucket(i, c)) }));
      if (!parsed.ok) throw new Error("bad fixture");
      return parsed.snapshot;
    };
    // A is 2 clicks/min, B is 10 clicks/min.
    const ok = deriveObservations(windows, snapshot([2, 2, 2, 10, 10, 10]), "UTC");
    expect(ok.observations[0].text).toContain("“B” (10 per minute across 3 full minutes)");
    expect(ok.observations[0].text).toContain("“A” (2 per minute across 3)");
    // A hole inside B means no rate can be stated for B.
    const hole = deriveObservations(windows, snapshot([2, 2, 2, 10, null, 10]), "UTC");
    expect(hole.observations).toHaveLength(0);
    expect(hole.reason).toMatch(/no observed pattern/i);
    // Marked as ambiguous by the server: a huge boundary minute inside A is not used.
    const withBoundary = parseSnapshot(
      base({
        minuteBuckets: [2, 2, 900, 10, 10, 10].map((c, i) => bucket(i, c)),
        segmentAttributions: [{ segmentId: "A", coverage: "ambiguous", metrics: [], ambiguousBuckets: [{ startMs: 120_000, endMs: 180_000, otherSegmentId: "B" }] }],
      })
    );
    if (!withBoundary.ok) throw new Error("bad fixture");
    const text = deriveObservations(windows, withBoundary.snapshot, "UTC").observations.map((o) => o.text).join(" ");
    expect(text).toContain("previous segment “A” (2 per minute across 2)"); // 2 full minutes; the 900-click boundary minute is excluded
    expect(text).not.toContain("900");
  });
});

describe("As known then: the replay never contains later knowledge", () => {
  const withQuickCue = (): Session => {
    let s = runScript(createScenarioSession("buffered"), 2);
    const cue = QUICK_CUES[0];
    const at = (lastRecordedMs(s) ?? 0) + 1000;
    const noted = applyCommand(s, { type: "add_note", text: quickCueNoteText(cue), nowMs: at });
    expect(noted.receipt.outcome).toBe("committed");
    s = runScript(noted.session);
    return s;
  };

  it("replays a quick cue as an operator report, and keeps notes appended after the LIVE out of the timeline", () => {
    const s = withQuickCue();
    const r = reviewOf(s);
    const afterEnd = applyCommand(s, { type: "add_note", text: "Reviewed the next morning", nowMs: r.summary.endedAtMs + 60_000 }).session;
    const replay = buildReplay(afterEnd, reviewOf(afterEnd));
    expect(replay.appendedAfterEnd).toBe(1);
    expect(replay.entries.some((e) => /next morning/.test(e.summary))).toBe(false);
    const cue = replay.entries.find((e) => e.quickCue !== null);
    expect(cue?.lane).toBe("operator");
    expect(cue?.summary).toBe("Operator reported: Price questions rising");
    expect(cue?.context).not.toBeNull();
    // The cut is the end of the LIVE.
    expect(Math.max(...replay.entries.map((e) => e.atMs))).toBeLessThanOrEqual(r.summary.endedAtMs);
  });

  it("round-trips every quick cue and ignores a look-alike note", () => {
    for (const cue of QUICK_CUES) expect(parseQuickCue(quickCueNoteText(cue))).toBe(cue);
    expect(parseQuickCue("Price questions rising")).toBeNull();
    expect(parseQuickCue("Something else (operator-reported quick cue)")).toBeNull();
  });
});

describe("capability ledger", () => {
  const row = (rows: ReturnType<typeof buildLedger>, key: string) => rows.find((r) => r.key === key)!;
  it("states unsupported things as fixed facts that no server answer can change", () => {
    const rows = buildLedger({ loginKit: "connected", server: [{ key: "raw_chat", state: "available", note: null, checkedAtMs: null }, { key: "pin_control", state: "available", note: null, checkedAtMs: null }] });
    expect(row(rows, "raw_chat")).toMatchObject({ state: "unsupported", fixed: true });
    expect(row(rows, "pin_control")).toMatchObject({ state: "unsupported", fixed: true });
    expect(row(rows, "login_kit").state).toBe("connected");
  });

  it("does not claim shop analytics are configured or missing before the server has been asked", () => {
    expect(row(buildLedger({ loginKit: null, server: null }), "shop_analytics").state).toBe("unknown");
    expect(row(buildLedger({ loginKit: null, server: "unreachable" }), "shop_analytics").state).toBe("unknown");
    expect(row(buildLedger({ loginKit: null, server: [] }), "shop_analytics").state).toBe("not_configured");
    expect(row(buildLedger({ loginKit: null, server: [{ key: "shop_analytics", state: "access_not_granted", note: null, checkedAtMs: null }] }), "shop_analytics").state).toBe("access_not_granted");
    expect(row(buildLedger({ loginKit: null, server: null }), "creator_realtime").state).toBe("partner_access_required");
  });
});
