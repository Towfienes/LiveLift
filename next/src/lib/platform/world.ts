/**
 * Everything a rehearsal's simulated platform knows, kept beside (never inside) the show's own record.
 * Pure data and helpers: the Operate panel persists it per show, the Platform Lab keeps it in memory.
 */
import type { Session } from "@/contracts";
import { createShopeeLiveSim, type ShopeeLiveSim } from "./shopeeLive";
import { catalogFromProducts, initialSyncState, type SyncState } from "./sync";

export interface PlatformNotice {
  id: number;
  atMs: number;
  code: string;
  summary: string;
}

export interface PlatformWorld {
  sim: ShopeeLiveSim;
  sync: SyncState;
  notices: PlatformNotice[];
  nextNoticeId: number;
  auto: boolean;
}

const NOTICE_LIMIT = 20;

export function freshWorld(session: Pick<Session, "products">): PlatformWorld {
  const sync = initialSyncState(session);
  return { sim: createShopeeLiveSim({ catalog: catalogFromProducts(session.products, sync.links) }), sync, notices: [], nextNoticeId: 1, auto: true };
}

export function addNotices(world: PlatformWorld, atMs: number, items: Array<{ code: string; summary: string }>): PlatformWorld {
  if (items.length === 0) return world;
  let id = world.nextNoticeId;
  const added = items.map((n) => ({ id: id++, atMs, ...n }));
  return { ...world, notices: [...added.reverse(), ...world.notices].slice(0, NOTICE_LIMIT), nextNoticeId: id };
}
