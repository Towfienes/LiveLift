import { fixtureDeskView, fixtureStartView, noopDeskActions, noopStartActions } from "./fixtures";
import type { LiveDeskActions, LiveDeskViewModel, StartActions, StartViewModel } from "./types";

/**
 * The only door the screens use. This stub returns fixtures so every screen compiles and renders from day one.
 * WP5a replaces the bodies with the real engine and adapter; the signatures do not change.
 */

export function useStartFlow(): { view: StartViewModel; actions: StartActions } {
  return { view: fixtureStartView(), actions: noopStartActions };
}

/** `null` view means the live id is unknown; the screen shows the usual not-found state. */
export function useLiveDesk(liveId: string): { view: LiveDeskViewModel | null; actions: LiveDeskActions } {
  return { view: liveId ? fixtureDeskView() : null, actions: noopDeskActions };
}
