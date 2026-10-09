import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  acceptSuggestionAction, advance, buildDeskView, buildStartView, connect, dismissSuggestionAction, endLive, importSamplePack, importText,
  pin, removeProduct, reset, setRunning, setSpeed, skip, startLive, unpin, type DeskState,
} from "./session";
import { getDeskState, getServerDeskState, setDeskState, subscribeDesk, updateDesk } from "./store";
import type { LiveDeskActions, LiveDeskViewModel, StartActions, StartViewModel } from "./types";

/**
 * The only door the screens use. Both hooks share one SIMULATED desk state (see store.ts) and hand the screens view
 * models built by session.ts; every action goes back through session.ts. The signatures are the contract.
 */

/** How often the running clock wakes, in real milliseconds, and the most virtual seconds one wake may play. */
const TICK_MS = 250;
const MAX_SECONDS_PER_TICK = 300;

const useDeskState = (): DeskState => useSyncExternalStore(subscribeDesk, getDeskState, getServerDeskState);

export function useStartFlow(): { view: StartViewModel; actions: StartActions } {
  const state = useDeskState();
  const view = useMemo(() => buildStartView(state), [state]);
  const actions = useMemo<StartActions>(() => ({
    onConnect: () => updateDesk(connect),
    onImportText: (text) => updateDesk((s) => importText(s, text)),
    onImportSamplePack: () => updateDesk(importSamplePack),
    onRemoveProduct: (productId) => updateDesk((s) => removeProduct(s, productId)),
    onStartLive: () => {
      const r = startLive(getDeskState());
      setDeskState(r.state);
      return r.liveId;
    },
  }), []);
  return { view, actions };
}

/** `null` view means the live id is unknown; the screen shows the usual not-found state. */
export function useLiveDesk(liveId: string): { view: LiveDeskViewModel | null; actions: LiveDeskActions } {
  const state = useDeskState();
  const view = useMemo(() => (liveId ? buildDeskView(state, liveId) : null), [state, liveId]);
  const mine = state.live !== null && state.live.id === liveId;
  const running = mine && state.live?.mode === "live" && state.live.running;
  const speed = mine ? state.live?.speed ?? 1 : 1;

  // The clock plays whole virtual seconds; how they are batched never changes what happens.
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let carry = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      carry += (now - last) * speed;
      last = now;
      const seconds = Math.min(MAX_SECONDS_PER_TICK, Math.floor(carry / 1000));
      if (seconds <= 0) return;
      carry = Math.min(carry - seconds * 1000, 1000);
      updateDesk((s) => (s.live?.id === liveId ? advance(s, seconds) : s));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, speed, liveId]);

  const actions = useMemo<LiveDeskActions>(() => {
    const onThis = (change: (s: DeskState) => DeskState): void => updateDesk((s) => (s.live?.id === liveId ? change(s) : s));
    return {
      onRun: () => onThis((s) => setRunning(s, true)),
      onPause: () => onThis((s) => setRunning(s, false)),
      onSpeed: (speed) => onThis((s) => setSpeed(s, speed)),
      onSkip: (seconds) => onThis((s) => skip(s, seconds)),
      onReset: () => onThis(reset),
      onPin: (productId) => onThis((s) => pin(s, productId)),
      onUnpin: () => onThis(unpin),
      onAcceptSuggestion: (id) => onThis((s) => acceptSuggestionAction(s, id)),
      onDismissSuggestion: (id) => onThis((s) => dismissSuggestionAction(s, id)),
      onEndLive: () => onThis(endLive),
    };
  }, [liveId]);
  return { view, actions };
}
