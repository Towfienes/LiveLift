import { buildHeaders, classifyCode, readError, sendBounded, type Fetched, type FetchFailure, type RequestContext } from "@/lib/client/productionTransport";
import { parseSnapshot } from "./parse";
import type { CapabilityState, LiveIntelligenceResult, ProviderCapability } from "./types";

/**
 * Typed client for the V7 later-evidence endpoints the provider-core lane is expected to serve.
 *
 * This is the one place that knows route names and the response envelope. Integration should only need to adjust
 * `INTELLIGENCE_ROUTES` and, if the server's envelope differs, `fromEnvelope`.
 *
 * Same rules as the other production clients: the session is an HttpOnly cookie the server owns, every request
 * carries the CSRF marker and workspace context, nothing here can see a provider token, and a failure is a value
 * (unknown), never a zero.
 *
 * REAL only. This client is never asked about a SIMULATED rehearsal, and a snapshot that identifies itself as a
 * fixture or as SIMULATED is REFUSED: fixture metrics must never appear in a REAL show.
 */

export const INTELLIGENCE_ROUTES = {
  capabilities: "/api/v3/live-intelligence/capabilities",
  snapshot: (sessionId: string): string => `/api/v3/live-intelligence/sessions/${encodeURIComponent(sessionId)}`,
  refresh: (sessionId: string): string => `/api/v3/live-intelligence/sessions/${encodeURIComponent(sessionId)}/refresh`,
} as const;

export type CapabilitiesResult =
  | { kind: "ok"; capabilities: ProviderCapability[] }
  | { kind: "signed_out" }
  | { kind: "not_configured" }
  | { kind: "unavailable"; message: string };

export interface LiveIntelligenceClient {
  getSnapshot(context: RequestContext, sessionId: string): Promise<LiveIntelligenceResult>;
  /** Asks the server to fetch again. Never changes the show; the answer has the same shape as getSnapshot. */
  requestRefresh(context: RequestContext, sessionId: string): Promise<LiveIntelligenceResult>;
  getCapabilities(context: RequestContext): Promise<CapabilitiesResult>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const CAPABILITY_STATES: readonly CapabilityState[] = [
  "available",
  "connected",
  "not_connected",
  "not_configured",
  "access_not_granted",
  "partner_access_required",
  "rate_limited",
  "auth_expired",
  "unavailable",
  "unsupported",
  "unknown",
];

function retryAfter(headers: Headers | undefined, body: unknown): number | null {
  const fromHeader = Number(headers?.get("retry-after"));
  if (Number.isFinite(fromHeader) && fromHeader > 0) return Math.round(fromHeader);
  const fromBody = isRecord(body) ? Number(body.retryAfterSec) : NaN;
  return Number.isFinite(fromBody) && fromBody > 0 ? Math.round(fromBody) : null;
}

const SETTLING = "TikTok has not finished settling this show's metrics. Post-LIVE data can take up to 48 hours to become final.";

/** The server's statement about a show, as a result. Accepts the `{status}` envelope or a bare snapshot. */
function fromEnvelope(body: unknown, sessionId: string, headers?: Headers): LiveIntelligenceResult {
  if (!isRecord(body)) return { kind: "unavailable", reason: "malformed", message: "The server sent a later-evidence answer LiveLift could not read." };
  const status = typeof body.status === "string" ? body.status : null;
  switch (status) {
    case "not_configured":
      return { kind: "not_configured" };
    case "access_not_granted":
      return { kind: "access_not_granted" };
    case "auth_expired":
      return { kind: "auth_expired" };
    case "unsupported":
      return { kind: "unsupported" };
    case "rate_limited":
      return { kind: "rate_limited", retryAfterSec: retryAfter(headers, body) };
    case "pending":
    case "settling":
      return { kind: "unavailable", reason: "settling", message: SETTLING };
    case "unavailable":
      return { kind: "unavailable", reason: "server", message: typeof body.message === "string" ? body.message : "The provider could not be reached." };
    default:
      break;
  }
  const raw = status === "available" ? body.snapshot : body.snapshot !== undefined ? body.snapshot : body;
  const parsed = parseSnapshot(raw);
  if (!parsed.ok) {
    const message =
      parsed.reason === "wrong_perspective"
        ? "The server's answer was not marked as later evidence, so LiveLift did not show it."
        : "The server sent later evidence LiveLift could not trust, so it was not shown.";
    return { kind: "unavailable", reason: parsed.reason, message };
  }
  const { snapshot, origin } = parsed;
  if (snapshot.sessionId !== sessionId) {
    return { kind: "unavailable", reason: "session_mismatch", message: "The evidence the server sent belongs to a different show, so LiveLift discarded it." };
  }
  if (origin === "fixture" || /^simulated$/i.test(snapshot.mode)) {
    return { kind: "unavailable", reason: "rejected_fixture", message: "The server sent fixture or SIMULATED evidence for a REAL show. LiveLift discarded it: fixture metrics never appear in a REAL show." };
  }
  return { kind: "available", snapshot, origin };
}

export function interpretSnapshotResponse(res: Fetched | FetchFailure, sessionId: string): LiveIntelligenceResult {
  if (!res.ok) return { kind: "unavailable", reason: res.kind, message: res.message };
  const { status, body } = res;
  if (status >= 200 && status < 300) return fromEnvelope(body, sessionId, res.headers);
  const code = classifyCode(status, body);
  if (status === 401) return { kind: "signed_out" };
  if (status === 429) return { kind: "rate_limited", retryAfterSec: retryAfter(res.headers, body) };
  if (code === "provider_not_configured" || status === 501) return { kind: "not_configured" };
  if (code === "provider_access_not_granted") return { kind: "access_not_granted" };
  if (code === "provider_auth_expired") return { kind: "auth_expired" };
  if (status === 403 && code !== "csrf_failed") return { kind: "forbidden" };
  if (status === 404) {
    // A JSON 404 is the server saying it has no evidence for this show; an HTML/empty 404 is a server without the route.
    return isRecord(body) && readError(body).code !== null
      ? { kind: "unavailable", reason: "not_found", message: "The server has no later evidence on file for this show." }
      : { kind: "not_configured" };
  }
  return { kind: "unavailable", reason: "server", message: readError(body).message ?? `The server answered ${status}.` };
}

function parseCapabilities(body: unknown): ProviderCapability[] | null {
  const list = isRecord(body) ? body.capabilities : null;
  if (!Array.isArray(list)) return null;
  const out: ProviderCapability[] = [];
  for (const item of list) {
    if (!isRecord(item) || typeof item.key !== "string" || typeof item.state !== "string" || !CAPABILITY_STATES.includes(item.state as CapabilityState)) return null;
    out.push({
      key: item.key,
      state: item.state as CapabilityState,
      note: typeof item.note === "string" ? item.note : null,
      checkedAtMs: typeof item.checkedAtMs === "number" && Number.isFinite(item.checkedAtMs) ? item.checkedAtMs : null,
    });
  }
  return out;
}

export function createLiveIntelligenceClient(options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): LiveIntelligenceClient {
  const timeoutMs = options.timeoutMs ?? 15_000;

  return {
    getSnapshot: async (context, sessionId) =>
      interpretSnapshotResponse(await sendBounded(options.fetchImpl, INTELLIGENCE_ROUTES.snapshot(sessionId), { method: "GET", headers: buildHeaders({ unsafe: false, context }) }, timeoutMs), sessionId),
    requestRefresh: async (context, sessionId) =>
      interpretSnapshotResponse(await sendBounded(options.fetchImpl, INTELLIGENCE_ROUTES.refresh(sessionId), { method: "POST", headers: buildHeaders({ unsafe: true, context }), body: "{}" }, timeoutMs), sessionId),
    getCapabilities: async (context) => {
      const res = await sendBounded(options.fetchImpl, INTELLIGENCE_ROUTES.capabilities, { method: "GET", headers: buildHeaders({ unsafe: false, context }) }, timeoutMs);
      if (!res.ok) return { kind: "unavailable", message: res.message };
      if (res.status >= 200 && res.status < 300) {
        const capabilities = parseCapabilities(res.body);
        return capabilities ? { kind: "ok", capabilities } : { kind: "unavailable", message: "The server sent a capability list LiveLift could not read." };
      }
      if (res.status === 401) return { kind: "signed_out" };
      if (res.status === 404 || res.status === 501) return { kind: "not_configured" };
      return { kind: "unavailable", message: readError(res.body).message ?? `The server answered ${res.status}.` };
    },
  };
}
