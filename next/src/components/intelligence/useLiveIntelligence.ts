"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Session } from "@/contracts";
import type { Review } from "@/lib/domain";
import { authStore, type AuthState } from "@/lib/client/authStore";
import { createLiveIntelligenceClient, type LiveIntelligenceClient } from "@/lib/intelligence/client";
import { DEFAULT_FIXTURE_SCENARIO, fixtureResultFor, type FixtureScenarioId } from "@/lib/intelligence/fixtures";
import type { LiveIntelligenceState, ProviderCapability } from "@/lib/intelligence/types";

const defaultClient = createLiveIntelligenceClient();

/** Who is signed in, read straight from the auth store (the same source `useAuth` reads). */
const useAuth = (): AuthState => useSyncExternalStore(authStore.subscribe, authStore.getSnapshot, authStore.getServerSnapshot);

export interface LiveIntelligenceView {
  state: LiveIntelligenceState;
  /** Read the server's answer again (any signed-in viewer). */
  reload: () => void;
  /** Ask the server to fetch again. Operators only; never touches the show. */
  refresh: () => void;
  canRefresh: boolean;
  refreshing: boolean;
}

/**
 * Where a show's later evidence comes from, told truthfully.
 *
 *   SIMULATED  a deterministic fixture, computed here. No network. Only ever used for a rehearsal.
 *   archive    a pre-Phase-2 REAL show kept in this browser: not in the room, so the server has nothing to look up.
 *   REAL       the server, once `enabled`. Nothing is requested before the operator opens a surface that needs it.
 *
 * The result is a value the UI renders as-is. A failure is "unknown", never an empty or zero result.
 */
export function useLiveIntelligence(opts: {
  session: Pick<Session, "id" | "environment" | "products">;
  review: Review | null;
  enabled: boolean;
  archive?: boolean;
  scenario?: FixtureScenarioId;
  client?: LiveIntelligenceClient;
}): LiveIntelligenceView {
  const { session, review, enabled, archive = false, scenario = DEFAULT_FIXTURE_SCENARIO, client = defaultClient } = opts;
  const auth = useAuth();
  const [remote, setRemote] = useState<LiveIntelligenceState>({ kind: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const epoch = useRef(0);

  const authed = auth.status === "authenticated" ? auth.session : null;
  const workspaceId = authed?.workspaceId ?? null;
  const generation = authed?.generation ?? null;
  const canRefresh = authed?.access.role === "operator";
  const mode = !enabled ? "off" : session.environment === "SIMULATED" ? "fixture" : archive ? "archive" : "remote";
  const { id, environment, products } = session;

  useEffect(() => {
    if (mode === "remote") authStore.ensureChecked();
  }, [mode]);

  useEffect(() => {
    if (mode !== "remote") return;
    if (auth.status === "checking" || auth.status === "signing_in") {
      setRemote({ kind: "fetching" });
      return;
    }
    if (!workspaceId || !generation) {
      setRemote(
        auth.status === "unavailable"
          ? { kind: "unavailable", reason: "network", message: auth.unavailable?.message ?? "The server could not be reached." }
          : { kind: "signed_out" }
      );
      return;
    }
    const mine = ++epoch.current;
    setRemote({ kind: "fetching" });
    void client.getSnapshot({ workspaceId, generation }, id).then((result) => {
      if (epoch.current === mine) setRemote(result);
    });
    return () => {
      epoch.current += 1;
    };
  }, [mode, auth.status, auth.unavailable, workspaceId, generation, id, client, tick]);

  const fixture = useMemo<LiveIntelligenceState>(() => {
    if (mode !== "fixture" || !review) return { kind: "idle" };
    return fixtureResultFor({ id, environment, products }, review, scenario) ?? { kind: "idle" };
  }, [mode, review, id, environment, products, scenario]);

  const refresh = useCallback((): void => {
    if (mode !== "remote" || !workspaceId || !generation || !canRefresh) return;
    const mine = ++epoch.current;
    setRefreshing(true);
    void client.requestRefresh({ workspaceId, generation }, id).then((result) => {
      if (epoch.current !== mine) return;
      setRefreshing(false);
      setRemote(result);
    });
  }, [mode, workspaceId, generation, canRefresh, client, id]);

  const state: LiveIntelligenceState =
    mode === "off"
      ? { kind: "idle" }
      : mode === "fixture"
        ? fixture
        : mode === "archive"
          ? { kind: "not_applicable", message: "This is a local archive. It is not in the shared room, so the server has no provider evidence to look up for it." }
          : // Opened but not yet answered is "fetching", never "not requested": the request starts in the same commit.
            remote.kind === "idle"
            ? { kind: "fetching" }
            : remote;

  return { state, reload: () => setTick((t) => t + 1), refresh, canRefresh: mode === "remote" && canRefresh, refreshing };
}

export type CapabilitiesView = { server: ProviderCapability[] | "unreachable" | null };

/** The server's statement of what it can offer. null until asked; asked only when `enabled` and signed in. */
export function useProviderCapabilities(enabled: boolean, client: LiveIntelligenceClient = defaultClient): CapabilitiesView {
  const auth = useAuth();
  const [server, setServer] = useState<CapabilitiesView["server"]>(null);
  const authed = auth.status === "authenticated" ? auth.session : null;
  const workspaceId = authed?.workspaceId ?? null;
  const generation = authed?.generation ?? null;

  useEffect(() => {
    if (enabled) authStore.ensureChecked();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !workspaceId || !generation) return;
    let cancelled = false;
    void client.getCapabilities({ workspaceId, generation }).then((r) => {
      if (cancelled) return;
      if (r.kind === "ok") setServer(r.capabilities);
      else if (r.kind === "not_configured") setServer([]);
      else setServer("unreachable");
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, workspaceId, generation, client]);

  return { server };
}
