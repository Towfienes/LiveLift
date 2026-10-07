export type ObsStatus = "not_configured" | "connecting" | "connected" | "disconnected" | "unavailable";
export type ObsError = "invalid_config" | "authentication_required" | "authentication_failed" | "unsupported_protocol" | "connection_failed" | "timeout" | "malformed_message" | "request_failed";

export interface ObsObservation<T> {
  value: T;
  receivedAt: string;
  // obs-websocket V5 supplies no wall-clock timestamp for these observations.
  providerTimestamp: null;
}

/** Broadcast-engine observations only. This is never an authority or social-platform snapshot. */
export interface ObsSnapshot {
  provider: "obs";
  provenance: "provider_observed";
  status: ObsStatus;
  statusChangedAt: string;
  currentProgramScene: ObsObservation<string> | null;
  scenes: ObsObservation<string[]> | null;
  streamActive: ObsObservation<boolean> | null;
  streamSupported: boolean | null;
  error: ObsError | null;
  reconnectAttempts: number;
  nextRetryAt: string | null;
}
