import { SessionSchema, type Session } from "@/contracts";
import type { AuthorityReceipt, CommandEnvelope, CommandResponse, RoomRead } from "@/contracts/authority";
import { getCapability } from "./capability";

/**
 * Typed HTTP client for the frozen Phase 2 authority endpoints (docs/phase2/contract.md):
 *
 *   GET  /api/v3/room[?afterRevision=N]
 *   POST /api/v3/room/commands
 *   GET  /api/v3/room/commands/{commandId}
 *
 * Wire types come from `@/contracts/authority`; nothing is redefined here. The client never decides what
 * a failure MEANS for a command: it only reports what it saw. In particular a timeout, a dropped connection or
 * a 5xx during a POST is `unknown` — the server may or may not have committed — and is never reported as rejected.
 *
 * Every request carries the active room capability as `Authorization: Bearer <capability>`, attached here and
 * nowhere else (never in a URL, body, message or log). With no capability nothing is sent: that is the
 * `unauthenticated` state, reported as such rather than as a network failure.
 */

export const ROOM_PATH = "/api/v3/room";
export const COMMANDS_PATH = "/api/v3/room/commands";

export type TransportKind = "network" | "timeout" | "http" | "malformed" | "unauthenticated";

export interface TransportFailure {
  ok: false;
  kind: TransportKind;
  /** HTTP status when a response arrived. */
  status: number | null;
  message: string;
}

export type ReadResult = { ok: true; read: RoomRead } | TransportFailure;

export type PostResult =
  /** The server answered with a receipt (committed, rejected or a duplicate of an earlier command). */
  | { kind: "response"; response: CommandResponse; status: number }
  /** The server refused the request before executing anything (HTTP 4xx without a receipt). */
  | { kind: "refused"; status: number; code: string | null; message: string }
  /** The request may or may not have been executed. The outcome is UNKNOWN, not failed. */
  | { kind: "unknown"; reason: TransportKind; status: number | null; message: string };

export type ReceiptResult =
  | { kind: "found"; receipt: AuthorityReceipt }
  /** No receipt on record. This is NOT evidence that the command failed. */
  | { kind: "absent" }
  | { kind: "failed"; reason: TransportKind; status: number | null; message: string };

export interface AuthorityClientOptions {
  fetchImpl?: typeof fetch;
  /** Abort a request after this long. Must be shorter than the 3 s staleness window to keep polling honest. */
  timeoutMs?: number;
  baseUrl?: string;
  /** Where the active capability comes from. Defaults to this tab's capability (`./capability`). */
  getCapability?: () => string | null;
}

export interface AuthorityClient {
  getRoom(opts?: { afterRevision?: number | null }): Promise<ReadResult>;
  postCommand(envelope: CommandEnvelope): Promise<PostResult>;
  getReceipt(commandId: string): Promise<ReceiptResult>;
}

const DEFAULT_TIMEOUT_MS = 2500;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function isReceipt(v: unknown): v is AuthorityReceipt {
  return (
    isRecord(v) &&
    typeof v.commandId === "string" &&
    typeof v.type === "string" &&
    (v.outcome === "committed" || v.outcome === "rejected") &&
    typeof v.roomRevisionAfter === "number" &&
    Array.isArray(v.eventIds)
  );
}

function parseRoomRead(body: unknown): RoomRead | null {
  if (!isRecord(body)) return null;
  const access = body.access;
  if (
    typeof body.roomId !== "string" ||
    typeof body.revision !== "number" ||
    typeof body.serverNowMs !== "number" ||
    typeof body.clockBehindByMs !== "number" ||
    typeof body.changed !== "boolean" ||
    !isRecord(access) ||
    typeof access.actorId !== "string" ||
    typeof access.name !== "string" ||
    (access.role !== "operator" && access.role !== "viewer")
  ) {
    return null;
  }
  const common = {
    roomId: body.roomId,
    revision: body.revision,
    serverNowMs: body.serverNowMs,
    clockBehindByMs: Math.max(0, body.clockBehindByMs),
    access: { actorId: access.actorId, name: access.name, role: access.role === "viewer" ? ("viewer" as const) : ("operator" as const) },
  };
  if (!body.changed) return { ...common, changed: false };
  const parsed = SessionSchema.array().safeParse(body.sessions);
  if (!parsed.success) return null;
  const sessions: Session[] = parsed.data;
  return { ...common, changed: true, sessions };
}

function messageOf(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    if (typeof body.message === "string") return body.message;
    if (isRecord(body.error) && typeof body.error.message === "string") return body.error.message;
    if (typeof body.error === "string") return body.error;
  }
  return fallback;
}

function codeOf(body: unknown, status: number): string | null {
  if (isRecord(body)) {
    if (typeof body.code === "string") return body.code;
    if (isRecord(body.error) && typeof body.error.code === "string") return body.error.code;
  }
  return status === 401 ? "unauthorized" : status === 403 ? "forbidden" : null;
}

export function createAuthorityClient(options: AuthorityClientOptions = {}): AuthorityClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = options.baseUrl ?? "";

  /** One bounded request. Never throws: transport trouble is a value. */
  async function send(path: string, init: RequestInit): Promise<{ ok: true; status: number; body: unknown } | TransportFailure> {
    const fetchImpl = options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
    if (!fetchImpl) return { ok: false, kind: "network", status: null, message: "This browser cannot make network requests." };
    const token = (options.getCapability ?? getCapability)();
    if (!token) return { ok: false, kind: "unauthenticated", status: null, message: "This browser holds no room capability, so nothing was sent." };
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const res = await fetchImpl(`${base}${path}`, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${token}` },
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      let body: unknown = null;
      try {
        const text = await res.text();
        body = text === "" ? null : (JSON.parse(text) as unknown);
      } catch {
        body = undefined; // present but not JSON
      }
      return { ok: true, status: res.status, body };
    } catch {
      return timedOut
        ? { ok: false, kind: "timeout", status: null, message: "The room server did not answer in time." }
        : { ok: false, kind: "network", status: null, message: "The room server could not be reached." };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async getRoom(opts = {}) {
      const after = opts.afterRevision;
      const query = after === null || after === undefined ? "" : `?afterRevision=${encodeURIComponent(String(after))}`;
      const res = await send(`${ROOM_PATH}${query}`, { method: "GET", headers: { accept: "application/json" } });
      if (!res.ok) return res;
      if (res.status < 200 || res.status >= 300) {
        return { ok: false, kind: "http", status: res.status, message: messageOf(res.body, `The room server answered ${res.status}.`) };
      }
      const read = parseRoomRead(res.body);
      if (!read) return { ok: false, kind: "malformed", status: res.status, message: "The room server sent a response LiveLift could not trust." };
      return { ok: true, read };
    },

    async postCommand(envelope) {
      const res = await send(COMMANDS_PATH, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(envelope),
      });
      // Never transmitted without a capability: a definite "not sent", not an unknown outcome.
      if (!res.ok && res.kind === "unauthenticated") return { kind: "refused", status: 401, code: "unauthorized", message: res.message };
      if (!res.ok) return { kind: "unknown", reason: res.kind, status: res.status, message: res.message };
      const body = res.body;
      if (isRecord(body) && isReceipt(body.receipt)) {
        return { kind: "response", status: res.status, response: { receipt: body.receipt, duplicate: body.duplicate === true } };
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 408) {
        return { kind: "refused", status: res.status, code: codeOf(body, res.status), message: messageOf(body, `The room server refused the request (${res.status}).`) };
      }
      // 2xx without a receipt, 5xx, 408 or an unreadable body: the server may have committed. UNKNOWN.
      const ok2xx = res.status >= 200 && res.status < 300;
      return {
        kind: "unknown",
        reason: ok2xx ? "malformed" : "http",
        status: res.status,
        message: ok2xx ? "The room server answered without a receipt." : messageOf(body, `The room server answered ${res.status} before confirming the command.`),
      };
    },

    async getReceipt(commandId) {
      const res = await send(`${COMMANDS_PATH}/${encodeURIComponent(commandId)}`, { method: "GET", headers: { accept: "application/json" } });
      if (!res.ok) return { kind: "failed", reason: res.kind, status: res.status, message: res.message };
      if (res.status === 404) return { kind: "absent" };
      if (res.status >= 200 && res.status < 300) {
        const body = res.body;
        const receipt = isRecord(body) && isReceipt(body.receipt) ? body.receipt : isReceipt(body) ? body : null;
        if (receipt) return { kind: "found", receipt };
        return { kind: "failed", reason: "malformed", status: res.status, message: "The receipt lookup answered with something LiveLift could not trust." };
      }
      return { kind: "failed", reason: "http", status: res.status, message: messageOf(res.body, `The receipt lookup answered ${res.status}.`) };
    },
  };
}
