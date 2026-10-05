"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { EnvironmentIdentity, Session } from "@/contracts";
import { effectiveNowMs, type CommandResult } from "@/lib/domain";
import { sessionStore, type DispatchInput, type StoreState } from "./sessionStore";

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

/**
 * The clock the screen should render with.
 * - SIMULATED: the session's virtual clock (changes only through recorded commands).
 * - REAL: the device clock, ticking once a second after mount.
 * Returns null until mounted so server and first client render agree.
 */
export function useNow(session: Session | null, tickMs = 1000): number | null {
  const [deviceNow, setDeviceNow] = useState<number | null>(null);
  const isReal = session?.environment === "REAL";

  useEffect(() => {
    if (!isReal) return;
    setDeviceNow(Date.now());
    const timer = window.setInterval(() => setDeviceNow(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [isReal, tickMs]);

  if (!session) return null;
  if (session.environment === "SIMULATED") return effectiveNowMs(session, 0);
  return deviceNow;
}

/** Dispatch commands for a session using the revision the screen rendered, so a stale click is rejected. */
export function useSessionActions(session: Session | null): {
  dispatch: (input: DispatchInput) => CommandResult | null;
} {
  const sessionId = session?.id ?? null;
  const renderedRevision = session?.revision;
  const dispatch = useCallback(
    (input: DispatchInput): CommandResult | null => {
      if (!sessionId) return null;
      return sessionStore.dispatch(sessionId, { expectedRevision: renderedRevision, ...input });
    },
    [sessionId, renderedRevision]
  );
  return { dispatch };
}
