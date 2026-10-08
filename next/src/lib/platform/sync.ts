/**
 * The two-way bridge between a LiveLift show and a platform live.
 *
 * Outbound (LiveLift -> platform): open the live, put the show's products in it, pin, schedule promotions.
 * Inbound  (platform -> LiveLift): read what the platform now shows and turn each change into an ordinary,
 * labelled LiveLift record, so a pin the host made in the app lands in Review like any other action.
 *
 * Rules this file keeps:
 * - It only issues a call the capability table allows. Where there is no API the answer is `unsupported`, and the
 *   operator acts natively and reports it as before.
 * - An accepted API call is recorded as "performed" with the request id, and the existing record keeps saying
 *   `platform verification unknown`: an accepted request is not the platform confirming what viewers see.
 * - A refused call is recorded as "attempted" with the platform's own message, never as performed.
 * - What LiveLift changes itself is never reported back to it as "observed": every outbound step re-reads the platform
 *   and stores that as the new baseline.
 * - Pure functions only. State in, state out; the caller persists it and dispatches the commands.
 */
import type { ProductSnapshot, Session } from "@/contracts";
import { currentPlan, type CommandBody } from "@/lib/domain";
import { canCallApi } from "./capabilities";
import {
  SIM_SHOP_ID, callShopee, promotionStatus,
  type ShopeeEndpoint, type ShopeeLiveSim, type SimItem, type SimSessionStatus,
} from "./shopeeLive";

// ---- Product links ---------------------------------------------------------------------------------------------------

export interface ProductLink {
  productId: string;
  itemId: number;
  shopId: number;
}

export interface SyncState {
  /** The platform's live that this show is tied to. null until one is opened or linked. */
  providerSessionId: number | null;
  links: ProductLink[];
  /** What LiveLift last read. The next read is compared with this. */
  last: PlatformSnapshot | null;
  /** LiveLift segment id -> platform promotion id, so a promotion is scheduled once. */
  promotions: Record<string, number>;
}

const FIRST_ITEM_ID = 100001;

/** Deterministic links for a show's pack: the demo shop sells exactly the products the show plans to use. */
export function linkProducts(products: readonly ProductSnapshot[], shopId: number = SIM_SHOP_ID): ProductLink[] {
  return products.map((p, i) => ({ productId: p.id, itemId: FIRST_ITEM_ID + i, shopId }));
}

export function catalogFromProducts(products: readonly ProductSnapshot[], links: readonly ProductLink[]): SimItem[] {
  return links.flatMap((link) => {
    const p = products.find((x) => x.id === link.productId);
    return p ? [{ itemId: link.itemId, shopId: link.shopId, name: p.name, price: p.price, currency: p.currency }] : [];
  });
}

export function initialSyncState(session: Pick<Session, "products">): SyncState {
  return { providerSessionId: null, links: linkProducts(session.products), last: null, promotions: {} };
}

/** A platform item that LiveLift has no product for: shown as an offer to import, never imported silently. */
export function importableItems(catalog: readonly SimItem[], links: readonly ProductLink[]): SimItem[] {
  const known = new Set(links.map((l) => l.itemId));
  return catalog.filter((c) => !known.has(c.itemId));
}

export function productFromItem(item: SimItem): ProductSnapshot {
  const words = item.name.split(/\s+/).filter(Boolean);
  return {
    id: `shopee_${item.itemId}`,
    code: `SHP-${item.itemId}`,
    name: item.name,
    price: item.price,
    currency: item.currency,
    priority: "normal",
    status: "enabled",
    talkingPoints: [],
    constraints: [],
    initials: (words[0]?.[0] ?? "P") + (words[1]?.[0] ?? ""),
    source: "import",
  };
}

const linkOfProduct = (sync: SyncState, productId: string): ProductLink | undefined => sync.links.find((l) => l.productId === productId);
const linkOfItem = (sync: SyncState, itemId: number): ProductLink | undefined => sync.links.find((l) => l.itemId === itemId);

/** The enabled products the current plan actually uses, in pack order. */
export function plannedProductIds(session: Session): string[] {
  const plan = currentPlan(session);
  const used = new Set<string>();
  for (const s of plan.segments) if (s.productId) used.add(s.productId);
  for (const c of plan.cues) if (c.productId) used.add(c.productId);
  return session.products.filter((p) => p.status === "enabled" && used.has(p.id)).map((p) => p.id);
}

// ---- Reading the platform --------------------------------------------------------------------------------------------

export type Showing = { state: "item"; itemId: number } | { state: "none" } | { state: "unobservable" };

export interface PlatformSnapshot {
  takenAtMs: number;
  providerSessionId: number | null;
  status: SimSessionStatus | null;
  itemIds: number[];
  showing: Showing;
  promotions: Array<{ id: number; name: string; startMs: number; endMs: number }>;
  /** The first read that failed. A failed read is "unknown", never "nothing changed". */
  problem: { error: string; message: string } | null;
}

export function pollPlatform(sim: ShopeeLiveSim, sync: SyncState, nowMs: number): { sim: ShopeeLiveSim; snapshot: PlatformSnapshot } {
  let cur = sim;
  let problem: PlatformSnapshot["problem"] = null;
  const read = (endpoint: ShopeeEndpoint, params: Record<string, unknown>): Record<string, unknown> | null => {
    const r = callShopee(cur, nowMs, endpoint, params);
    cur = r.sim;
    if (!r.ok) {
      problem ??= { error: r.envelope.error, message: r.envelope.message };
      return null;
    }
    return r.envelope.response;
  };

  const promo = read("get_promotion_list", {});
  const promotions = Array.isArray(promo?.promotion_list)
    ? (promo.promotion_list as Array<Record<string, unknown>>).map((p) => ({
        id: Number(p.promotion_id), name: String(p.name), startMs: Number(p.start_time) * 1000, endMs: Number(p.end_time) * 1000,
      }))
    : [];

  let status: SimSessionStatus | null = null;
  let itemIds: number[] = [];
  let showing: Showing = { state: "none" };
  if (sync.providerSessionId !== null) {
    const detail = read("get_session_detail", { session_id: sync.providerSessionId });
    const items = read("get_item_list", { session_id: sync.providerSessionId });
    if (detail) {
      status = detail.status as SimSessionStatus;
      showing = "showing_item_id" in detail
        ? detail.showing_item_id === null ? { state: "none" } : { state: "item", itemId: Number(detail.showing_item_id) }
        : { state: "unobservable" };
    } else {
      showing = { state: "unobservable" };
    }
    if (items && Array.isArray(items.item_list)) itemIds = (items.item_list as Array<Record<string, unknown>>).map((i) => Number(i.item_id));
  }
  return { sim: cur, snapshot: { takenAtMs: nowMs, providerSessionId: sync.providerSessionId, status, itemIds, showing, promotions, problem } };
}

/** Re-read the platform and make that the baseline, so LiveLift's own changes are not echoed back as "observed". */
function rebase(sim: ShopeeLiveSim, sync: SyncState, nowMs: number): { sim: ShopeeLiveSim; sync: SyncState } {
  const polled = pollPlatform(sim, sync, nowMs);
  return { sim: polled.sim, sync: { ...sync, last: polled.snapshot } };
}

// ---- Outbound --------------------------------------------------------------------------------------------------------

export interface SyncCall {
  endpoint: ShopeeEndpoint;
  ok: boolean;
  message: string;
  requestId: string;
  why: string;
}

export interface OutboundResult {
  sim: ShopeeLiveSim;
  sync: SyncState;
  calls: SyncCall[];
  /** The call that stopped the sequence, if any. Later steps are not attempted after a refusal. */
  blocked: SyncCall | null;
}

/**
 * Make the platform match the show's lifecycle: open the live and load its products when the show starts, load products
 * that were added later, and end the live when the show ends. It never removes anything the host added in the app.
 */
export function reconcileOutbound(sim: ShopeeLiveSim, session: Session, syncIn: SyncState, nowMs: number): OutboundResult {
  let cur = sim;
  let sync = syncIn;
  const calls: SyncCall[] = [];
  let blocked: SyncCall | null = null;

  const step = (endpoint: ShopeeEndpoint, params: Record<string, unknown>, why: string): Record<string, unknown> | null => {
    if (blocked) return null;
    const r = callShopee(cur, nowMs, endpoint, params);
    cur = r.sim;
    const call: SyncCall = { endpoint, ok: r.ok, message: r.envelope.message, requestId: r.envelope.request_id, why };
    calls.push(call);
    if (!r.ok) {
      blocked = call;
      return null;
    }
    return r.envelope.response;
  };

  const wanted = plannedProductIds(session).flatMap((id) => {
    const link = linkOfProduct(sync, id);
    return link ? [{ item_id: link.itemId, shop_id: link.shopId }] : [];
  });

  if (session.lifecycle === "active") {
    if (!canCallApi("shopee_live", "start_live")) return { sim: cur, sync, calls, blocked };
    let createdNow = false;
    if (sync.providerSessionId === null) {
      const created = step("create_session", { title: session.title }, "The show started: open a live on Shopee");
      if (created && typeof created.session_id === "number") {
        sync = { ...sync, providerSessionId: created.session_id };
        createdNow = true;
      }
    }
    if (sync.providerSessionId !== null && !blocked) {
      const sid = sync.providerSessionId;
      const have = new Set((sync.last?.itemIds ?? []) as number[]);
      const missing = createdNow ? wanted : wanted.filter((w) => !have.has(w.item_id));
      if (missing.length > 0) step("add_item_list", { session_id: sid, item_list: missing }, `Load ${missing.length} product${missing.length === 1 ? "" : "s"} from the run of show`);
      if (createdNow) step("start_session", { session_id: sid }, "Go live");
    }
  } else if (session.lifecycle === "ended" && sync.providerSessionId !== null && sync.last?.status === "ongoing") {
    step("end_session", { session_id: sync.providerSessionId }, "The show ended: end the live on Shopee");
  }

  const based = rebase(cur, sync, nowMs);
  return { sim: based.sim, sync: based.sync, calls, blocked };
}

/**
 * Schedule one promotion per hard-anchored promotion segment (a "flash sale at 20:12"). Shopee promotions are scheduled
 * ahead of time, so this is what an anchor can honestly map to; nothing found fires one inside a live.
 */
export function schedulePromotions(sim: ShopeeLiveSim, session: Session, syncIn: SyncState, nowMs: number): OutboundResult {
  let cur = sim;
  let sync = syncIn;
  const calls: SyncCall[] = [];
  let blocked: SyncCall | null = null;
  if (!canCallApi("shopee_live", "promotion")) return { sim, sync, calls, blocked };
  const plan = currentPlan(session);
  for (const seg of plan.segments) {
    if (blocked || seg.kind !== "promotion" || seg.anchorOffsetSec === null || sync.promotions[seg.id] !== undefined) continue;
    const link = (seg.productId ? linkOfProduct(sync, seg.productId) : undefined) ?? sync.links[0];
    if (!link) continue;
    const startMs = plan.plannedStartMs + seg.anchorOffsetSec * 1000;
    const r = callShopee(cur, nowMs, "create_promotion", {
      name: seg.title,
      start_time: Math.floor(startMs / 1000),
      end_time: Math.floor(startMs / 1000) + (seg.targetSec ?? 900),
      item_list: [{ item_id: link.itemId, shop_id: link.shopId }],
    });
    cur = r.sim;
    const call: SyncCall = { endpoint: "create_promotion", ok: r.ok, message: r.envelope.message, requestId: r.envelope.request_id, why: `Anchor "${seg.title}"` };
    calls.push(call);
    if (!r.ok) blocked = call;
    else if (typeof r.envelope.response.promotion_id === "number") sync = { ...sync, promotions: { ...sync.promotions, [seg.id]: r.envelope.response.promotion_id } };
  }
  const based = rebase(cur, sync, nowMs);
  return { sim: based.sim, sync: based.sync, calls, blocked };
}

export type PinOutcome =
  | { ok: true; requestId: string }
  | { ok: false; reason: "unsupported" | "not_linked" | "no_live" | "api_error"; message: string; requestId?: string };

/** Pin a product on the platform. Adds it to the live first when the live does not have it yet. */
export function pinFromLiveLift(sim: ShopeeLiveSim, syncIn: SyncState, productId: string, nowMs: number): { sim: ShopeeLiveSim; sync: SyncState; outcome: PinOutcome } {
  const fail = (cur: ShopeeLiveSim, sync: SyncState, reason: Extract<PinOutcome, { ok: false }>["reason"], message: string, requestId?: string) =>
    ({ sim: cur, sync, outcome: { ok: false, reason, message, ...(requestId ? { requestId } : {}) } as PinOutcome });
  if (!canCallApi("shopee_live", "pin")) return fail(sim, syncIn, "unsupported", "This platform has no pin API. Pin it in the app and report it.");
  const link = linkOfProduct(syncIn, productId);
  if (!link) return fail(sim, syncIn, "not_linked", "This product is not in the platform catalog.");
  if (syncIn.providerSessionId === null) return fail(sim, syncIn, "no_live", "No platform live is linked to this show yet.");
  const sid = syncIn.providerSessionId;
  let cur = sim;
  if (!syncIn.last?.itemIds.includes(link.itemId)) {
    const add = callShopee(cur, nowMs, "add_item_list", { session_id: sid, item_list: [{ item_id: link.itemId, shop_id: link.shopId }] });
    cur = add.sim;
    if (!add.ok) {
      const based = rebase(cur, syncIn, nowMs);
      return fail(based.sim, based.sync, "api_error", add.envelope.message, add.envelope.request_id);
    }
  }
  const pin = callShopee(cur, nowMs, "update_show_item", { session_id: sid, item_id: link.itemId, shop_id: link.shopId });
  const based = rebase(pin.sim, syncIn, nowMs);
  return pin.ok
    ? { sim: based.sim, sync: based.sync, outcome: { ok: true, requestId: pin.envelope.request_id } }
    : fail(based.sim, based.sync, "api_error", pin.envelope.message, pin.envelope.request_id);
}

/** Unpinning has no documented endpoint, so the answer is always the operator-assisted path. */
export function unpinFromLiveLift(): PinOutcome {
  return canCallApi("shopee_live", "unpin")
    ? { ok: false, reason: "api_error", message: "Unpin is not implemented." }
    : { ok: false, reason: "unsupported", message: "No endpoint clears the pinned product. Unpin it in the app, then report it here." };
}

// ---- Turning outcomes into LiveLift records --------------------------------------------------------------------------

/** The pending planned cue for this product and action, if the show has one. */
function openCue(session: Session, action: "pin_product" | "unpin_product", productId: string): string | null {
  const cue = currentPlan(session).cues.find((c) => {
    if (c.audience !== "operator" || c.action !== action || c.productId !== productId) return false;
    const state = session.runtime.cues[c.id]?.state ?? "pending";
    return state === "pending" || state === "attempted";
  });
  return cue?.id ?? null;
}

/** Record a pin/unpin as the planned cue when one is waiting, otherwise as an unplanned action. */
export function reportCommand(
  session: Session,
  action: "pin_product" | "unpin_product",
  productId: string,
  report: "performed" | "attempted",
  reason: string
): CommandBody {
  const cueId = openCue(session, action, productId);
  if (cueId) return { type: "report_cue", cueId, report, reason };
  return { type: "report_manual_action", action, productId, report, reason };
}

export const acceptedReason = (requestId: string): string => `Shopee (SIMULATED) accepted the request · request_id ${requestId}`;
export const refusedReason = (message: string, requestId?: string): string => `Shopee (SIMULATED) refused: ${message}${requestId ? ` · request_id ${requestId}` : ""}`;

// ---- Inbound ---------------------------------------------------------------------------------------------------------

export type Observation =
  | { kind: "showing_changed"; from: Showing; to: Showing }
  | { kind: "item_added"; itemId: number }
  | { kind: "item_removed"; itemId: number }
  | { kind: "live_status_changed"; from: SimSessionStatus | null; to: SimSessionStatus | null }
  | { kind: "promotion_seen"; id: number; name: string; startMs: number }
  | { kind: "showing_unobservable" };

export function diffSnapshots(prev: PlatformSnapshot | null, next: PlatformSnapshot): Observation[] {
  // A failed read says nothing about the platform: no change is reported from it.
  if (!prev || next.problem) return [];
  const out: Observation[] = [];
  if (prev.status !== next.status) out.push({ kind: "live_status_changed", from: prev.status, to: next.status });
  for (const id of next.itemIds) if (!prev.itemIds.includes(id)) out.push({ kind: "item_added", itemId: id });
  for (const id of prev.itemIds) if (!next.itemIds.includes(id)) out.push({ kind: "item_removed", itemId: id });
  if (next.showing.state === "unobservable") {
    if (prev.showing.state !== "unobservable") out.push({ kind: "showing_unobservable" });
  } else if (prev.showing.state !== "unobservable") {
    const same = prev.showing.state === next.showing.state && (prev.showing.state === "none" || (prev.showing.state === "item" && next.showing.state === "item" && prev.showing.itemId === next.showing.itemId));
    if (!same) out.push({ kind: "showing_changed", from: prev.showing, to: next.showing });
  }
  for (const p of next.promotions) if (!prev.promotions.some((q) => q.id === p.id)) out.push({ kind: "promotion_seen", id: p.id, name: p.name, startMs: p.startMs });
  return out;
}

export type InboundAction =
  | { kind: "command"; command: CommandBody; summary: string }
  /** Nothing LiveLift may do by itself: it is shown to the operator as a notice. */
  | { kind: "notice"; code: string; summary: string };

/** Turn what the platform now shows into LiveLift records or notices. */
export function inboundActions(session: Session, sync: SyncState, observations: readonly Observation[]): InboundAction[] {
  const out: InboundAction[] = [];
  const nameOf = (productId: string): string => session.products.find((p) => p.id === productId)?.name ?? productId;
  for (const o of observations) {
    switch (o.kind) {
      case "showing_changed": {
        if (o.to.state === "item") {
          const link = linkOfItem(sync, o.to.itemId);
          if (!link) { out.push({ kind: "notice", code: "unknown_item", summary: `The host pinned an item LiveLift has no product for (item ${o.to.itemId}). Import it from the catalog to track it.` }); break; }
          out.push({ kind: "command", command: reportCommand(session, "pin_product", link.productId, "performed", "Provider observed (SIMULATED): the platform now shows this item"), summary: `Host pinned ${nameOf(link.productId)} on the platform` });
        } else if (o.from.state === "item") {
          const link = linkOfItem(sync, o.from.itemId);
          if (!link) break;
          out.push({ kind: "command", command: reportCommand(session, "unpin_product", link.productId, "performed", "Provider observed (SIMULATED): the platform no longer shows this item"), summary: `Host unpinned ${nameOf(link.productId)} on the platform` });
        }
        break;
      }
      case "item_added": {
        const link = linkOfItem(sync, o.itemId);
        out.push({ kind: "notice", code: link ? "item_added_known" : "unknown_item", summary: link ? `The host added ${nameOf(link.productId)} to the live bag.` : `The host added an item LiveLift has no product for (item ${o.itemId}).` });
        break;
      }
      case "item_removed": {
        const link = linkOfItem(sync, o.itemId);
        out.push({ kind: "notice", code: "item_removed", summary: `The host removed ${link ? nameOf(link.productId) : `item ${o.itemId}`} from the live bag.` });
        break;
      }
      case "live_status_changed":
        if (o.to === "ended") out.push({ kind: "notice", code: "live_ended_on_platform", summary: "The live ended on the platform. End the LiveLift show when you are ready: LiveLift never ends it for you." });
        break;
      case "promotion_seen":
        out.push({ kind: "notice", code: "promotion_scheduled", summary: `A promotion "${o.name}" was scheduled on the platform.` });
        break;
      case "showing_unobservable":
        out.push({ kind: "notice", code: "showing_unobservable", summary: "The platform did not say which product is pinned. Pins made in the app must be reported by hand." });
        break;
    }
  }
  return out;
}

/** Describe a scheduled promotion's timing for the audience. */
export const promotionWords = (sim: ShopeeLiveSim, nowMs: number): Array<{ id: number; name: string; status: ReturnType<typeof promotionStatus>; createdBy: "api" | "host_app" }> =>
  sim.promotions.map((p) => ({ id: p.id, name: p.name, status: promotionStatus(p, nowMs), createdBy: p.createdBy }));
