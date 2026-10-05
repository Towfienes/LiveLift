import { SessionSchema, type EnvironmentIdentity, type Session } from "@/contracts";
import { PACK_LIBRARY, snapshotProducts } from "@/fixtures/library";
import {
  SCENARIO_BY_ID,
  applyCommand,
  applyScriptStep,
  createNextSession,
  createSession,
  duplicateSession,
  seedSimulatorSessions,
  skipScriptStep,
  type CommandBase,
  type CommandBody,
  type CommandResult,
  type NextSessionResult,
  type ScenarioId,
  type ScriptStepResult,
} from "@/lib/domain";

/**
 * Local command authority for Phase 1.
 *
 * One browser/device is the authority. Every committed command updates the session, its events
 * and its receipt together, then is written to localStorage. This is NOT a shared/team database:
 * other browsers do not see it. REAL and SIMULATED sessions live in separate namespaces and a
 * REAL session can never be derived from a SIMULATED one.
 */

const SCHEMA_VERSION = 1;
const STORAGE_KEYS: Record<EnvironmentIdentity, string> = {
  REAL: "livelift.v3.REAL",
  SIMULATED: "livelift.v3.SIMULATED",
};

export type StorageHealth = "unknown" | "ok" | "unavailable" | "write_failed";

export interface StoreState {
  hydrated: boolean;
  sessions: Session[];
  storage: StorageHealth;
  /** Plain-language notices, e.g. data that could not be read and was set aside. */
  notices: string[];
  lastSavedAtMs: number | null;
}

const UNHYDRATED: StoreState = {
  hydrated: false,
  sessions: [],
  storage: "unknown",
  notices: [],
  lastSavedAtMs: null,
};

export type DispatchInput = CommandBody & Partial<Omit<CommandBase, "nowMs">> & { nowMs?: number };

export type StartingPoint =
  | { type: "blank" }
  | { type: "template" }
  | { type: "pack"; packId: string }
  | { type: "previous"; sourceId: string };

export interface NewSessionRequest {
  title: string;
  environment: EnvironmentIdentity;
  timezone: string;
  plannedStartMs: number;
  objective?: string | null;
  accountLabel?: string | null;
  start: StartingPoint;
}

export type EditResult = { ok: true; session: Session } | { ok: false; reason: string };

function readStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const probe = "livelift.v3.probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export class SessionStore {
  private state: StoreState = UNHYDRATED;
  private listeners = new Set<() => void>();
  private storage: Storage | null = null;
  private started = false;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StoreState => this.state;
  getServerSnapshot = (): StoreState => UNHYDRATED;

  private set(next: Partial<StoreState>): void {
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l();
  }

  /** Load both namespaces. Safe to call repeatedly; only the first call does work. */
  hydrate(): void {
    if (this.started) return;
    this.started = true;
    this.storage = readStorage();
    const notices: string[] = [];
    const sessions: Session[] = [];

    for (const env of ["REAL", "SIMULATED"] as const) {
      const loaded = this.loadNamespace(env, notices);
      sessions.push(...loaded);
    }
    this.state = {
      hydrated: true,
      sessions,
      storage: this.storage ? "ok" : "unavailable",
      notices,
      lastSavedAtMs: null,
    };
    if (this.storage) {
      this.persist("REAL");
      this.persist("SIMULATED");
      window.addEventListener("storage", this.onStorageEvent);
    } else {
      notices.push("Browser storage is unavailable. Work in this tab is not being saved.");
    }
    for (const l of this.listeners) l();
  }

  /** Discard in-memory state and read everything again from browser storage. */
  reloadFromStorage(): void {
    this.started = false;
    this.state = UNHYDRATED;
    this.hydrate();
  }

  private onStorageEvent = (event: StorageEvent): void => {
    const env = (Object.keys(STORAGE_KEYS) as EnvironmentIdentity[]).find((e) => STORAGE_KEYS[e] === event.key);
    if (!env) return;
    // Another tab committed. Converge on its stored state instead of overwriting it.
    const notices: string[] = [...this.state.notices];
    const reloaded = this.loadNamespace(env, notices, false);
    this.set({
      sessions: [...this.state.sessions.filter((s) => s.environment !== env), ...reloaded],
      notices,
    });
  };

  private loadNamespace(env: EnvironmentIdentity, notices: string[], seed = true): Session[] {
    const key = STORAGE_KEYS[env];
    const raw = this.storage?.getItem(key) ?? null;
    const reseed = (): Session[] => (env === "SIMULATED" && seed ? seedSimulatorSessions() : []);
    if (raw === null) return reseed();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.setAside(key, raw);
      notices.push(`Stored ${env} data could not be read. It was set aside, not deleted.`);
      return reseed();
    }
    const envelope = parsed as { v?: number; sessions?: unknown };
    if (envelope.v !== SCHEMA_VERSION || !Array.isArray(envelope.sessions)) {
      this.setAside(key, raw);
      notices.push(`Stored ${env} data uses an unsupported version. It was set aside, not deleted.`);
      return reseed();
    }
    const good: Session[] = [];
    let bad = 0;
    for (const item of envelope.sessions) {
      const result = SessionSchema.safeParse(item);
      if (result.success && result.data.environment === env) good.push(result.data);
      else {
        bad += 1;
        this.setAside(key, JSON.stringify(item));
      }
    }
    if (bad > 0) notices.push(`${bad} stored ${env} session${bad === 1 ? "" : "s"} could not be read and ${bad === 1 ? "was" : "were"} set aside.`);
    return good;
  }

  private setAside(key: string, raw: string): void {
    try {
      const qKey = `${key}.quarantine`;
      const existing = this.storage?.getItem(qKey);
      const list: string[] = existing ? (JSON.parse(existing) as string[]) : [];
      list.push(raw);
      this.storage?.setItem(qKey, JSON.stringify(list.slice(-10)));
    } catch {
      /* quarantine is best-effort */
    }
  }

  private persist(env: EnvironmentIdentity): void {
    if (!this.storage) return;
    try {
      const sessions = this.state.sessions.filter((s) => s.environment === env);
      this.storage.setItem(STORAGE_KEYS[env], JSON.stringify({ v: SCHEMA_VERSION, sessions }));
      this.state = { ...this.state, storage: "ok", lastSavedAtMs: Date.now() };
    } catch {
      this.state = { ...this.state, storage: "write_failed" };
    }
  }

  private commit(next: Session): void {
    const exists = this.state.sessions.some((s) => s.id === next.id);
    const sessions = exists
      ? this.state.sessions.map((s) => (s.id === next.id ? next : s))
      : [...this.state.sessions, next];
    this.state = { ...this.state, sessions };
    this.persist(next.environment);
    for (const l of this.listeners) l();
  }

  // ---- Queries -----------------------------------------------------------------------------

  getSession(id: string): Session | null {
    return this.state.sessions.find((s) => s.id === id) ?? null;
  }

  list(env?: EnvironmentIdentity): Session[] {
    return this.state.sessions.filter((s) => (env ? s.environment === env : true));
  }

  private nextId(env: EnvironmentIdentity): string {
    const prefix = env === "REAL" ? "real" : "sim";
    const used = this.state.sessions
      .map((s) => new RegExp(`^${prefix}-(\\d+)$`).exec(s.id))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => Number(m[1]));
    return `${prefix}-${(used.length > 0 ? Math.max(...used) : 0) + 1}`;
  }

  // ---- Commands ----------------------------------------------------------------------------

  /** Run a runtime command through the single local authority and persist the result. */
  dispatch(sessionId: string, input: DispatchInput): CommandResult | null {
    const session = this.getSession(sessionId);
    if (!session) return null;
    const result = applyCommand(session, { ...input, nowMs: input.nowMs ?? Date.now() });
    if (result.receipt.outcome === "committed" && !result.duplicate) {
      let next = result.session;
      // Starting a rehearsal by hand satisfies the script's opening "Start LIVE" step, so it is not offered again.
      if (input.type === "start_live" && next.environment === "SIMULATED" && next.scriptCursor === 0 && next.scenarioId) {
        const first = SCENARIO_BY_ID[next.scenarioId as ScenarioId]?.script[0];
        if (first?.id === "start") next = { ...next, scriptCursor: 1 };
      }
      this.commit(next);
    }
    return result;
  }

  /** Apply the next scripted rehearsal step (simulated sessions only). */
  applyNextScriptStep(sessionId: string): ScriptStepResult | null {
    const session = this.getSession(sessionId);
    if (!session) return null;
    if (session.environment !== "SIMULATED") return null;
    const result = applyScriptStep(session);
    if (result.session !== session) this.commit(result.session);
    return result;
  }

  skipNextScriptStep(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session || session.environment !== "SIMULATED") return;
    this.commit(skipScriptStep(session));
  }

  // ---- Prepare (before the baseline locks) ---------------------------------------------------

  /**
   * Edit a draft show. The updater receives an independent copy and returns nothing.
   * Allowed only before Start LIVE locks the baseline.
   */
  editDraft(
    sessionId: string,
    update: (draft: Session, alloc: { segmentId: () => string; cueId: () => string }) => void
  ): EditResult {
    const session = this.getSession(sessionId);
    if (!session) return { ok: false, reason: "That show does not exist." };
    if (session.lifecycle !== "planned" || session.baselineLocked) {
      return { ok: false, reason: "The baseline is locked. Changes during a show are explicit plan revisions." };
    }
    const draft = structuredClone(session);
    update(draft, {
      segmentId: () => `${draft.id}:s${++draft.seq.segment}`,
      cueId: () => `${draft.id}:c${++draft.seq.cue}`,
    });
    draft.revision += 1;
    draft.updatedAtMs = Date.now();
    this.commit(draft);
    return { ok: true, session: draft };
  }

  // ---- Creating shows ------------------------------------------------------------------------

  createSession(req: NewSessionRequest): Session {
    const id = this.nextId(req.environment);
    const nowMs = Date.now();
    const base = {
      id,
      title: req.title.trim(),
      environment: req.environment,
      timezone: req.timezone,
      plannedStartMs: req.plannedStartMs,
      nowMs,
      objective: req.objective ?? null,
      accountLabel: req.accountLabel ?? null,
    };

    let session: Session;
    if (req.start.type === "previous") {
      const source = this.getSession(req.start.sourceId);
      if (!source) throw new Error("The session to copy no longer exists.");
      if (source.environment !== req.environment) {
        throw new Error("REAL and SIMULATED shows are never mixed. Choose a source from the same environment.");
      }
      session = {
        ...duplicateSession(source, { id, title: base.title, plannedStartMs: base.plannedStartMs, nowMs }),
        objective: base.objective ?? source.objective,
        accountLabel: base.accountLabel ?? source.accountLabel,
      };
    } else if (req.start.type === "template") {
      const template = SCENARIO_BY_ID.buffered;
      const { segments, cues } = template.buildPlan(id);
      session = createSession({ ...base, products: snapshotProducts(template.productIds), segments, cues });
    } else if (req.start.type === "pack") {
      const packId = req.start.packId;
      const pack = PACK_LIBRARY.find((p) => p.id === packId);
      session = createSession({ ...base, products: snapshotProducts(pack?.productIds ?? []) });
    } else {
      session = createSession(base);
    }
    this.commit(session);
    return session;
  }

  /** Create the next show from an ended one and persist it. The source is never touched. */
  createNext(
    sourceId: string,
    input: { title: string; plannedStartMs: number; changeIds: string[]; note: string }
  ): NextSessionResult {
    const source = this.getSession(sourceId);
    if (!source) return { ok: false, reason: "That show does not exist." };
    const result = createNextSession(source, {
      id: this.nextId(source.environment),
      nowMs: Date.now(),
      ...input,
    });
    if (result.ok) this.commit(result.session);
    return result;
  }

  /** Remove all rehearsal sessions and regenerate the seeded ones. REAL data is never touched. */
  resetSimulator(): void {
    const real = this.state.sessions.filter((s) => s.environment === "REAL");
    this.state = { ...this.state, sessions: [...real, ...seedSimulatorSessions()] };
    this.persist("SIMULATED");
    for (const l of this.listeners) l();
  }
}

export const sessionStore = new SessionStore();
