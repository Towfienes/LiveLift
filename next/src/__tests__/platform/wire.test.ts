import { describe, expect, it } from "vitest";
import { createScenarioSession } from "@/lib/domain";
import { applyLabCommands, callJson, initialLabState, ledgerDigest, wireRows, type LabCommand, type WireRow } from "@/lib/platform";

const STORY: LabCommand[] = [
  { kind: "show", body: { type: "start_live" } },
  { kind: "sync" },
  { kind: "pin", productId: "prod_m02" },
  { kind: "host", action: { type: "pin_item", itemId: 100002 } },
  { kind: "sync" },
  { kind: "fault", fault: "token_expired" },
  { kind: "sync" },
];

const run = () => applyLabCommands(initialLabState(createScenarioSession("buffered")), STORY);
const label = (r: WireRow): string =>
  r.kind === "call" ? `call:${r.entry.endpoint}:${r.ok ? "ok" : r.entry.envelope.error}` : r.kind === "host" ? `host:${r.entry.action}` : `record:${r.trace.source}`;

describe("the wire", () => {
  it("shows writes, host actions, the read that noticed the host and the record it led to, in call order", () => {
    const s = run();
    const rows = wireRows(s.world.sim.ledger, s.trace, { showReads: false }).map(label);
    expect(rows).toEqual([
      "call:create_session:ok",
      "call:add_item_list:ok",
      "call:start_session:ok",
      "call:create_promotion:ok",
      // Zip Hoodie is already in the live bag, so the pin needs no add_item_list first.
      "call:update_show_item:ok",
      "record:request_accepted",
      "host:pin_item",
      "call:get_session_detail:ok",
      "record:provider_observed",
      "call:get_promotion_list:error_auth",
      "call:get_session_detail:error_auth",
      "call:get_item_list:error_auth",
    ]);
  });

  it("the return arrow follows the exact read that noticed the change", () => {
    const s = run();
    const rows = wireRows(s.world.sim.ledger, s.trace, { showReads: false });
    const i = rows.findIndex((r) => r.kind === "record" && r.trace.source === "provider_observed");
    const read = rows[i - 1];
    expect(read.kind === "call" && read.entry.seq).toBe(s.trace.find((t) => t.source === "provider_observed")!.seq);
  });

  it("every call carries its basis, outcome and request id; routine reads appear when asked", () => {
    const s = run();
    const all = wireRows(s.world.sim.ledger, s.trace, { showReads: true });
    const calls = all.filter((r): r is Extract<WireRow, { kind: "call" }> => r.kind === "call");
    expect(calls.length).toBe(s.world.sim.ledger.filter((e) => e.kind === "api").length);
    expect(calls.every((c) => /^[0-9a-f]{32}$/.test(c.entry.envelope.request_id))).toBe(true);
    expect(calls.find((c) => c.entry.endpoint === "update_show_item")!.entry.basis).toBe("documented");
    expect(calls.find((c) => c.entry.endpoint === "create_session")!.entry.basis).toBe("inferred");
  });

  it("a call's JSON shows what was sent and what came back", () => {
    const s = run();
    const pin = s.world.sim.ledger.find((e) => e.kind === "api" && e.endpoint === "update_show_item");
    expect(pin?.kind).toBe("api");
    if (pin?.kind !== "api") return;
    const json = callJson(pin);
    expect(json.startsWith("POST /api/v2/livestream/update_show_item\n")).toBe(true);
    expect(json).toContain('"item_id": 100001');
    expect(json).toContain(`"request_id": "${pin.envelope.request_id}"`);
  });

  it("the digest is the same for the same run and different for a different one", () => {
    expect(ledgerDigest(run().world.sim.ledger)).toBe(ledgerDigest(run().world.sim.ledger));
    expect(ledgerDigest(run().world.sim.ledger)).toMatch(/^[0-9a-f]{8}$/);
    const other = applyLabCommands(run(), [{ kind: "sync" }]);
    expect(ledgerDigest(other.world.sim.ledger)).not.toBe(ledgerDigest(run().world.sim.ledger));
  });
});
