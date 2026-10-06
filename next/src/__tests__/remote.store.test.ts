import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { snapshotProducts } from "@/fixtures/library";
import { SCENARIO_BY_ID, applyCommand, createSession } from "@/lib/domain";
import { RemoteRoomStore, STALE_AFTER_MS } from "@/lib/store/remoteRoomStore";
import { FakeRoom } from "./helpers/fakeRoom";

const PENDING_KEY = "livelift.v3.remote.pending";

/** A running REAL show, as the room would hold it. */
function runningShow(room: FakeRoom, id = "real-1") {
  const template = SCENARIO_BY_ID.buffered;
  const { segments, cues } = template.buildPlan(id);
  const planned = createSession({
    id,
    title: "Friday launch",
    environment: "REAL",
    timezone: "UTC",
    plannedStartMs: room.nowMs,
    nowMs: room.nowMs,
    products: snapshotProducts(template.productIds),
    segments,
    cues,
    operator: { id: room.actor.id, name: room.actor.name, role: "lead", isLead: true },
  });
  const started = applyCommand(planned, { type: "start_live", nowMs: room.nowMs });
  if (started.receipt.outcome !== "committed") throw new Error("could not start fixture show");
  room.seed(started.session);
  return started.session;
}

let perf = 0;
let ids = 0;
let restore: (() => void) | null = null;
const stores: RemoteRoomStore[] = [];

function makeStore(room: FakeRoom): RemoteRoomStore {
  restore = room.install();
  const store = new RemoteRoomStore({ perfNow: () => perf, newCommandId: () => `cmd-${++ids}` });
  stores.push(store);
  return store;
}

beforeEach(() => {
  perf = 1000;
  ids = 0;
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});

afterEach(() => {
  for (const s of stores.splice(0)) s.reset();
  restore?.();
  restore = null;
  vi.useRealTimers();
});

const note = (text: string) => ({ body: { type: "add_note" as const, text }, sessionId: "real-1" });

describe("polling and installation", () => {
  it("installs the room snapshot and keeps it when the room answers 'unchanged'", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    const first = store.getSnapshot();
    expect(first.connection).toBe("connected");
    expect(first.snapshot?.revision).toBe(room.revision);
    expect(first.snapshot?.sessions.map((s) => s.id)).toEqual(["real-1"]);
    expect(first.access?.role).toBe("operator");

    await store.refreshNow();
    const second = store.getSnapshot();
    // "changed: false" is a valid read that establishes contact; it must not discard or replace what is installed.
    expect(room.requests.at(-1)!.path).toBe(`/api/v3/room?afterRevision=${room.revision}`);
    expect(second.snapshot).toBe(first.snapshot);
    expect(second.connection).toBe("connected");
  });

  it("never installs an older revision over a newer snapshot", async () => {
    const room = new FakeRoom();
    runningShow(room);
    room.revision = 5;
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    expect(store.getSnapshot().snapshot?.revision).toBe(5);
    room.revision = 3; // a replayed / reordered older answer
    await store.refreshNow();
    expect(store.getSnapshot().snapshot?.revision).toBe(5);
  });

  it("polls every second while a view is mounted, with at most one request in flight", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    let inFlight = 0;
    let peak = 0;
    const base = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      try {
        return await base(...args);
      } finally {
        inFlight -= 1;
      }
    });
    store.acquire();
    await vi.advanceTimersByTimeAsync(0);
    const afterStart = room.requests.length;
    perf += 1000;
    await vi.advanceTimersByTimeAsync(1000);
    perf += 1000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(room.requests.length - afterStart).toBe(2);
    expect(peak).toBe(1);
  });

  it("a view that is no longer mounted stops the polling", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    const release = store.acquire();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await vi.advanceTimersByTimeAsync(5000);
    const seen = room.requests.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(room.requests.length).toBe(seen);
  });
});

describe("foreground and reconnect", () => {
  const setVisibility = (state: "visible" | "hidden"): void => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    document.dispatchEvent(new Event("visibilitychange"));
  };
  afterEach(() => setVisibility("visible"));

  it("a hidden view does not poll, and coming back polls immediately", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await vi.advanceTimersByTimeAsync(0);
    setVisibility("hidden");
    const whileHidden = room.requests.length;
    perf += 5000;
    await vi.advanceTimersByTimeAsync(5000);
    expect(room.requests.length).toBe(whileHidden);

    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(room.requests.length).toBe(whileHidden + 1); // no waiting for the next tick
  });

  it("the browser coming back online polls immediately", async () => {
    const room = new FakeRoom();
    runningShow(room);
    room.offline = true;
    const store = makeStore(room);
    store.acquire();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot().connection).toBe("disconnected");
    room.offline = false;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot().connection).toBe("connected");
  });
});

describe("stale and disconnected state", () => {
  it("failed contact keeps the last snapshot, marks it stale, freezes authority time and refuses writes", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    perf += 500;
    const liveNow = store.authorityNow()!;
    expect(liveNow).toBe(room.nowMs + 500);

    room.offline = true;
    await store.refreshNow();
    const state = store.getSnapshot();
    expect(state.connection).toBe("stale");
    expect(state.snapshot?.sessions[0].id).toBe("real-1"); // retained, not discarded
    const frozen = store.authorityNow();
    perf += 10_000;
    expect(store.authorityNow()).toBe(frozen); // unseen time is not simulated

    const outcome = await store.submit(note("late"));
    expect(outcome.status).toBe("refused");
    expect(room.posts()).toHaveLength(0);
  });

  it("more than 3 seconds without contact marks the room stale even if no request failed", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    expect(store.getSnapshot().connection).toBe("connected");
    perf += STALE_AFTER_MS + 100;
    await vi.advanceTimersByTimeAsync(500); // the staleness check runs on its own timer
    expect(store.getSnapshot().connection).toBe("stale");
    expect(store.isAuthoritative()).toBe(false);
  });

  it("the first contact failing is 'disconnected', and a later success recovers", async () => {
    const room = new FakeRoom();
    runningShow(room);
    room.offline = true;
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    expect(store.getSnapshot().connection).toBe("disconnected");
    expect(store.getSnapshot().snapshot).toBeNull();
    room.offline = false;
    await store.refreshNow();
    expect(store.getSnapshot().connection).toBe("connected");
    expect(store.getSnapshot().snapshot?.sessions).toHaveLength(1);
  });
});

describe("commands", () => {
  it("sends the room revision and no browser time, persists the envelope before sending, and installs fresh state before reporting", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    let storedAtArrival: string | null = null;
    room.onPost = () => {
      storedAtArrival = localStorage.getItem(PENDING_KEY);
    };

    const outcome = await store.submit(note("Sizing questions"));
    expect(outcome.status).toBe("committed");
    const sent = room.posts()[0];
    expect(sent).toMatchObject({ commandId: "cmd-1", roomId: "room-1", sessionId: "real-1", expectedRevision: 1, type: "add_note", payload: { text: "Sizing questions" } });
    expect(JSON.stringify(sent)).not.toMatch(/nowMs|actor|operator/);
    // The exact envelope was on disk before the room ever saw it, and is gone once the receipt arrived.
    expect(JSON.parse(storedAtArrival!).pending[0].envelope.commandId).toBe("cmd-1");
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    // Fresh state is installed before the caller hears "committed".
    if (outcome.status === "committed") expect(outcome.viewCurrent).toBe(true);
    const installed = store.getSnapshot().snapshot!;
    expect(installed.revision).toBe(2);
    expect(installed.sessions[0].events.some((e) => e.type === "note_added")).toBe(true);
  });

  it("does not advance anything while the command is pending", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    const before = store.getSnapshot().snapshot;
    let during: ReturnType<RemoteRoomStore["getSnapshot"]> | null = null;
    room.onPost = () => {
      during = store.getSnapshot();
    };
    await store.submit(note("pending check"));
    expect(during!.inflight?.commandId).toBe("cmd-1");
    expect(during!.snapshot).toBe(before); // nothing installed until the room says so
  });

  it("only one command is in flight; a second is refused, not queued", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    const [a, b] = await Promise.all([store.submit(note("one")), store.submit(note("two"))]);
    expect(a.status).toBe("committed");
    expect(b).toMatchObject({ status: "refused", code: "busy" });
    expect(room.posts()).toHaveLength(1);
  });

  it("a stale revision is surfaced as a rejection and the room is read again", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.revision += 1; // someone else committed; this tab has not polled yet
    const outcome = await store.submit(note("mine"));
    expect(outcome).toMatchObject({ status: "rejected", code: "stale_revision" });
    expect(outcome.status === "rejected" && outcome.message).toMatch(/room changed/i);
    expect(store.getSnapshot().snapshot?.revision).toBe(room.revision);
    expect(store.getSnapshot().unresolved).toHaveLength(0); // a rejection is a known outcome
  });

  it("a viewer is refused before anything is sent", async () => {
    const room = new FakeRoom({ role: "viewer" });
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    const outcome = await store.submit(note("nope"));
    expect(outcome).toMatchObject({ status: "refused", code: "read_only" });
    expect(room.posts()).toHaveLength(0);
  });

  it("the room's own 'forbidden' is a rejection with a role-aware message, not an unknown outcome", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.role = "viewer"; // the capability changed server-side after this tab last looked
    const outcome = await store.submit(note("denied"));
    expect(outcome).toMatchObject({ status: "rejected", code: "forbidden" });
    expect(store.getSnapshot().unresolved).toHaveLength(0);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

describe("outcome unknown", () => {
  it("a lost response is UNKNOWN, not failed; the envelope is kept and nothing else may be sent", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.loseNextResponses = 1; // the room commits, the answer never arrives

    const outcome = await store.submit(note("Was it recorded?"));
    expect(outcome.status).toBe("unknown");
    expect(store.getSnapshot().unresolved).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(PENDING_KEY)!).pending[0].envelope.commandId).toBe("cmd-1");

    const blocked = await store.submit(note("another"));
    expect(blocked).toMatchObject({ status: "refused", code: "unresolved" });
    expect(room.posts()).toHaveLength(1); // never replayed automatically
  });

  it("reconnect reconciles through the receipt endpoint and never POSTs again", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.loseNextResponses = 1;
    await store.submit(note("Was it recorded?"));

    await store.reconcile();
    const state = store.getSnapshot();
    expect(state.unresolved).toHaveLength(0);
    expect(state.resolutions[0]).toMatchObject({ tone: "ok" });
    expect(state.resolutions[0].text).toMatch(/did record it/);
    expect(state.snapshot?.sessions[0].events.some((e) => e.type === "note_added")).toBe(true);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(room.posts()).toHaveLength(1);
    expect(room.requests.some((r) => r.method === "GET" && r.path === "/api/v3/room/commands/cmd-1")).toBe(true);
  });

  it("an absent receipt is not evidence of failure: it stays unresolved until explicitly retried with the exact same envelope", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.dropNextPosts = 1; // never reached the room: nothing committed, no receipt
    await store.submit(note("Did this arrive?"));
    const original = store.getSnapshot().unresolved[0].envelope;

    await store.reconcile();
    const entry = store.getSnapshot().unresolved[0];
    expect(entry.lookup).toBe("absent");
    expect(entry.detail).toMatch(/does not prove it failed/);
    expect(room.posts()).toHaveLength(1); // the dropped one is the only POST so far

    const retried = await store.retryUnresolved("cmd-1");
    expect(retried.status).toBe("committed");
    const last = room.posts().at(-1)!;
    expect(last).toEqual(original); // same commandId, same expectedRevision, same payload
    expect(store.getSnapshot().unresolved).toHaveLength(0);
  });

  it("retrying a command that was in fact committed returns the original receipt as a duplicate", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.loseNextResponses = 1;
    await store.submit(note("exactly once"));

    const retried = await store.retryUnresolved("cmd-1");
    expect(retried).toMatchObject({ status: "committed", duplicate: true });
    const notes = store.getSnapshot().snapshot!.sessions[0].events.filter((e) => e.type === "note_added");
    expect(notes).toHaveLength(1);
  });

  it("an interrupted command survives a reload and is looked up, not replayed", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const first = makeStore(room);
    first.acquire();
    await first.refreshNow();
    room.loseNextResponses = 1;
    await first.submit(note("across a reload"));
    // The tab closes here: only localStorage survives.
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();

    const second = new RemoteRoomStore({ perfNow: () => perf, newCommandId: () => `cmd-${++ids}` });
    stores.push(second);
    second.acquire();
    expect(second.getSnapshot().unresolved).toHaveLength(1); // restored, outcome unknown
    await vi.advanceTimersByTimeAsync(10); // first contact, then the reconcile it schedules
    await second.reconcile();
    expect(second.getSnapshot().unresolved).toHaveLength(0);
    expect(second.getSnapshot().resolutions[0].text).toMatch(/did record it/);
    expect(room.posts()).toHaveLength(1);
  });

  it("setting an unresolved command aside is explicit and does not claim it failed", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.dropNextPosts = 1;
    await store.submit(note("set aside"));
    store.dismissUnresolved("cmd-1");
    const state = store.getSnapshot();
    expect(state.unresolved).toHaveLength(0);
    expect(state.resolutions[0].text).toMatch(/outcome still unknown/);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });
});
