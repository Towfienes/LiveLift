/**
 * The room capability this browser presents to the authority.
 *
 * The backend authenticates `Authorization: Bearer <room capability>` only. There is no login, signup or role
 * management here: an operator or viewer pastes the capability they were given, and the authority decides what it
 * allows (a viewer capability stays read-only server-side).
 *
 * Handling rules:
 * - The token is attached to requests in ONE place (`authorityClient`), as a header. It is never put in a URL,
 *   a command envelope or payload, domain history, a log line or an error message.
 * - It lives in this tab's `sessionStorage` only (cleared when the tab closes, never shared across tabs, never in
 *   `localStorage`), so a reload keeps an interrupted command reconcilable without leaving a credential at rest.
 */

const STORAGE_KEY = "livelift.v3.capability";

let memory: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function session(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    memory = session()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    memory = null;
  }
}

const emit = (): void => {
  for (const l of listeners) l();
};

/** The active capability, or null when this browser holds none. */
export function getCapability(): string | null {
  load();
  return memory;
}

/** Use `token` as the active capability. Whitespace is trimmed; blank clears it. */
export function setCapability(token: string): void {
  load();
  const next = token.trim();
  memory = next === "" ? null : next;
  try {
    if (memory === null) session()?.removeItem(STORAGE_KEY);
    else session()?.setItem(STORAGE_KEY, memory);
  } catch {
    // Storage refused: the capability still works for this page's lifetime from memory.
  }
  emit();
}

export function clearCapability(): void {
  setCapability("");
}

export function subscribeCapability(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Forget the cached copy so the next read comes from storage again. For tests. */
export function resetCapabilityCache(): void {
  loaded = false;
  memory = null;
}
