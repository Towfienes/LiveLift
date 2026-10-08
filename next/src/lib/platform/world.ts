/**
 * Everything a rehearsal's simulated platform knows, kept beside (never inside) the show's own record.
 * Pure data and helpers: the Operate panel persists it per show, the Platform Lab keeps it in memory.
 */
import type { Session } from "@/contracts";
import { createShopeeLiveSim, readEntry, type ReadEntry, type ShopeeLiveSim, type ShopeeRead } from "./shopeeLive";
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
  /** LiveLift's reads, kept apart from the platform's call log. Absent in a world saved before the read log existed. */
  readLog?: ReadLog;
}

/** The read log: reads oldest first, bounded on its own, and the next read's number. */
export interface ReadLog {
  entries: ReadEntry[];
  next: number;
}

const NOTICE_LIMIT = 20;
export const READ_LOG_LIMIT = 120;

export function freshWorld(session: Pick<Session, "products">): PlatformWorld {
  const sync = initialSyncState(session);
  return {
    sim: createShopeeLiveSim({ catalog: catalogFromProducts(session.products, sync.links) }),
    sync, notices: [], nextNoticeId: 1, auto: true, readLog: { entries: [], next: 1 },
  };
}

/** Keep reads in the read log. Its bound is its own: however often LiveLift polls, no write leaves the call log for it. */
export function logReads(world: PlatformWorld, reads: readonly ShopeeRead[]): PlatformWorld {
  if (reads.length === 0) return world;
  const log = world.readLog ?? { entries: [], next: 1 };
  const entries = reads.map((r, i) => readEntry(r, log.next + i));
  return { ...world, readLog: { entries: [...log.entries, ...entries].slice(-READ_LOG_LIMIT), next: log.next + reads.length } };
}

/** The reads to show, oldest first. */
export const readsOf = (world: PlatformWorld): ReadEntry[] => world.readLog?.entries ?? [];

export function addNotices(world: PlatformWorld, atMs: number, items: Array<{ code: string; summary: string }>): PlatformWorld {
  if (items.length === 0) return world;
  let id = world.nextNoticeId;
  const added = items.map((n) => ({ id: id++, atMs, ...n }));
  return { ...world, notices: [...added.reverse(), ...world.notices].slice(0, NOTICE_LIMIT), nextNoticeId: id };
}
