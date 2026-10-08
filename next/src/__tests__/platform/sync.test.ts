import { describe, expect, it } from "vitest";
import { SCENARIO_START_MS, applyCommand, createScenarioSession, currentPlan } from "@/lib/domain";
import type { Session } from "@/contracts";
import {
  acceptedReason, catalogFromProducts, createShopeeLiveSim, diffSnapshots, hostAct, importableItems, inboundActions, initialSyncState,
  ongoingSession, pinFromLiveLift, pollPlatform, productFromItem, reconcileOutbound, reportCommand, schedulePromotions,
  syncCycle, unpinFromLiveLift, withAssumptions, withFault, type ShopeeLiveSim, type SyncState,
} from "@/lib/platform";

const T = SCENARIO_START_MS;

function started(): Session {
  const planned = createScenarioSession("buffered");
  const r = applyCommand(planned, { type: "start_live", nowMs: 0 });
  expect(r.receipt.outcome).toBe("committed");
  return r.session;
}

function world(session: Session, assumptions?: Parameters<typeof withAssumptions>[1]): { sim: ShopeeLiveSim; sync: SyncState } {
  const sync = initialSyncState(session);
  let sim = createShopeeLiveSim({ catalog: catalogFromProducts(session.products, sync.links) });
  if (assumptions) sim = withAssumptions(sim, assumptions);
  return { sim, sync };
}

/** The show is active, and LiveLift has opened and loaded the platform live. */
function connected(assumptions?: Parameters<typeof withAssumptions>[1]) {
  const session = started();
  const w = world(session, assumptions);
  const out = reconcileOutbound(w.sim, session, w.sync, T);
  expect(out.blocked).toBeNull();
  return { session, sim: out.sim, sync: out.sync };
}

const pinnedProduct = (session: Session): string => currentPlan(session).cues.find((c) => c.action === "pin_product")!.productId!;

describe("outbound: opening the live", () => {
  it("creates the live, loads the planned products, then goes live", () => {
    const session = started();
    const w = world(session);
    const out = reconcileOutbound(w.sim, session, w.sync, T);
    expect(out.calls.map((c) => c.endpoint)).toEqual(["create_session", "add_item_list", "start_session"]);
    expect(out.calls.every((c) => c.ok)).toBe(true);
    expect(out.sync.providerSessionId).not.toBeNull();
    const live = ongoingSession(out.sim)!;
    expect(live.origin).toBe("api");
    expect(live.items.length).toBeGreaterThan(0);
  });

  it("does nothing before the show starts and is idempotent afterwards", () => {
    const planned = createScenarioSession("buffered");
    const w = world(planned);
    expect(reconcileOutbound(w.sim, planned, w.sync, T).calls).toEqual([]);
    const c = connected();
    expect(reconcileOutbound(c.sim, c.session, c.sync, T).calls).toEqual([]);
  });

  it("stops at the first refusal and says why, without half-opening a live", () => {
    const session = started();
    const w = world(session);
    const out = reconcileOutbound(withFault(w.sim, "region_unsupported"), session, w.sync, T);
    expect(out.calls).toHaveLength(1);
    expect(out.blocked).toMatchObject({ endpoint: "create_session", ok: false, message: "The API is not supported for current region" });
    expect(out.sync.providerSessionId).toBeNull();
    expect(ongoingSession(out.sim)).toBeNull();
  });

  it("ends the platform live when the show ends", () => {
    const c = connected();
    const ended = applyCommand(c.session, { type: "end_live", nowMs: 0 }).session;
    expect(ended.lifecycle).toBe("ended");
    const out = reconcileOutbound(c.sim, ended, c.sync, T);
    expect(out.calls.map((x) => x.endpoint)).toEqual(["end_session"]);
    expect(ongoingSession(out.sim)).toBeNull();
  });
});

describe("outbound: pin from LiveLift", () => {
  it("pins through update_show_item and is recorded against the planned cue, still unverified", () => {
    const c = connected();
    const productId = pinnedProduct(c.session);
    const pin = pinFromLiveLift(c.sim, c.sync, productId, T);
    expect(pin.outcome.ok).toBe(true);
    expect(ongoingSession(pin.sim)?.showingItemId).toBe(c.sync.links.find((l) => l.productId === productId)!.itemId);

    const reason = acceptedReason((pin.outcome as { requestId: string }).requestId);
    const command = reportCommand(c.session, "pin_product", productId, "performed", reason);
    expect(command.type).toBe("report_cue");
    const applied = applyCommand(c.session, { ...command, nowMs: 0 });
    expect(applied.receipt.outcome).toBe("committed");
    expect(applied.session.events.at(-1)?.summary).toContain("platform verification unknown");
  });

  it("an echo of its own pin is never reported back as observed", () => {
    const c = connected();
    const pin = pinFromLiveLift(c.sim, c.sync, pinnedProduct(c.session), T);
    const again = pollPlatform(pin.sim, pin.sync, T + 5000);
    expect(diffSnapshots(pin.sync.last, again.snapshot)).toEqual([]);
  });

  it("a refused pin is an attempt with the platform's own words, not a performed action", () => {
    const c = connected();
    const pin = pinFromLiveLift(withFault(c.sim, "token_expired"), c.sync, pinnedProduct(c.session), T);
    expect(pin.outcome).toMatchObject({ ok: false, reason: "api_error", message: "You are not authorized" });
    expect(ongoingSession(pin.sim)?.showingItemId).toBeNull();
  });

  it("refuses to guess an unpin endpoint", () => {
    expect(unpinFromLiveLift()).toMatchObject({ ok: false, reason: "unsupported" });
  });

  it("needs a linked live", () => {
    const session = started();
    const w = world(session);
    expect(pinFromLiveLift(w.sim, w.sync, pinnedProduct(session), T).outcome).toMatchObject({ ok: false, reason: "no_live" });
  });
});

describe("inbound: what the host does in the app lands in LiveLift", () => {
  it("a pin in the app becomes the planned cue's report, labelled provider observed", () => {
    const c = connected();
    const productId = pinnedProduct(c.session);
    const itemId = c.sync.links.find((l) => l.productId === productId)!.itemId;
    const hosted = hostAct(c.sim, T + 1000, { type: "pin_item", itemId });
    expect(hosted.ok).toBe(true);

    const polled = pollPlatform(hosted.sim, c.sync, T + 2000);
    const observations = diffSnapshots(c.sync.last, polled.snapshot);
    expect(observations).toEqual([{ kind: "showing_changed", from: { state: "none" }, to: { state: "item", itemId } }]);

    const [action] = inboundActions(c.session, c.sync, observations);
    expect(action.kind).toBe("command");
    if (action.kind !== "command") return;
    expect(action.command).toMatchObject({ type: "report_cue", report: "performed" });
    const applied = applyCommand(c.session, { ...action.command, nowMs: 0 });
    expect(applied.receipt.outcome).toBe("committed");
    expect(JSON.stringify(applied.session.events.at(-1))).toContain("Provider observed (SIMULATED)");
  });

  it("an unplanned pin is recorded as an unplanned action", () => {
    const c = connected();
    const planned = pinnedProduct(c.session);
    const other = c.sync.links.find((l) => l.productId !== planned && c.session.products.find((p) => p.id === l.productId)?.status === "enabled")!;
    let sim = hostAct(c.sim, T, { type: "add_live_item", itemId: other.itemId }).sim;
    sim = hostAct(sim, T, { type: "pin_item", itemId: other.itemId }).sim;
    const polled = pollPlatform(sim, c.sync, T + 1000);
    const actions = inboundActions(c.session, c.sync, diffSnapshots(c.sync.last, polled.snapshot));
    const command = actions.find((a) => a.kind === "command");
    expect(command && command.kind === "command" && command.command).toMatchObject({ type: "report_manual_action", action: "pin_product", productId: other.productId });
  });

  it("an unpin in the app is seen as an unpin", () => {
    const c = connected();
    const pinned = pinFromLiveLift(c.sim, c.sync, pinnedProduct(c.session), T);
    const hosted = hostAct(pinned.sim, T + 1000, { type: "unpin_item" });
    const polled = pollPlatform(hosted.sim, pinned.sync, T + 2000);
    const actions = inboundActions(c.session, pinned.sync, diffSnapshots(pinned.sync.last, polled.snapshot));
    // The show planned this unpin, so it is the planned cue that gets reported.
    expect(actions[0]).toMatchObject({ kind: "command", command: { type: "report_cue", report: "performed", cueId: expect.stringContaining("unpin") } });
  });

  it("items added by the host that LiveLift has no product for are an offer, never an import", () => {
    const c = connected();
    const stranger = { itemId: 200001, shopId: c.sim.account.shopId, name: "Bucket Hat", price: 99000, currency: "VND" };
    let sim = hostAct(c.sim, T, { type: "add_catalog_item", item: stranger }).sim;
    sim = hostAct(sim, T, { type: "add_live_item", itemId: 200001 }).sim;
    const polled = pollPlatform(sim, c.sync, T + 1000);
    const actions = inboundActions(c.session, c.sync, diffSnapshots(c.sync.last, polled.snapshot));
    expect(actions).toEqual([{ kind: "notice", code: "unknown_item", summary: expect.stringContaining("no product for") }]);
    const offer = importableItems(sim.catalog, c.sync.links);
    expect(offer.map((o) => o.name)).toEqual(["Bucket Hat"]);
    expect(productFromItem(offer[0])).toMatchObject({ name: "Bucket Hat", source: "import", price: 99000, currency: "VND" });
  });

  it("when the platform does not say what is pinned, LiveLift says so once and invents nothing", () => {
    const c = connected({ detailExposesShowingItem: false });
    expect(c.sync.last?.showing).toEqual({ state: "unobservable" });
    const productId = pinnedProduct(c.session);
    const itemId = c.sync.links.find((l) => l.productId === productId)!.itemId;
    const sim = hostAct(c.sim, T, { type: "pin_item", itemId }).sim;
    const polled = pollPlatform(sim, c.sync, T + 1000);
    expect(diffSnapshots(c.sync.last, polled.snapshot)).toEqual([]);
  });

  it("a failed read is unknown, not 'nothing changed'", () => {
    const c = connected();
    const polled = pollPlatform(withFault(c.sim, "rate_limited"), c.sync, T + 1000);
    expect(polled.snapshot.problem).toMatchObject({ error: "error_server" });
    expect(diffSnapshots(c.sync.last, polled.snapshot)).toEqual([]);
  });

  it("a live ended on the platform is a notice: LiveLift never ends the show itself", () => {
    const c = connected();
    const sim = hostAct(c.sim, T, { type: "end_live" }).sim;
    const polled = pollPlatform(sim, c.sync, T + 1000);
    const actions = inboundActions(c.session, c.sync, diffSnapshots(c.sync.last, polled.snapshot));
    expect(actions).toEqual([{ kind: "notice", code: "live_ended_on_platform", summary: expect.stringContaining("never ends it for you") }]);
  });
});

describe("promotions: an anchor becomes a scheduled promotion", () => {
  it("schedules the flash sale once, at its committed time", () => {
    const session = started();
    const w = world(session);
    const early = T - 3600_000;
    const out = schedulePromotions(w.sim, session, w.sync, early);
    expect(out.calls.map((x) => x.endpoint)).toEqual(["create_promotion"]);
    expect(out.sim.promotions).toHaveLength(1);
    expect(out.sim.promotions[0].startMs).toBeGreaterThan(T);
    expect(schedulePromotions(out.sim, session, out.sync, early).calls).toEqual([]);
  });

  it("reports a refusal instead of pretending", () => {
    const session = started();
    const w = world(session);
    const out = schedulePromotions(w.sim, session, w.sync, T + 3 * 3600_000);
    expect(out.blocked).toMatchObject({ endpoint: "create_promotion", ok: false });
    expect(out.sim.promotions).toHaveLength(0);
    // Remembered, so the next sync does not retry it behind the operator's back.
    expect(Object.values(out.sync.promotionRefused)).toHaveLength(1);
    expect(schedulePromotions(out.sim, session, out.sync, T + 3 * 3600_000).calls).toEqual([]);
  });
});

describe("syncCycle: read first, then write, and never echo", () => {
  it("opens the live, picks up a host pin once, and then goes quiet", () => {
    const session = started();
    const w = world(session);
    const first = syncCycle(session, w.sim, w.sync, T);
    expect(first.calls.map((c) => c.endpoint)).toEqual(["create_session", "add_item_list", "start_session", "create_promotion"]);
    expect(first.commands).toEqual([]);

    const productId = pinnedProduct(session);
    const itemId = first.sync.links.find((l) => l.productId === productId)!.itemId;
    const hosted = hostAct(first.sim, T + 1000, { type: "pin_item", itemId });
    const second = syncCycle(session, hosted.sim, first.sync, T + 2000);
    expect(second.commands).toHaveLength(1);
    expect(second.notices.map((n) => n.code)).toEqual(["observed"]);

    const third = syncCycle(session, second.sim, second.sync, T + 3000);
    expect(third.commands).toEqual([]);
    expect(third.notices).toEqual([]);
    expect(third.calls).toEqual([]);
  });

  it("tells the operator about a platform problem once, and again only when it clears", () => {
    const session = started();
    const w = world(session);
    const broken = syncCycle(session, withFault(w.sim, "token_expired"), w.sync, T);
    expect(broken.notices.map((n) => n.code)).toContain("platform_problem");
    const again = syncCycle(session, broken.sim, broken.sync, T + 1000);
    expect(again.notices.map((n) => n.code)).not.toContain("platform_problem");
    const healed = syncCycle(session, withFault(again.sim, null), again.sync, T + 2000);
    expect(healed.sync.providerSessionId).not.toBeNull();
    expect(healed.notices.map((n) => n.code)).toContain("platform_recovered");
  });

  it("does nothing for a show that has not started", () => {
    const planned = createScenarioSession("buffered");
    const w = world(planned);
    const out = syncCycle(planned, w.sim, w.sync, T);
    expect(out.calls).toEqual([]);
    expect(out.sim.ledger).toEqual([]);
  });
});
