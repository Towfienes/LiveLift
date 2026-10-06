import type { Session } from "@/contracts";
import type { AuthorityCommandBody, AuthorityReceipt, CommandEnvelope, RoomRead, RoomSnapshot } from "@/contracts/authority";
import { createAuthorityClient, type AuthorityClient } from "@/lib/client/authorityClient";
import { authorityNowMs, type AuthorityClockSample } from "@/lib/client/authorityTime";
import { subscribeCapability } from "@/lib/client/capability";
import { commandLabel, describeRejection } from "@/lib/client/commandText";
import { canPersistPending, loadPending, savePending, type PersistedPending } from "@/lib/client/pendingEnvelopes";

/**
 * Client of the REAL room authority (docs/phase2/contract.md, docs/phase2/ui.md).
 *
 * The server owns REAL state. This store only ever INSTALLS what the server returned:
 * - It never advances REAL state optimistically, never edits an installed session, and never installs an
 *   older revision over a newer one.
 * - It polls once a second while any REAL view is mounted and visible, with at most one request in flight.
 * - If contact fails, or more than 3 s pass since the last successful contact, the installed snapshot is kept
 *   but marked not-authoritative: `connection` leaves "connected", writes are refused and authority time freezes.
 * - A command's identity is its envelope. The exact envelope is persisted before it is sent. A lost response is
 *   UNKNOWN (never "failed"); unresolved commands are reconciled through the receipt endpoint and are never
 *   re-POSTed unless the operator explicitly retries the exact same envelope.
 *
 * Authoritative REAL session state is held in memory only. localStorage keeps just the pending envelopes
 * (see pendingEnvelopes.ts).
 */

export const POLL_INTERVAL_MS = 1000;
export const STALE_AFTER_MS = 3000;
const STALE_CHECK_MS = 500;
const RECONCILE_DELAY_MS = 1000;
/** After the last consumer leaves, keep polling briefly so moving between pages does not flicker the status. */
const IDLE_LINGER_MS = 1500;
/** Server-provided clock gaps up to this are noise, not a discontinuity worth surfacing. */
export const CLOCK_BEHIND_TOLERANCE_MS = 2000;

export type ConnectionState = "idle" | "connecting" | "connected" | "stale" | "disconnected";
export type AccessInfo = RoomRead["access"];

export interface InFlightCommand {
  commandId: string;
  label: string;
}

/** A command whose outcome is not known: it may or may not have been committed. */
export interface UnresolvedCommand {
  commandId: string;
  label: string;
  envelope: CommandEnvelope;
  /** Plain-language account of what is and is not known. */
  detail: string;
  lookup: "idle" | "checking" | "absent" | "failed";
  retrying: boolean;
}

/** A one-time message about a command that was unresolved and has now been settled (or set aside). */
export interface Resolution {
  id: string;
  commandId: string;
  label: string;
  tone: "ok" | "warn";
  text: string;
}

export interface RemoteState {
  /** At least one REAL view is mounted. */
  active: boolean;
  connection: ConnectionState;
  /** The last committed snapshot the server returned. Retained while stale. */
  snapshot: RoomSnapshot | null;
  access: AccessInfo | null;
  /** Informational: how far the server's raw clock trails time the authority already recorded (0 when none). Not part of display time. */
  clockBehindByMs: number;
  /**
   * Authentication, as far as the room has told us. "missing": this browser holds no capability (nothing was sent).
   * "rejected": the room answered 401/403 to the capability it holds. "unknown": not asked yet.
   */
  auth: "unknown" | "ok" | "missing" | "rejected";
  lastError: string | null;
  inflight: InFlightCommand | null;
  unresolved: UnresolvedCommand[];
  resolutions: Resolution[];
  /** Sessions the server confirmed creating that the installed snapshot does not contain yet. */
  awaitingSessionIds: string[];
}

const IDLE: RemoteState = {
  active: false,
  connection: "idle",
  snapshot: null,
  access: null,
  clockBehindByMs: 0,
  auth: "unknown",
  lastError: null,
  inflight: null,
  unresolved: [],
  resolutions: [],
  awaitingSessionIds: [],
};

export type CommandIntent = { body: AuthorityCommandBody; sessionId: string | null };

export type CommandOutcome =
  /** The authority committed the command. `viewCurrent` is false if the fresh snapshot could not be fetched yet. */
  | { status: "committed"; receipt: AuthorityReceipt; duplicate: boolean; viewCurrent: boolean }
  /** The authority refused the command. Nothing was recorded. */
  | { status: "rejected"; code: string | null; message: string; receipt: AuthorityReceipt | null }
  /** The response was lost. The command may have been committed. Reconcile before acting again. */
  | { status: "unknown"; commandId: string; message: string }
  /** The client declined to send. Nothing was transmitted. */
  | { status: "refused"; code: "not_connected" | "read_only" | "busy" | "unresolved" | "not_saved"; message: string };

export interface RemoteStoreDeps {
  client?: AuthorityClient;
  /** Monotonic milliseconds (performance.now). Injected for tests. */
  perfNow?: () => number;
  newCommandId?: () => string;
}

const defaultPerfNow = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

function defaultCommandId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `cmd-${crypto.randomUUID()}`;
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
  return `cmd-${bytes}`;
}

/** Keep the previous object for any session whose recorded revision did not move, so unchanged views do not re-render. */
function reuseSessions(prev: RoomSnapshot | null, next: Session[]): Session[] {
  if (!prev) return next;
  const before = new Map(prev.sessions.map((s) => [s.id, s]));
  return next.map((s) => {
    const old = before.get(s.id);
    return old && old.revision === s.revision && old.updatedAtMs === s.updatedAtMs && old.events.length === s.events.length && old.lifecycle === s.lifecycle ? old : s;
  });
}

export class RemoteRoomStore {
  private state: RemoteState = IDLE;
  private listeners = new Set<() => void>();
  private client: AuthorityClient;
  private perfNow: () => number;
  private newCommandId: () => string;

  private consumers = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeCapability: (() => void) | null = null;
  private pollInFlight: Promise<void> | null = null;
  private reconciling: Promise<void> | null = null;
  private lastPollStartedPerf = 0;
  private forceFull = false;

  /** Monotonic bookkeeping that changes every poll. Kept out of `state` so unchanged polls do not re-render the app. */
  private clock: AuthorityClockSample | null = null;
  private frozenAtPerfMs: number | null = null;
  private lastContactPerfMs: number | null = null;

  private pendingEnvelopes = new Map<string, PersistedPending>();
  private pendingLoaded = false;
  private seq = 0;

  constructor(deps: RemoteStoreDeps = {}) {
    this.client = deps.client ?? createAuthorityClient();
    this.perfNow = deps.perfNow ?? defaultPerfNow;
    this.newCommandId = deps.newCommandId ?? defaultCommandId;
  }

  // ---- External-store plumbing --------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): RemoteState => this.state;
  getServerSnapshot = (): RemoteState => IDLE;

  /** Apply a change and notify only if something observable actually changed. */
  private patch(partial: Partial<RemoteState>): void {
    let changed = false;
    for (const key of Object.keys(partial) as Array<keyof RemoteState>) {
      if (!Object.is(this.state[key], partial[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) l();
  }

  // ---- Lifecycle ----------------------------------------------------------------------------------

  /** A REAL view is on screen. Polling runs while at least one holder exists. Returns the release function. */
  acquire(): () => void {
    this.consumers += 1;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (!this.state.active) this.start();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.consumers -= 1;
      if (this.consumers === 0) {
        this.stopTimer = setTimeout(() => {
          this.stopTimer = null;
          if (this.consumers === 0) this.stop();
        }, IDLE_LINGER_MS);
      }
    };
  }

  private start(): void {
    this.loadPersistedPending();
    this.patch({ active: true, connection: this.state.snapshot ? "stale" : "connecting" });
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onForeground);
    if (typeof window !== "undefined") {
      window.addEventListener("focus", this.onForeground);
      window.addEventListener("online", this.onForeground);
      window.addEventListener("pageshow", this.onForeground);
    }
    this.staleTimer = setInterval(this.checkStale, STALE_CHECK_MS);
    this.unsubscribeCapability = subscribeCapability(this.onCapabilityChanged);
    if (this.isHidden()) return; // polling begins when the view is foregrounded
    void this.poll();
  }

  private stop(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.staleTimer) clearInterval(this.staleTimer);
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.pollTimer = this.staleTimer = this.reconcileTimer = null;
    this.unsubscribeCapability?.();
    this.unsubscribeCapability = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onForeground);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.onForeground);
      window.removeEventListener("online", this.onForeground);
      window.removeEventListener("pageshow", this.onForeground);
    }
    // Contact is no longer being confirmed, so what is shown cannot be called current.
    this.freezeClock();
    this.patch({ active: false, connection: this.state.snapshot ? "stale" : "idle" });
  }

  private isHidden(): boolean {
    return typeof document !== "undefined" && document.visibilityState === "hidden";
  }

  private onForeground = (): void => {
    if (!this.state.active || this.isHidden()) return;
    void this.refreshNow();
  };

  /**
   * A different capability may mean a different identity and role, so what was installed under the previous one is
   * not carried over: the room is read again from scratch. Pending envelopes are kept (they carry no credential).
   */
  private onCapabilityChanged = (): void => {
    if (!this.state.active) return;
    this.clock = null;
    this.frozenAtPerfMs = null;
    this.lastContactPerfMs = null;
    this.forceFull = true;
    this.patch({ snapshot: null, access: null, clockBehindByMs: 0, connection: "connecting", auth: "unknown", lastError: null, awaitingSessionIds: [] });
    void this.refreshNow();
  };

  private checkStale = (): void => {
    if (this.state.connection !== "connected" || this.lastContactPerfMs === null) return;
    if (this.perfNow() - this.lastContactPerfMs > STALE_AFTER_MS) {
      this.freezeClock();
      this.patch({ connection: "stale", lastError: "No contact with the room for more than 3 seconds." });
    }
  };

  private freezeClock(): void {
    if (this.frozenAtPerfMs === null && this.clock) this.frozenAtPerfMs = this.perfNow();
  }

  /**
   * Forget everything this tab knows about the room and drop the locally kept pending envelopes. For sign-out
   * and tests: it never touches the room itself, so an unresolved command is NOT resolved by calling it.
   */
  reset(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.staleTimer) clearInterval(this.staleTimer);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.pollTimer = this.staleTimer = this.stopTimer = this.reconcileTimer = null;
    this.unsubscribeCapability?.();
    this.unsubscribeCapability = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onForeground);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.onForeground);
      window.removeEventListener("online", this.onForeground);
      window.removeEventListener("pageshow", this.onForeground);
    }
    this.consumers = 0;
    this.pollInFlight = null;
    this.reconciling = null;
    this.forceFull = false;
    this.clock = null;
    this.frozenAtPerfMs = null;
    this.lastContactPerfMs = null;
    this.pendingEnvelopes.clear();
    this.pendingLoaded = false;
    savePending([]);
    this.state = IDLE;
    for (const l of this.listeners) l();
  }

  // ---- Polling ------------------------------------------------------------------------------------

  /** Poll now (or join the poll already in flight). At most one request is ever outstanding. */
  refreshNow(): Promise<void> {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    return this.poll();
  }

  private poll(): Promise<void> {
    if (this.pollInFlight) return this.pollInFlight;
    const run = this.doPoll().finally(() => {
      this.pollInFlight = null;
      this.scheduleNext();
    });
    this.pollInFlight = run;
    return run;
  }

  private async doPoll(): Promise<void> {
    const started = this.perfNow();
    this.lastPollStartedPerf = started;
    const after = this.forceFull ? null : (this.state.snapshot?.revision ?? null);
    this.forceFull = false;
    const res = await this.client.getRoom({ afterRevision: after });
    const ended = this.perfNow();
    if (res.ok) this.applyRead(res.read, (started + ended) / 2, ended);
    else this.applyFailure(res.message, res.status, res.kind);
  }

  private scheduleNext(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    if (!this.state.active || this.isHidden()) return;
    const wait = this.forceFull ? 0 : Math.max(0, POLL_INTERVAL_MS - (this.perfNow() - this.lastPollStartedPerf));
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      if (this.isHidden()) return; // a hidden view does not poll; foregrounding polls at once
      void this.poll();
    }, wait);
  }

  private applyRead(read: RoomRead, midPerfMs: number, endPerfMs: number): void {
    const prev = this.state.snapshot;
    let snapshot = prev;
    if (read.changed) {
      // Never install an older revision over a newer snapshot (e.g. a reordered or replayed response).
      if (!prev || prev.roomId !== read.roomId || read.revision >= prev.revision) {
        snapshot = { roomId: read.roomId, revision: read.revision, sessions: reuseSessions(prev, read.sessions) };
      }
    } else if (!prev || prev.roomId !== read.roomId || prev.revision !== read.revision) {
      // "Unchanged" must refer to what we hold. If it does not, ask for the full snapshot; keep what we have meanwhile.
      this.forceFull = true;
    }

    this.clock = { serverNowMs: read.serverNowMs, receivedPerfMs: midPerfMs };
    this.frozenAtPerfMs = null;
    this.lastContactPerfMs = endPerfMs;
    const reconnected = this.state.connection !== "connected";
    const present = new Set(snapshot?.sessions.map((s) => s.id) ?? []);
    const awaiting = this.state.awaitingSessionIds.filter((id) => !present.has(id));
    this.patch({
      connection: "connected",
      snapshot,
      access: read.access,
      clockBehindByMs: read.clockBehindByMs,
      auth: "ok",
      lastError: null,
      awaitingSessionIds: awaiting.length === this.state.awaitingSessionIds.length ? this.state.awaitingSessionIds : awaiting,
    });
    if (reconnected && this.state.unresolved.length > 0) this.scheduleReconcile(0);
  }

  private applyFailure(message: string, status: number | null, kind?: string): void {
    this.freezeClock();
    const auth: RemoteState["auth"] | null = kind === "unauthenticated" ? "missing" : status === 401 || status === 403 ? "rejected" : null;
    this.patch({
      connection: this.state.snapshot ? "stale" : "disconnected",
      ...(auth ? { auth } : {}),
      lastError:
        auth === "missing"
          ? "Enter this room's capability to connect."
          : auth === "rejected"
            ? "The room did not accept the capability this browser holds."
            : message,
    });
  }

  // ---- Time ---------------------------------------------------------------------------------------

  /** The authority's corrected "now" (`serverNowMs` + monotonic elapsed), frozen while not connected. */
  authorityNow(): number | null {
    return this.clock ? authorityNowMs(this.clock, this.perfNow(), this.frozenAtPerfMs) : null;
  }

  /** Milliseconds since the last successful contact, or null if there has been none. */
  lastContactAgeMs(): number | null {
    return this.lastContactPerfMs === null ? null : Math.max(0, this.perfNow() - this.lastContactPerfMs);
  }

  /** The loaded snapshot belongs to the authority and is current: writes may be attempted. */
  isAuthoritative(): boolean {
    return this.state.connection === "connected" && this.state.snapshot !== null;
  }

  // ---- Commands -----------------------------------------------------------------------------------

  /**
   * Send ONE operator intent to the authority. Resolves only when the outcome is known (committed / rejected),
   * known to be unknown, or the client declined to send. Nothing in `snapshot` changes until the server says so.
   */
  async submit(intent: CommandIntent): Promise<CommandOutcome> {
    const { snapshot, access } = this.state;
    const label = commandLabel(intent.body.type);
    if (!snapshot || this.state.connection !== "connected") {
      return { status: "refused", code: "not_connected", message: `Not connected to the room, so what is shown may be out of date. ${label} was not sent.` };
    }
    if (access?.role !== "operator") {
      return { status: "refused", code: "read_only", message: describeRejection("forbidden", null, access?.role ?? null) };
    }
    if (this.state.inflight) {
      return { status: "refused", code: "busy", message: `Still waiting for “${this.state.inflight.label}” to be confirmed. Nothing else was sent.` };
    }
    if (this.state.unresolved.length > 0) {
      return {
        status: "refused",
        code: "unresolved",
        message: `The outcome of “${this.state.unresolved[0].label}” is not known yet. Resolve it before sending anything else.`,
      };
    }
    if (!canPersistPending()) {
      return { status: "refused", code: "not_saved", message: "This browser cannot keep a record of the pending action, so it was not sent. Nothing was recorded." };
    }

    const { type, ...payload } = intent.body;
    const envelope = {
      commandId: this.newCommandId(),
      roomId: snapshot.roomId,
      sessionId: intent.sessionId,
      expectedRevision: snapshot.revision,
      type,
      payload,
    } as CommandEnvelope;
    return this.transmit(envelope, label);
  }

  /** Persist the exact envelope, send it, and settle the answer. Also used for an explicit retry of the same envelope. */
  private async transmit(envelope: CommandEnvelope, label: string): Promise<CommandOutcome> {
    this.pendingEnvelopes.set(envelope.commandId, { envelope, label });
    if (!savePending([...this.pendingEnvelopes.values()])) {
      this.pendingEnvelopes.delete(envelope.commandId);
      return { status: "refused", code: "not_saved", message: "This browser could not record the pending action, so it was not sent. Nothing was recorded." };
    }
    this.patch({ inflight: { commandId: envelope.commandId, label } });
    const result = await this.client.postCommand(envelope);
    this.patch({ inflight: null });

    if (result.kind === "response") {
      const receipt = result.response.receipt;
      if (receipt.commandId !== envelope.commandId) {
        return this.markUnknown(envelope, label, "The room answered with a receipt for a different command.");
      }
      return this.settleReceipt(envelope.commandId, receipt, result.response.duplicate);
    }
    if (result.kind === "refused") {
      // The server refused before executing anything: this is a definite "not recorded".
      this.forgetPending(envelope.commandId);
      const code = result.code ?? (result.status === 409 ? "stale_revision" : null);
      if (result.status === 401) this.applyFailure("", 401);
      if (code === "stale_revision") await this.refreshNow();
      return { status: "rejected", code, message: describeRejection(code, result.message, this.state.access?.role ?? null), receipt: null };
    }
    return this.markUnknown(envelope, label, result.message);
  }

  /** A receipt (from the POST, a duplicate answer, or a lookup) turns the command into a known outcome. */
  private async settleReceipt(commandId: string, receipt: AuthorityReceipt, duplicate: boolean): Promise<CommandOutcome> {
    this.forgetPending(commandId);
    if (receipt.outcome === "rejected") {
      if (receipt.code === "stale_revision") await this.refreshNow();
      return { status: "rejected", code: receipt.code, message: describeRejection(receipt.code, receipt.message, this.state.access?.role ?? null), receipt };
    }
    // Committed. A receipt is not the new state: fetch a snapshot at or past the commit before reporting it.
    if (receipt.sessionId) this.patch({ awaitingSessionIds: [...new Set([...this.state.awaitingSessionIds, receipt.sessionId])] });
    const viewCurrent = await this.refreshUntil(receipt.roomRevisionAfter);
    return { status: "committed", receipt, duplicate, viewCurrent };
  }

  /** Poll until an installed snapshot is at or beyond `revision`. A poll already in flight may predate the commit. */
  private async refreshUntil(revision: number, attempts = 3): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      await this.refreshNow();
      if ((this.state.snapshot?.revision ?? -1) >= revision) return true;
      if (this.state.connection !== "connected") return false;
    }
    return false;
  }

  private markUnknown(envelope: CommandEnvelope, label: string, why: string): CommandOutcome {
    const entry: UnresolvedCommand = {
      commandId: envelope.commandId,
      label,
      envelope,
      detail: `${why} “${label}” may or may not have been recorded.`,
      lookup: "idle",
      retrying: false,
    };
    this.patch({ unresolved: [...this.state.unresolved.filter((u) => u.commandId !== envelope.commandId), entry] });
    this.scheduleReconcile(RECONCILE_DELAY_MS);
    void this.refreshNow();
    return { status: "unknown", commandId: envelope.commandId, message: entry.detail };
  }

  private forgetPending(commandId: string): void {
    this.pendingEnvelopes.delete(commandId);
    savePending([...this.pendingEnvelopes.values()]);
    if (this.state.unresolved.some((u) => u.commandId === commandId)) {
      this.patch({ unresolved: this.state.unresolved.filter((u) => u.commandId !== commandId) });
    }
  }

  private loadPersistedPending(): void {
    if (this.pendingLoaded) return;
    this.pendingLoaded = true;
    const stored = loadPending();
    if (stored.length === 0) return;
    const unresolved: UnresolvedCommand[] = stored.map((p) => {
      this.pendingEnvelopes.set(p.envelope.commandId, p);
      return {
        commandId: p.envelope.commandId,
        label: p.label,
        envelope: p.envelope,
        detail: `“${p.label}” was interrupted before its outcome was known. It may or may not have been recorded.`,
        lookup: "idle",
        retrying: false,
      };
    });
    this.patch({ unresolved: [...this.state.unresolved, ...unresolved] });
  }

  // ---- Reconciliation (receipt lookup — never a re-POST) -------------------------------------------

  private scheduleReconcile(delayMs: number): void {
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      void this.reconcile();
    }, delayMs);
  }

  /** Ask the authority what happened to each unresolved command. Read-only: nothing is sent again. */
  reconcile(): Promise<void> {
    if (this.reconciling) return this.reconciling;
    const run = this.doReconcile().finally(() => {
      this.reconciling = null;
    });
    this.reconciling = run;
    return run;
  }

  private setUnresolved(commandId: string, change: Partial<UnresolvedCommand>): void {
    this.patch({ unresolved: this.state.unresolved.map((u) => (u.commandId === commandId ? { ...u, ...change } : u)) });
  }

  private async doReconcile(): Promise<void> {
    for (const entry of [...this.state.unresolved]) {
      if (entry.retrying) continue;
      this.setUnresolved(entry.commandId, { lookup: "checking" });
      const res = await this.client.getReceipt(entry.commandId);
      if (res.kind === "found") {
        const outcome = await this.settleReceipt(entry.commandId, res.receipt, true);
        this.addResolution(
          entry,
          outcome.status === "committed" ? "ok" : "warn",
          outcome.status === "committed"
            ? `“${entry.label}” was confirmed: the room did record it.`
            : `“${entry.label}” was not accepted by the room: ${outcome.status === "rejected" ? outcome.message : "rejected"}`
        );
      } else if (res.kind === "absent") {
        this.setUnresolved(entry.commandId, {
          lookup: "absent",
          detail: `The room has no record of “${entry.label}”. That does not prove it failed. It has not been sent again.`,
        });
      } else {
        this.setUnresolved(entry.commandId, { lookup: "failed", detail: `Could not check “${entry.label}” yet: ${res.message}` });
      }
    }
  }

  /** Operator action: look the commands up again now. */
  checkUnresolved(): Promise<void> {
    return this.reconcile();
  }

  /**
   * Operator action: send the exact same envelope again (same commandId, same expectedRevision, same payload).
   * If the original was committed the server answers with the original receipt; if the room moved on it rejects
   * the command as stale and nothing is applied twice.
   */
  async retryUnresolved(commandId: string): Promise<CommandOutcome> {
    const entry = this.state.unresolved.find((u) => u.commandId === commandId);
    if (!entry) return { status: "refused", code: "unresolved", message: "That action is no longer waiting." };
    if (!this.isAuthoritative()) {
      return { status: "refused", code: "not_connected", message: "Not connected to the room, so the action was not sent again." };
    }
    if (this.state.access?.role !== "operator") {
      return { status: "refused", code: "read_only", message: describeRejection("forbidden", null, this.state.access?.role ?? null) };
    }
    if (this.state.inflight) return { status: "refused", code: "busy", message: "Another action is still being confirmed." };
    this.setUnresolved(commandId, { retrying: true });
    const outcome = await this.transmit(entry.envelope, entry.label);
    // `transmit` already cleared the entry on a known outcome; on a second unknown it re-created it (retrying: false).
    if (outcome.status === "committed" || outcome.status === "rejected") {
      this.addResolution(
        entry,
        outcome.status === "committed" ? "ok" : "warn",
        outcome.status === "committed" ? `“${entry.label}” is confirmed.` : `“${entry.label}” was not accepted: ${outcome.message}`
      );
    } else {
      this.setUnresolved(commandId, { retrying: false });
    }
    return outcome;
  }

  /**
   * Operator action: stop waiting on an unresolved command. The outcome stays UNKNOWN — this does not mean it
   * failed. The room's snapshot remains the only truth about what was recorded.
   */
  dismissUnresolved(commandId: string): void {
    const entry = this.state.unresolved.find((u) => u.commandId === commandId);
    if (!entry) return;
    this.forgetPending(commandId);
    this.addResolution(entry, "warn", `“${entry.label}” was set aside with its outcome still unknown. Check the show history to see whether it was recorded.`);
  }

  private addResolution(entry: UnresolvedCommand, tone: Resolution["tone"], text: string): void {
    this.seq += 1;
    this.patch({ resolutions: [...this.state.resolutions, { id: `res-${this.seq}`, commandId: entry.commandId, label: entry.label, tone, text }] });
  }

  dismissResolution(id: string): void {
    this.patch({ resolutions: this.state.resolutions.filter((r) => r.id !== id) });
  }
}

export const remoteRoomStore = new RemoteRoomStore();
