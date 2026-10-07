/**
 * V7 LIVE intelligence: CLIENT-LOCAL structural types.
 *
 * These mirror, field for field, the shape the provider-core lane is expected to expose. They are deliberately a
 * separate, isolated file so integration can replace this module's imports with the server's shared contract in one
 * edit. They are NOT a server-domain model: nothing here is persisted, signed or sent back to the server.
 *
 * Truth rules baked into the shapes:
 *   - a metric that is not `available` carries `value: null`. Null is never rendered as 0 ("Missing != zero");
 *   - a minute-bucket field that is absent is `null` (missing). Only a number, including 0, is a recorded value;
 *   - `perspective` is always "later_evidence": nothing in a snapshot was known to the operator during the LIVE.
 */

export type Availability = "available" | "missing" | "unknown" | "unsupported";

export type AttributionCoverage = "complete" | "partial" | "ambiguous" | "none";

/** `fixture`: deterministic demo data (SIMULATED only). `provider`: observed by the provider API. */
export type EvidenceOrigin = "provider" | "fixture";

export const METRIC_KEYS = ["viewers", "impressions", "clicks", "orders", "gmv", "comments", "likes", "shares"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export interface TimeWindow {
  startMs: number;
  endMs: number;
}

export interface ProviderMetric {
  /** Normalised to a MetricKey where the server's key is a known alias, otherwise kept as sent. */
  key: string;
  value: number | null;
  unit: string | null;
  availability: Availability;
  source: string | null;
  evidenceTier: string | null;
  observedAtMs: number | null;
  window: TimeWindow | null;
  note: string | null;
}

/** One provider minute. `null` = not recorded (missing). `0` = recorded as zero. */
export interface MinuteEvidenceBucket extends TimeWindow {
  viewers: number | null;
  impressions: number | null;
  clicks: number | null;
  orders: number | null;
  gmv: number | null;
  comments: number | null;
  likes: number | null;
  shares: number | null;
}

/** A provider minute that overlaps this segment and at least one other. It is never assigned to either. */
export interface AmbiguousBucket extends TimeWindow {
  /** The other segment the minute overlaps, when the server names it. */
  otherSegmentId: string | null;
}

export interface SegmentAttribution {
  segmentId: string;
  title: string | null;
  plannedDurationMs: number | null;
  actualStartMs: number | null;
  actualEndMs: number | null;
  coverage: AttributionCoverage;
  metrics: ProviderMetric[];
  ambiguousBuckets: AmbiguousBucket[];
  limitations: string[];
}

export interface ProductPerformance {
  /** The server's own mapping to a LiveLift product, when it has one (highest-precedence match). */
  matchedProductId: string | null;
  productId: string | null;
  skuId: string | null;
  productLabel: string | null;
  impressions: number | null;
  clicks: number | null;
  orders: number | null;
  gmv: number | null;
  /** Provider-supplied click-to-order rate as a fraction (0.12 = 12%). Never derived here. */
  ctor: number | null;
  /** ISO currency of `gmv`, when stated. Without it the amount is shown as a bare number, never as money. */
  currency: string | null;
  availability: Availability;
  evidenceTier: string | null;
  limitations: string[];
}

export interface EvidenceLimit {
  text: string;
  metricKey: string | null;
  availability: Availability | null;
}

export interface LiveIntelligenceSnapshot {
  sessionId: string;
  mode: string;
  perspective: "later_evidence";
  provider: string;
  providerSessionId: string | null;
  fetchedAtMs: number;
  providerWindow: TimeWindow | null;
  /** Currency of every `gmv` in the minute buckets, when the server states one. */
  currency: string | null;
  minuteBuckets: MinuteEvidenceBucket[];
  segmentAttributions: SegmentAttribution[];
  productPerformance: ProductPerformance[];
  evidenceLimits: EvidenceLimit[];
  reconciliationVersion: string;
}

// ---- Results ---------------------------------------------------------------------------------------------------------

/** Why a request produced no snapshot. Each is a different thing to tell the operator; none is "zero". */
export type MalformedReason = "malformed" | "wrong_perspective" | "session_mismatch" | "rejected_fixture" | "settling" | "network" | "timeout" | "server" | "not_found";

export type LiveIntelligenceResult =
  | { kind: "available"; snapshot: LiveIntelligenceSnapshot; origin: EvidenceOrigin }
  /** The server does not offer provider evidence at all (route absent, or no provider configured). */
  | { kind: "not_configured" }
  /** A provider is configured, but the seller/creator has not granted this deployment access. */
  | { kind: "access_not_granted" }
  /** The provider authorization expired or was revoked. Fails closed. */
  | { kind: "auth_expired" }
  | { kind: "rate_limited"; retryAfterSec: number | null }
  /** The provider's official API does not offer this evidence. Permanent, not an outage. */
  | { kind: "unsupported" }
  /** Asked, and could not get an answer. Unknown, not zero. */
  | { kind: "unavailable"; reason: MalformedReason; message: string }
  | { kind: "signed_out" }
  | { kind: "forbidden" }
  /** The show is not in the room (a local archive), so there is nothing the server could look up. */
  | { kind: "not_applicable"; message: string };

export type LiveIntelligenceState = { kind: "idle" } | { kind: "fetching" } | LiveIntelligenceResult;

// ---- Capabilities ----------------------------------------------------------------------------------------------------

export type CapabilityState =
  | "available"
  | "connected"
  | "not_connected"
  | "not_configured"
  | "access_not_granted"
  | "partner_access_required"
  | "rate_limited"
  | "auth_expired"
  | "unavailable"
  | "unsupported"
  | "unknown";

export interface ProviderCapability {
  key: string;
  state: CapabilityState;
  note: string | null;
  checkedAtMs: number | null;
}
