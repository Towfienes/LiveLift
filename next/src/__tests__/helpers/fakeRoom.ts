import { vi } from "vitest";
import type { Session } from "@/contracts";
import type { AuthorityReceipt, CommandEnvelope, RoomRead } from "@/contracts/authority";
import { setCapability } from "@/lib/client/capability";
import { applyCommand, createNextSession, createSession, type CommandBody } from "@/lib/domain";

/**
 * A TEST-ONLY stand-in for the room server, speaking exactly the frozen wire contract
 * (docs/phase2/contract.md) with the shared types and the Phase 1 engine. It exists so client behaviour can be
 * exercised end to end; it is not the backend and defines nothing the contract does not.
 *
 * Fault injection: `offline` (nothing is reachable), `loseNextResponses` (the command is COMMITTED but the response
 * never arrives — the case the client must treat as UNKNOWN), `dropNextPosts` (the request never reaches the room, so
 * nothing is committed and no receipt exists) and `onPost` (observe the world at the moment a command arrives).
 */

export interface FakeRoomOptions {
  roomId?: string;
  role?: "operator" | "viewer";
  actor?: { id: string; name: string };
  nowMs?: number;
}

type Logged = { fingerprint: string; receipt: AuthorityReceipt };

const fingerprint = (e: CommandEnvelope): string =>
  JSON.stringify([e.roomId, e.sessionId, e.expectedRevision, e.type, sortKeys(e.payload)]);

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, sortKeys(val)])
    );
  }
  return v;
}

export class FakeRoom {
  roomId: string;
  /** The one capability this room accepts, as `Authorization: Bearer <token>` (anything else is 401 `unauthorized`). */
  token = "cap-test-token";
  role: "operator" | "viewer";
  actor: { id: string; name: string };
  revision = 0;
  sessions: Session[] = [];
  nowMs: number;
  clockBehindByMs = 0;
  offline = false;
  loseNextResponses = 0;
  dropNextPosts = 0;
  onPost: ((envelope: CommandEnvelope) => void) | null = null;
  /** Every request seen, in order, for assertions. */
  requests: Array<{ method: string; path: string; body: unknown; authorization: string | null }> = [];
  private log = new Map<string, Logged>();

  /** The room assigns session ids; never one that is already in use. */
  private nextSessionId(): string {
    const used = this.sessions.map((s) => Number(/^real-(\d+)$/.exec(s.id)?.[1] ?? 0));
    return `real-${Math.max(0, ...used) + 1}`;
  }

  constructor(opts: FakeRoomOptions = {}) {
    this.roomId = opts.roomId ?? "room-1";
    this.role = opts.role ?? "operator";
    this.actor = opts.actor ?? { id: "actor-1", name: "Mai" };
    this.nowMs = opts.nowMs ?? Date.UTC(2026, 9, 6, 13, 0, 0);
  }

  posts(): CommandEnvelope[] {
    return this.requests.filter((r) => r.method === "POST").map((r) => r.body as CommandEnvelope);
  }

  /** Install this room as the global fetch for the duration of a test, and give the browser its capability. Returns a restore function. */
  install(): () => void {
    setCapability(this.token);
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => this.handle(String(input), init));
    return () => spy.mockRestore();
  }

  private json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }

  private async handle(url: string, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    const parsed = new URL(url, "http://room.test");
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : null;
    const authorization = new Headers(init?.headers).get("authorization");
    this.requests.push({ method, path: parsed.pathname + parsed.search, body, authorization });
    if (this.offline) throw new TypeError("Failed to fetch");
    if (authorization !== `Bearer ${this.token}`) {
      return this.json({ error: { code: "unauthorized", message: "A valid room capability is required." } }, 401);
    }

    if (method === "GET" && parsed.pathname === "/api/v3/room") {
      const after = parsed.searchParams.get("afterRevision");
      const common = {
        roomId: this.roomId,
        revision: this.revision,
        serverNowMs: this.nowMs,
        clockBehindByMs: this.clockBehindByMs,
        access: { actorId: this.actor.id, name: this.actor.name, role: this.role },
      };
      const read: RoomRead = after !== null && Number(after) === this.revision ? { ...common, changed: false } : { ...common, changed: true, sessions: this.sessions };
      return this.json(read);
    }

    const receiptMatch = /^\/api\/v3\/room\/commands\/(.+)$/.exec(parsed.pathname);
    if (method === "GET" && receiptMatch) {
      const found = this.log.get(decodeURIComponent(receiptMatch[1]));
      return found ? this.json({ receipt: found.receipt }) : this.json({ error: { code: "not_found", message: "No such command." } }, 404);
    }

    if (method === "POST" && parsed.pathname === "/api/v3/room/commands") {
      if (this.role !== "operator") return this.json({ error: { code: "forbidden", message: "Viewers cannot record commands." } }, 403);
      const envelope = body as CommandEnvelope;
      this.onPost?.(envelope);
      if (this.dropNextPosts > 0) {
        this.dropNextPosts -= 1;
        throw new TypeError("Failed to fetch"); // never arrived: nothing committed, no receipt
      }
      const res = this.execute(envelope);
      if (this.loseNextResponses > 0) {
        this.loseNextResponses -= 1;
        throw new TypeError("Failed to fetch"); // committed, but the answer never arrived
      }
      return this.json(res);
    }
    return this.json({ error: { message: "not found" } }, 404);
  }

  private reject(e: CommandEnvelope, code: string, message: string): AuthorityReceipt {
    return {
      commandId: e.commandId,
      type: e.type,
      outcome: "rejected",
      code,
      message,
      roomRevisionAfter: this.revision,
      sessionId: e.sessionId,
      sessionRevisionAfter: null,
      eventIds: [],
    };
  }

  /** One command transaction: duplicate check, revision check, domain transition, receipt. */
  private execute(e: CommandEnvelope): { receipt: AuthorityReceipt; duplicate: boolean } {
    const fp = fingerprint(e);
    const prior = this.log.get(e.commandId);
    if (prior) {
      return prior.fingerprint === fp
        ? { receipt: prior.receipt, duplicate: true }
        : { receipt: this.reject(e, "idempotency_conflict", "That command id was used for a different request."), duplicate: false };
    }
    const remember = (receipt: AuthorityReceipt): { receipt: AuthorityReceipt; duplicate: boolean } => {
      this.log.set(e.commandId, { fingerprint: fp, receipt });
      return { receipt, duplicate: false };
    };
    if (e.expectedRevision !== this.revision) return remember(this.reject(e, "stale_revision", "The room moved on since this was prepared."));

    const operator = { id: this.actor.id, name: this.actor.name, role: "lead" as const, isLead: true };
    const payload = e.payload as Record<string, unknown>;
    const commit = (session: Session, eventIds: string[] = []): { receipt: AuthorityReceipt; duplicate: boolean } => {
      this.revision += 1;
      this.sessions = this.sessions.some((s) => s.id === session.id) ? this.sessions.map((s) => (s.id === session.id ? session : s)) : [...this.sessions, session];
      return remember({
        commandId: e.commandId,
        type: e.type,
        outcome: "committed",
        code: null,
        message: null,
        roomRevisionAfter: this.revision,
        sessionId: session.id,
        sessionRevisionAfter: session.revision,
        eventIds,
      });
    };

    if (e.type === "create_session") {
      const p = payload as { title: string; timezone: string; plannedStartMs: number; objective?: string | null; accountLabel?: string | null; products?: Session["products"]; segments?: Session["plans"][0]["segments"]; cues?: Session["plans"][0]["cues"] };
      return commit(createSession({ id: this.nextSessionId(), environment: "REAL", operator, nowMs: this.nowMs, ...p }));
    }
    if (e.type === "create_next") {
      const source = this.sessions.find((s) => s.id === e.sessionId);
      if (!source) return remember(this.reject(e, "not_found", "No such show."));
      const p = payload as { title: string; plannedStartMs: number; changeIds: string[]; note: string };
      const made = createNextSession(source, { id: this.nextSessionId(), nowMs: this.nowMs, ...p });
      return made.ok ? commit({ ...made.session, operator }) : remember(this.reject(e, "invalid_state", made.reason));
    }

    const target = this.sessions.find((s) => s.id === e.sessionId);
    if (!target) return remember(this.reject(e, "not_found", "No such show."));
    if (e.type === "save_prepare") {
      if (target.lifecycle !== "planned" || target.baselineLocked) return remember(this.reject(e, "invalid_state", "The baseline is locked."));
      const p = payload as { title: string; timezone: string; objective: string | null; accountLabel: string | null; products: Session["products"]; plannedStartMs: number; segments: Session["plans"][0]["segments"]; cues: Session["plans"][0]["cues"] };
      const next: Session = {
        ...target,
        title: p.title,
        timezone: p.timezone,
        objective: p.objective,
        accountLabel: p.accountLabel,
        products: p.products,
        plans: [{ ...target.plans[0], plannedStartMs: p.plannedStartMs, segments: p.segments, cues: p.cues }, ...target.plans.slice(1)],
        revision: target.revision + 1,
        updatedAtMs: this.nowMs,
      };
      return commit(next);
    }
    if (e.type === "start_live" && this.sessions.some((s) => s.id !== target.id && s.lifecycle === "active")) {
      return remember(this.reject(e, "another_show_active", "Another REAL show is already running in this room."));
    }
    const result = applyCommand(target, { ...(payload as object), type: e.type, key: e.commandId, nowMs: this.nowMs } as CommandBody & { key: string; nowMs: number });
    if (result.receipt.outcome !== "committed") return remember(this.reject(e, result.receipt.code ?? "rejected", result.receipt.message ?? "Rejected."));
    return commit(result.session, result.receipt.eventIds);
  }

  /** Test setup: put an ended or running REAL show in the room without going through the wire. */
  seed(session: Session): void {
    this.sessions = [...this.sessions, session];
    this.revision += 1;
  }
}
