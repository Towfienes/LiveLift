/**
 * Authority time for REAL shows.
 *
 * The browser wall clock never timestamps a REAL command and never defines "now" for a REAL show. Time
 * comes from the server (`serverNowMs`, plus `clockBehindByMs` when the server clock is behind the time
 * the authority has already recorded) and is interpolated between polls with the monotonic browser timer
 * (`performance.now()`), which is immune to wall-clock changes.
 *
 * While the room is stale or disconnected the interpolation is FROZEN at the instant contact was lost:
 * LiveLift does not extrapolate transitions it has not seen.
 */

export interface AuthorityClockSample {
  /** Server wall time when the read was answered. */
  serverNowMs: number;
  /** Nonnegative gap to the authoritative effective time (see contract: `clockBehindByMs`). */
  clockBehindByMs: number;
  /** Monotonic browser time at (the middle of) the exchange that produced this sample. */
  receivedPerfMs: number;
}

/**
 * The authority's effective "now" for display and projection.
 * `frozenAtPerfMs` stops the interpolation (stale/disconnected); null lets it run.
 */
export function authorityNowMs(sample: AuthorityClockSample, perfNowMs: number, frozenAtPerfMs: number | null = null): number {
  const at = frozenAtPerfMs === null ? perfNowMs : Math.min(perfNowMs, frozenAtPerfMs);
  return Math.round(sample.serverNowMs + sample.clockBehindByMs + Math.max(0, at - sample.receivedPerfMs));
}
