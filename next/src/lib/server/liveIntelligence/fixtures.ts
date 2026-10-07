import type { Session } from "@/contracts";
import type { FIXTURE_CASES, ProviderMetric } from "@/contracts/liveIntelligence";
import type { ProviderEvidenceData } from "@/lib/domain/liveIntelligence";
import { fail, parseMinutePage, parseProducts, parseCreatorStats } from "./provider";

export type FixtureCase = typeof FIXTURE_CASES[number];
/** Synthetic values, ONLY the documented nesting/fields. The fixture envelope never becomes REAL evidence. */
export function officialFixturePayloads(startMs: number, endMs: number, kind: FixtureCase = "normal"): { minutes: unknown; products: unknown; creator: unknown } {
  const start = Math.floor(startMs / 1000), end = Math.floor(endMs / 1000);
  const intervals = kind === "empty" ? [] : Array.from({ length: Math.min(180, Math.max(1, Math.ceil((end - start) / 60))) }, (_, i) => ({
    start_time: start + i * 60, end_time: start + (i + 1) * 60,
    sales: { sku_orders: i, ...(kind === "missing_gmv" ? {} : { gmv: { amount: kind === "zero_gmv" ? "0.00" : `${i * 100}.10`, currency: "VND" } }) },
    traffic: { viewers: 30 + i, product_impressions: 100 + i, ...(kind === "missing_clicks" ? {} : { product_clicks: kind === "zero_clicks" ? 0 : 10 + i }) },
    interactions: { comments: 5 + i, likes: 30 + i, shares: i },
  }));
  const products = kind === "empty" ? [] : [{ id: kind === "unknown_product" ? "999999999" : "100001",
    sales: { sku_orders: 2, direct_gmv: { amount: "200.20", currency: "VND" } }, traffic: { product_impressions: 200, produt_clicks: kind === "zero_clicks" ? 0 : 21 } }];
  return { minutes: kind === "malformed" ? { performance: { intervals: [{ start_time: "bad" }] } } : { performance: { overall: { start_time: start, end_time: end }, intervals } },
    products: { products }, creator: { stats: { current_visitor_count: 123, peak_concurrent_user_count: 234 } } };
}
export function fixtureEvidence(session: Session, observedAt: number, kind: FixtureCase = "normal"): ProviderEvidenceData {
  if (session.environment !== "SIMULATED") fail("unsupported");
  if (kind === "rate_limit") fail("rate_limited", 60);
  if (kind === "auth_expired") fail("auth_expired");
  const payload = officialFixturePayloads(session.runtime.startedAtMs!, session.runtime.endedAtMs!, kind);
  const minutes = parseMinutePage(payload.minutes, observedAt, "fixture", "half_open");
  return { minuteBuckets: minutes.buckets, providerWindow: minutes.window, productPerformance: parseProducts(payload.products, observedAt, "fixture"),
    evidenceLimits: ["SIMULATED / FIXTURE: official-shape synthetic data, not data fetched from TikTok.", "Comments are aggregate counts; raw comment text is unsupported.", "Fixture windows explicitly use [start, end); real interval boundary policy defaults to unverified."] };
}
export function fixtureCreatorMetrics(observedAt: number): ProviderMetric[] {
  return parseCreatorStats(officialFixturePayloads(observedAt, observedAt).creator, observedAt, "fixture");
}
