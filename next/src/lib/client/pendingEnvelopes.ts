import type { CommandEnvelope } from "@/contracts/authority";

/**
 * The exact command envelope is written to browser storage BEFORE it is transmitted, so a lost
 * acknowledgement (closed tab, dropped connection, crash) can be reconciled afterwards through the
 * receipt endpoint. This is the only REAL command data kept locally: it is a pending request, never
 * authoritative state, and it is removed as soon as a receipt (committed or rejected) is known.
 *
 * A stored envelope is never re-POSTed automatically. An explicit retry reuses it unchanged — same
 * commandId, same expectedRevision, same payload — so the server can recognise it as the same intent.
 */

const STORAGE_KEY = "livelift.v3.remote.pending";
const VERSION = 1;

export interface PersistedPending {
  envelope: CommandEnvelope;
  /** Plain-language name of the operator's intent, e.g. "End LIVE". */
  label: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function isEnvelope(v: unknown): v is CommandEnvelope {
  return (
    isRecord(v) &&
    typeof v.commandId === "string" &&
    typeof v.roomId === "string" &&
    typeof v.expectedRevision === "number" &&
    typeof v.type === "string" &&
    isRecord(v.payload) &&
    (v.sessionId === null || typeof v.sessionId === "string")
  );
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function canPersistPending(): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const probe = `${STORAGE_KEY}.probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function loadPending(): PersistedPending[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== VERSION || !Array.isArray(parsed.pending)) return [];
    return parsed.pending.flatMap((item): PersistedPending[] =>
      isRecord(item) && isEnvelope(item.envelope) && typeof item.label === "string" ? [{ envelope: item.envelope, label: item.label }] : []
    );
  } catch {
    return [];
  }
}

/** Returns false when the browser refused the write; the caller must then not transmit. */
export function savePending(list: PersistedPending[]): boolean {
  const s = storage();
  if (!s) return false;
  try {
    if (list.length === 0) s.removeItem(STORAGE_KEY);
    else s.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, pending: list }));
    return true;
  } catch {
    return false;
  }
}
