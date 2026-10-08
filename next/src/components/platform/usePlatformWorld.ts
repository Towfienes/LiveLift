"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@/contracts";
import { catalogFromProducts, createShopeeLiveSim, initialSyncState, type ShopeeLiveSim, type SyncState } from "@/lib/platform";

export interface PlatformNotice {
  id: number;
  atMs: number;
  code: string;
  summary: string;
}

/** Everything the rehearsal's simulated platform knows, kept beside (never inside) the show's own record. */
export interface PlatformWorld {
  sim: ShopeeLiveSim;
  sync: SyncState;
  notices: PlatformNotice[];
  nextNoticeId: number;
  auto: boolean;
}

const KEY = (sessionId: string): string => `livelift.platformSim.v1.${sessionId}`;
const NOTICE_LIMIT = 20;

export function freshWorld(session: Pick<Session, "products">): PlatformWorld {
  const sync = initialSyncState(session);
  return { sim: createShopeeLiveSim({ catalog: catalogFromProducts(session.products, sync.links) }), sync, notices: [], nextNoticeId: 1, auto: true };
}

function isWorld(value: unknown): value is PlatformWorld {
  const w = value as Partial<PlatformWorld> | null;
  return !!w && typeof w === "object" && !!w.sim && Array.isArray(w.sim.ledger) && Array.isArray(w.sim.catalog) && !!w.sync && Array.isArray(w.sync.links)
    && typeof w.sync.promotionRefused === "object" && Array.isArray(w.notices) && typeof w.auto === "boolean";
}

function load(sessionId: string): PlatformWorld | null {
  try {
    const raw = window.localStorage.getItem(KEY(sessionId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isWorld(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function save(sessionId: string, world: PlatformWorld): void {
  try {
    window.localStorage.setItem(KEY(sessionId), JSON.stringify(world));
  } catch {
    // Storage can be blocked or full. The rehearsal keeps working from memory; it just will not survive a reload.
  }
}

export function addNotices(world: PlatformWorld, atMs: number, items: Array<{ code: string; summary: string }>): PlatformWorld {
  if (items.length === 0) return world;
  let id = world.nextNoticeId;
  const added = items.map((n) => ({ id: id++, atMs, ...n }));
  return { ...world, notices: [...added.reverse(), ...world.notices].slice(0, NOTICE_LIMIT), nextNoticeId: id };
}

export function usePlatformWorld(session: Pick<Session, "id" | "products">): {
  world: PlatformWorld;
  /** Always the latest world, including changes made earlier in the same event handler. */
  latest: () => PlatformWorld;
  update: (fn: (w: PlatformWorld) => PlatformWorld) => PlatformWorld;
  reset: () => void;
} {
  const [world, setWorld] = useState<PlatformWorld>(() => freshWorld(session));
  const ref = useRef(world);
  const sessionId = session.id;

  useEffect(() => {
    const stored = load(sessionId);
    if (stored) {
      ref.current = stored;
      setWorld(stored);
    }
    // Only when the show changes: a re-render must never replace the live state with an older stored copy.
  }, [sessionId]);

  const update = useCallback(
    (fn: (w: PlatformWorld) => PlatformWorld): PlatformWorld => {
      const next = fn(ref.current);
      ref.current = next;
      setWorld(next);
      save(sessionId, next);
      return next;
    },
    [sessionId]
  );

  const reset = useCallback(() => {
    update(() => freshWorld(session));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, session.products]);

  return { world, latest: () => ref.current, update, reset };
}
