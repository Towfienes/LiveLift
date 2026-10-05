"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { EnvironmentIdentity, Session } from "@/contracts";
import {
  CLOCK_DISCONTINUITY_TOLERANCE_MS,
  advanceDeviceClock,
  effectiveNowMs,
  lastRecordedMs,
  type ClockState,
} from "@/lib/domain";
import { sessionStore, type DispatchInput, type DispatchResult, type StoreState } from "./sessionStore";

/** Subscribe to the store and trigger hydration on the client (server render stays unhydrated). */
export function useStoreState(): StoreState {
  const state = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getServerSnapshot
  );
  useEffect(() => {
    sessionStore.hydrate();
  }, []);
  return state;
}

export type SessionLookup =
  | { status: "loading"; session: null }
  | { status: "missing"; session: null }
  | { status: "ready"; session: Session };

/** A real not-found state: an unknown id never falls back to some other show. */
export function useSession(id: string): SessionLookup {
  const state = useStoreState();
  if (!state.hydrated) return { status: "loading", session: null };
  const session = state.sessions.find((s) => s.id === id);
  return session ? { status: "ready", session } : { status: "missing", session: null };
}

export function useSessions(env?: EnvironmentIdentity): { hydrated: boolean; sessions: Session[] } {
  const state = useStoreState();
  return {
    hydrated: state.hydrated,
    sessions: state.sessions.filter((s) => (env ? s.environment === env : true)),
  };
}

export interface ClockDiscontinuity {
  /** What the device wall clock reads. */
  deviceNowMs: number;
  /** The time the desk keeps using (never earlier than a time already shown or recorded). */
  keptNowMs: number;
  behindByMs: number;
}

export interface DeskClock {
  /** null until mounted, so server and first client render agree. */
  nowMs: number | null;
  /** The device clock is behind the time LiveLift keeps: alignment is uncertain. */
  discontinuity: ClockDiscontinuity | null;
  /** A fresh reading for a command, taken at the moment of the click. */
  read: () => number;
}

/**
 * The clock the desk renders and records with.
 * - SIMULATED: the session's virtual clock (changes only through recorded commands).
 * - REAL: the device clock, ticking once a second after mount. It is monotonic: a backward wall-clock
 *   jump never makes "now" earlier than a time already shown or recorded (so a missed anchor cannot
 *   quietly become on-track); time keeps advancing on the browser's monotonic timer and the gap is surfaced.
 */
export function useDeskClock(session: Session | null, tickMs = 1000): DeskClock {
  const isReal = session?.environment === "REAL";
  const sessionId = session?.id ?? null;
  const floor = session && isReal ? lastRecordedMs(session) : null;
  const floorRef = useRef<number | null>(floor);
  const stateRef = useRef<ClockState | null>(null);
  const [reading, setReading] = useState<{ nowMs: number; deviceNowMs: number; behindByMs: number } | null>(null);

  useEffect(() => {
    floorRef.current = floor;
  }, [floor]);

  const read = useCallback((): { nowMs: number; deviceNowMs: number; behindByMs: number } => {
    const device = Date.now();
    const perf = typeof performance !== "undefined" ? performance.now() : 0;
    let prev = stateRef.current;
    const f = floorRef.current;
    // Never before the latest recorded event: that time was already used.
    if (f !== null && (prev === null || f > prev.nowMs)) prev = { nowMs: f, perfMs: perf };
    const r = advanceDeviceClock(prev, device, perf);
    stateRef.current = r.state;
    return { nowMs: r.state.nowMs, deviceNowMs: device, behindByMs: r.behindByMs };
  }, []);

  useEffect(() => {
    if (!isReal) return;
    stateRef.current = null;
    const tick = (): void => setReading(read());
    tick();
    const timer = window.setInterval(tick, tickMs);
    return () => window.clearInterval(timer);
  }, [isReal, tickMs, sessionId, read]);

  if (!session) return { nowMs: null, discontinuity: null, read: () => Date.now() };
  if (session.environment === "SIMULATED") {
    const v = effectiveNowMs(session, 0);
    return { nowMs: v, discontinuity: null, read: () => v };
  }
  return {
    nowMs: reading?.nowMs ?? null,
    discontinuity:
      reading && reading.behindByMs > CLOCK_DISCONTINUITY_TOLERANCE_MS
        ? { deviceNowMs: reading.deviceNowMs, keptNowMs: reading.nowMs, behindByMs: reading.behindByMs }
        : null,
    read: () => read().nowMs,
  };
}

/** The clock the screen should render with (see useDeskClock). */
export function useNow(session: Session | null, tickMs = 1000): number | null {
  return useDeskClock(session, tickMs).nowMs;
}

/** Dispatch commands for a session using the revision the screen rendered, so a stale click is rejected. */
export function useSessionActions(session: Session | null): {
  dispatch: (input: DispatchInput) => DispatchResult | null;
} {
  const sessionId = session?.id ?? null;
  const renderedRevision = session?.revision;
  const dispatch = useCallback(
    (input: DispatchInput): DispatchResult | null => {
      if (!sessionId) return null;
      return sessionStore.dispatch(sessionId, { expectedRevision: renderedRevision, ...input });
    },
    [sessionId, renderedRevision]
  );
  return { dispatch };
}
