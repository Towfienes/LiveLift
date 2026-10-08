/**
 * "The wire": the call log as rows for a swimlane of LiveLift | SIMULATED Shopee | the host's app.
 *
 * A call carries its own reply (outcome and request_id); a host action sits on the host lane; a record LiveLift made
 * because of a call follows that call, so a read that noticed the host draws the return arrow and its record.
 */
import type { LabTrace } from "./lab";
import { fnv1a, type LedgerEntry } from "./shopeeLive";

export type ApiEntry = Extract<LedgerEntry, { kind: "api" }>;
export type HostEntry = Extract<LedgerEntry, { kind: "host_app" }>;

export type WireRow =
  | { kind: "call"; key: string; entry: ApiEntry; ok: boolean }
  | { kind: "host"; key: string; entry: HostEntry }
  | { kind: "record"; key: string; trace: LabTrace };

/**
 * Rows in call order. Successful reads are routine and hidden unless asked for, except a read that noticed something
 * (it is the cause of a record) and a failed read (it is the evidence of a problem).
 */
export function wireRows(ledger: readonly LedgerEntry[], trace: readonly LabTrace[], opts: { showReads: boolean }): WireRow[] {
  const cause = new Set(trace.map((t) => t.seq));
  const rows: Array<{ seq: number; order: number; row: WireRow }> = [];
  for (const e of ledger) {
    if (e.kind === "host_app") {
      rows.push({ seq: e.seq, order: 0, row: { kind: "host", key: `h${e.seq}`, entry: e } });
      continue;
    }
    const ok = e.envelope.error === "";
    if (e.readOnly && ok && !opts.showReads && !cause.has(e.seq)) continue;
    rows.push({ seq: e.seq, order: 0, row: { kind: "call", key: `c${e.seq}`, entry: e, ok } });
  }
  trace.forEach((t, i) => rows.push({ seq: t.seq, order: 1 + i, row: { kind: "record", key: `r${i}`, trace: t } }));
  return rows.sort((a, b) => a.seq - b.seq || a.order - b.order).map((r) => r.row);
}

/** What was sent and what came back, as the wire's detail view shows it. */
export function callJson(entry: ApiEntry): string {
  return `POST ${entry.path}\n${JSON.stringify(entry.params, null, 2)}\n→ ${JSON.stringify(entry.envelope, null, 2)}`;
}

/** A short fingerprint of the whole call log: two runs of the same script show the same digest. */
export function ledgerDigest(ledger: readonly LedgerEntry[]): string {
  return fnv1a(JSON.stringify(ledger)).toString(16).padStart(8, "0");
}
