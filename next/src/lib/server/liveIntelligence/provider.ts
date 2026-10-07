import { z } from "zod";
import { CountSchema, MoneySchema, ProductPerformanceSchema, type EvidenceSource, type MinuteEvidenceBucket, type ProductPerformance, type ProviderFailure, type ProviderMetric } from "@/contracts/liveIntelligence";
import { exactRatio, type ProviderEvidenceData } from "@/lib/domain/liveIntelligence";
import type { IntelligenceConfig } from "./config";
import { signTikTokShopRequest } from "./signing";

export const SHOP_ORIGIN = "https://open-api.tiktokglobalshop.com";
export const MINUTE_PATH = (id: string): string => `/analytics/202510/shop_lives/${id}/performance_per_minutes`;
export const PRODUCT_PATH = (id: string): string => `/analytics/202512/shop/${id}/products_performance`;
export const CREATOR_PATH = (id: string): string => `/analytics/202502/live_rooms/${id}/core_stats`;
const MAX_BYTES = 2_097_152;
const OPTIONAL_COUNT = CountSchema.nullable().optional();
const OPTIONAL_MONEY = MoneySchema.nullable().optional();
const SecondsSchema = z.number().int().min(1_000_000_000).max(9_999_999_999);
const EnvelopeSchema = z.object({ code: z.number().int().safe(), data: z.unknown().optional() });
const IntervalSchema = z.object({ start_time: SecondsSchema, end_time: SecondsSchema,
  sales: z.object({ gmv: OPTIONAL_MONEY, sku_orders: OPTIONAL_COUNT }).optional(),
  traffic: z.object({ viewers: OPTIONAL_COUNT, product_impressions: OPTIONAL_COUNT, product_clicks: OPTIONAL_COUNT }).optional(),
  interactions: z.object({ comments: OPTIONAL_COUNT, likes: OPTIONAL_COUNT, shares: OPTIONAL_COUNT }).optional(),
});
const MinuteDataSchema = z.object({ performance: z.object({
  overall: z.object({ start_time: SecondsSchema, end_time: SecondsSchema }).optional(),
  intervals: z.array(IntervalSchema).max(3000),
}), next_page_token: z.string().max(2048).nullable().optional() });
const ProductDataSchema = z.object({ products: z.array(z.object({
  id: z.string().regex(/^\d{1,30}$/),
  sales: z.object({ direct_gmv: OPTIONAL_MONEY, sku_orders: OPTIONAL_COUNT }).optional(),
  traffic: z.object({ product_impressions: OPTIONAL_COUNT, produt_clicks: OPTIONAL_COUNT }).optional(),
})).max(1000) });
const CoreDataSchema = z.object({ stats: z.object({ current_visitor_count: OPTIONAL_COUNT, peak_concurrent_user_count: OPTIONAL_COUNT }) });

export class IntelligenceProviderError extends Error {
  constructor(readonly failure: ProviderFailure) { super(failure.code); }
}
export function fail(code: ProviderFailure["code"], retryAfterSec?: number): never {
  const state = code === "auth_expired" ? "AUTH_EXPIRED" : code === "rate_limited" ? "RATE_LIMITED" : code === "access_not_granted" ? "ACCESS_NOT_GRANTED" : code === "not_configured" ? "NOT_CONFIGURED" : code === "unsupported" ? "UNSUPPORTED" : "UNAVAILABLE";
  throw new IntelligenceProviderError({ state, code, ...(retryAfterSec ? { retryAfterSec } : {}) });
}

export function parseMinutePage(raw: unknown, observedAt: number, source: EvidenceSource, timing: MinuteEvidenceBucket["timing"]): { buckets: MinuteEvidenceBucket[]; window?: { startMs: number; endMs: number }; nextPage?: string } {
  const parsed = MinuteDataSchema.safeParse(raw);
  if (!parsed.success) fail("malformed_response");
  const { performance, next_page_token } = parsed.data;
  const buckets = performance.intervals.map((i): MinuteEvidenceBucket => {
    if (i.end_time < i.start_time || i.end_time - i.start_time > 60) fail("malformed_response");
    // The official sample uses equal start/end. Preserve uncertainty with a conservative 60s envelope.
    const unverified = timing === "unverified_bounds" || i.start_time === i.end_time;
    return { startMs: i.start_time * 1000, endMs: (unverified ? Math.max(i.end_time, i.start_time + 60) : i.end_time) * 1000, reportedEndMs: i.end_time * 1000,
      viewers: i.traffic?.viewers ?? null, impressions: i.traffic?.product_impressions ?? null, clicks: i.traffic?.product_clicks ?? null,
      orders: i.sales?.sku_orders ?? null, gmv: i.sales?.gmv ?? null, comments: i.interactions?.comments ?? null,
      likes: i.interactions?.likes ?? null, shares: i.interactions?.shares ?? null, source, observedAt, evidenceTier: "provider_observed", timing: unverified ? "unverified_bounds" : "half_open" };
  });
  const overall = performance.overall;
  if (overall && overall.end_time < overall.start_time) fail("malformed_response");
  return { buckets, ...(overall ? { window: { startMs: overall.start_time * 1000, endMs: overall.end_time * 1000 } } : {}), ...(next_page_token ? { nextPage: next_page_token } : {}) };
}
export function parseProducts(raw: unknown, observedAt: number, source: EvidenceSource): ProductPerformance[] {
  const parsed = ProductDataSchema.safeParse(raw);
  if (!parsed.success) fail("malformed_response");
  const seen = new Set<string>();
  return parsed.data.products.map((p) => {
    if (seen.has(p.id)) fail("malformed_response");
    seen.add(p.id);
    const impressions = p.traffic?.product_impressions ?? null, clicks = p.traffic?.produt_clicks ?? null;
    const orders = p.sales?.sku_orders ?? null, gmv = p.sales?.direct_gmv ?? null;
    return ProductPerformanceSchema.parse({ productId: p.id, impressions, clicks, orders, gmv, ctor: exactRatio(orders, clicks),
      availability: [impressions, clicks, orders, gmv].every((v) => v === null) ? "missing" : "available", source, observedAt,
      evidenceTier: "provider_observed", association: "session_only", limitations: ["Session-level product performance; not per-segment sales.", "CTOR: COMPUTED FROM PROVIDER-OBSERVED DATA (SKU orders / product clicks); undefined for missing or zero clicks.", "Orders are provider SKU orders. GMV is direct_gmv as defined by the provider; it is not interchangeable with minute GMV.", ...(clicks === 0 ? ["CTOR undefined: zero clicks."] : [])] });
  });
}

export function parseCreatorStats(raw: unknown, observedAt: number, source: "tiktok_creator" | "fixture"): ProviderMetric[] {
  const parsed = CoreDataSchema.safeParse(raw);
  if (!parsed.success) fail("malformed_response");
  return (["current_visitor_count", "peak_concurrent_user_count"] as const).map((key) => {
    const value = parsed.data.stats[key] ?? null;
    return { key, value, unit: "count", availability: value === null ? "missing" : "available", source, evidenceTier: "provider_observed", observedAt,
      ...(source === "fixture" ? { note: "SIMULATED / FIXTURE" } : {}) };
  });
}

export interface LiveMetricsProvider {
  getMinuteEvidence(providerSessionId: string, observedAt: number): Promise<Pick<ProviderEvidenceData, "minuteBuckets" | "providerWindow">>;
  getCreatorSnapshot(providerSessionId: string, observedAt: number): Promise<ProviderMetric[]>;
}
export interface ProductPerformanceProvider { getProductPerformance(providerSessionId: string, observedAt: number): Promise<ProductPerformance[]> }

/** Fixed official origin and paths. No configurable base URL, redirects, token query parameters or raw error text. */
export class TikTokShopProvider implements LiveMetricsProvider, ProductPerformanceProvider {
  private nextRequestAt = 0;
  constructor(private config: IntelligenceConfig, private fetchImpl: typeof fetch = fetch, private now = Date.now, private timeoutMs = 10_000, private intervalMs = 5000) {}
  private async request(path: string, query: Record<string, string>, creator = false): Promise<unknown> {
    const { appKey, appSecret, accessToken, shopCipher, creatorToken } = this.config;
    if (!appKey || !appSecret || !(creator ? creatorToken : accessToken && shopCipher)) fail("not_configured");
    const waitMs = Math.max(0, this.nextRequestAt - this.now());
    this.nextRequestAt = this.now() + waitMs + this.intervalMs;
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    const params = { ...query, app_key: appKey, timestamp: String(Math.floor(this.now() / 1000)), ...(!creator ? { shop_cipher: shopCipher! } : {}) };
    const url = new URL(path, SHOP_ORIGIN);
    url.search = new URLSearchParams({ ...params, sign: signTikTokShopRequest(path, params, appSecret) }).toString();
    const abort = new AbortController();
    const timedOut = new Promise<never>((_, reject) => abort.signal.addEventListener("abort", () => reject(new IntelligenceProviderError({ state: "UNAVAILABLE", code: "timeout" })), { once: true }));
    const timer = setTimeout(() => abort.abort(), this.timeoutMs);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let response: Response | undefined;
    try {
      response = await Promise.race([this.fetchImpl(url, { method: "GET", headers: { "content-type": "application/json", "x-tts-access-token": (creator ? creatorToken : accessToken)! }, redirect: "error", signal: abort.signal, cache: "no-store" }), timedOut]);
      const retryRaw = response.headers.get("retry-after");
      const retry = retryRaw && /^\d+$/.test(retryRaw) ? Math.max(1, Math.min(86400, Number(retryRaw))) : retryRaw && Number.isFinite(Date.parse(retryRaw)) ? Math.max(1, Math.min(86400, Math.ceil((Date.parse(retryRaw) - this.now()) / 1000))) : 60;
      if (response.status === 429) fail("rate_limited", retry);
      if (response.status === 401) fail("auth_expired");
      if (response.status === 403) fail("access_not_granted");
      if (response.status === 404) fail("unsupported");
      if (response.status === 408 || response.status === 504) fail("timeout");
      if (response.status >= 500 || response.status >= 300 && response.status < 400) fail("upstream_unavailable");
      const length = response.headers.get("content-length");
      if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) fail("response_too_large");
      if (!response.body || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) fail("malformed_response");
      reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      for (;;) {
        const { value, done } = await Promise.race([reader.read(), timedOut]);
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { void reader.cancel().catch(() => {}); fail("response_too_large"); }
        chunks.push(value);
      }
      const envelope = EnvelopeSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size))));
      if (!envelope.success) fail("malformed_response");
      const code = envelope.data.code;
      if ([36009002, 36009037].includes(code)) fail("rate_limited", retry);
      if (code === 105002) fail("auth_expired");
      if ([105005, 66009315, 36009033, 101000].includes(code)) fail("access_not_granted");
      if (code === 36009007) fail("timeout");
      if (code === 36009009) fail("unsupported");
      if (code !== 0 || !response.ok) fail("upstream_unavailable");
      return envelope.data.data;
    } catch (error) {
      if (error instanceof IntelligenceProviderError) throw error;
      if (abort.signal.aborted) fail("timeout");
      if (error instanceof SyntaxError || error instanceof TypeError && reader) fail("malformed_response");
      fail("network");
    } finally {
      clearTimeout(timer);
      if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
      else if (response?.body) void response.body.cancel().catch(() => {});
    }
  }
  private id(id: string): string { if (!/^\d{1,30}$/.test(id)) fail("malformed_response"); return id; }
  async getMinuteEvidence(id: string, observedAt: number): Promise<Pick<ProviderEvidenceData, "minuteBuckets" | "providerWindow">> {
    const buckets = new Map<number, MinuteEvidenceBucket>();
    const seenTokens = new Set<string>(); let pageToken: string | undefined; let providerWindow: ProviderEvidenceData["providerWindow"];
    for (let page = 0; page < 30; page++) {
      const result = parseMinutePage(await this.request(MINUTE_PATH(this.id(id)), { currency: "LOCAL", ...(pageToken ? { page_token: pageToken } : {}) }), observedAt, "tiktok_shop", this.config.intervalPolicy === "half_open_confirmed" ? "half_open" : "unverified_bounds");
      if (result.window) {
        if (providerWindow && JSON.stringify(providerWindow) !== JSON.stringify(result.window)) fail("malformed_response");
        providerWindow = result.window;
      }
      for (const b of result.buckets) {
        const prev = buckets.get(b.startMs);
        if (prev && JSON.stringify(prev) !== JSON.stringify(b)) fail("malformed_response");
        buckets.set(b.startMs, b);
      }
      if (buckets.size > 3000) fail("response_too_large");
      if (!result.nextPage) {
        const minuteBuckets = [...buckets.values()].sort((a, b) => a.startMs - b.startMs);
        if (minuteBuckets.some((b, i) => i > 0 && b.startMs < minuteBuckets[i - 1].endMs)) fail("malformed_response");
        return { minuteBuckets, ...(providerWindow ? { providerWindow } : {}) };
      }
      if (seenTokens.has(result.nextPage)) fail("malformed_response");
      seenTokens.add(result.nextPage); pageToken = result.nextPage;
    }
    fail("response_too_large");
  }
  async getProductPerformance(id: string, observedAt: number): Promise<ProductPerformance[]> {
    return parseProducts(await this.request(PRODUCT_PATH(this.id(id)), { currency: "LOCAL" }), observedAt, "tiktok_shop");
  }
  async getCreatorSnapshot(id: string, observedAt: number): Promise<ProviderMetric[]> {
    return parseCreatorStats(await this.request(CREATOR_PATH(this.id(id)), {}, true), observedAt, "tiktok_creator");
  }
}
