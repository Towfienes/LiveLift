import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionStore } from "@/lib/store/sessionStore";
import { SCENARIO_START_MS, newSegment, proposeChanges } from "@/lib/domain";

const T0 = SCENARIO_START_MS;
const at = (m: number, s = 0): number => T0 + (m * 60 + s) * 1000;
const REAL_KEY = "livelift.v3.REAL";
const SIM_KEY = "livelift.v3.SIMULATED";

function boot(): SessionStore {
  const store = new SessionStore();
  store.hydrate();
  return store;
}

function newRealShow(store: SessionStore) {
  const s = store.createSession({
    title: "Manual show",
    environment: "REAL",
    timezone: "Asia/Ho_Chi_Minh",
    plannedStartMs: T0,
    start: { type: "blank" },
  });
  const edit = store.editDraft(s.id, (draft, alloc) => {
    draft.plans[0].segments.push(
      newSegment(alloc.segmentId(), { title: "Opening", kind: "opening", targetSec: 180, minSec: 120 }),
      newSegment(alloc.segmentId(), { title: "Product A", targetSec: 360, minSec: 240 })
    );
  });
  if (!edit.ok) throw new Error(edit.reason);
  return edit.session;
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("namespaces", () => {
  it("seeds only SIMULATED rehearsal sessions; REAL starts empty — no fabricated real history", () => {
    const store = boot();
    expect(store.list("REAL")).toEqual([]);
    const sims = store.list("SIMULATED");
    expect(sims.length).toBe(4);
    expect(sims.every((s) => s.environment === "SIMULATED")).toBe(true);
    expect(localStorage.getItem(SIM_KEY)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(REAL_KEY)!).sessions).toEqual([]);
  });

  it("an unknown id is not found — it never falls back to another show", () => {
    const store = boot();
    expect(store.getSession("does-not-exist")).toBeNull();
    expect(store.dispatch("does-not-exist", { type: "end_live" })).toBeNull();
  });

  it("refuses to derive a REAL show from a SIMULATED one", () => {
    const store = boot();
    expect(() =>
      store.createSession({
        title: "Mixed",
        environment: "REAL",
        timezone: "Asia/Ho_Chi_Minh",
        plannedStartMs: T0,
        start: { type: "previous", sourceId: "sim-buffered" },
      })
    ).toThrow(/never mixed/);
  });

  it("a SIMULATED record found in the REAL namespace is set aside, not loaded", () => {
    const store = boot();
    const sim = store.getSession("sim-buffered")!;
    localStorage.setItem(REAL_KEY, JSON.stringify({ v: 1, sessions: [sim] }));
    const again = boot();
    expect(again.list("REAL")).toEqual([]);
    expect(again.getSnapshot().notices.join(" ")).toContain("could not be read");
    expect(localStorage.getItem(`${REAL_KEY}.quarantine`)).not.toBeNull();
  });
});

describe("durability", () => {
  it("a show survives a reload with its full history", () => {
    const store = boot();
    const show = newRealShow(store);
    const started = store.dispatch(show.id, { type: "start_live", nowMs: at(0) })!;
    expect(started.receipt.outcome).toBe("committed");
    store.dispatch(show.id, { type: "add_note", text: "Host mentioned restock", nowMs: at(1) });
    const before = JSON.stringify(store.getSession(show.id));

    const reloaded = boot(); // a fresh store reading the same localStorage
    expect(JSON.stringify(reloaded.getSession(show.id))).toBe(before);
    expect(reloaded.getSession(show.id)!.events.length).toBe(3); // started + segment_started + note
    expect(reloaded.getSession(show.id)!.baselineLocked).toBe(true);
  });

  it("a duplicate command key is not committed twice", () => {
    const store = boot();
    const show = newRealShow(store);
    store.dispatch(show.id, { type: "start_live", nowMs: at(0) });
    const first = store.dispatch(show.id, { type: "add_note", text: "once", nowMs: at(1), key: "k1" })!;
    const stored = localStorage.getItem(REAL_KEY);
    const dup = store.dispatch(show.id, { type: "add_note", text: "once", nowMs: at(2), key: "k1" })!;
    expect(first.duplicate).toBe(false);
    expect(dup.duplicate).toBe(true);
    expect(store.getSession(show.id)!.events.filter((e) => e.type === "note_added").length).toBe(1);
    expect(localStorage.getItem(REAL_KEY)).toBe(stored);
  });

  it("prepare edits are rejected once the baseline is locked", () => {
    const store = boot();
    const show = newRealShow(store);
    store.dispatch(show.id, { type: "start_live", nowMs: at(0) });
    const late = store.editDraft(show.id, (d) => {
      d.title = "Renamed";
    });
    expect(late.ok).toBe(false);
    expect(store.getSession(show.id)!.title).toBe("Manual show");
  });

  it("corrupt storage is set aside, not deleted, and the app still boots", () => {
    localStorage.setItem(REAL_KEY, "{not json");
    const store = boot();
    expect(store.getSnapshot().hydrated).toBe(true);
    expect(store.list("REAL")).toEqual([]);
    expect(store.getSnapshot().notices.join(" ")).toContain("set aside, not deleted");
    expect(JSON.parse(localStorage.getItem(`${REAL_KEY}.quarantine`)!)[0]).toBe("{not json");
  });

  it("an unsupported schema version is set aside, not deleted", () => {
    localStorage.setItem(REAL_KEY, JSON.stringify({ v: 99, sessions: [{ anything: true }] }));
    const store = boot();
    expect(store.list("REAL")).toEqual([]);
    expect(store.getSnapshot().notices.join(" ")).toContain("unsupported version");
    expect(localStorage.getItem(`${REAL_KEY}.quarantine`)).toContain("anything");
  });

  it("picks up a commit made in another tab instead of overwriting it", () => {
    const a = boot();
    const b = boot();
    const show = newRealShow(a);
    expect(b.getSession(show.id)).toBeNull();
    window.dispatchEvent(new StorageEvent("storage", { key: REAL_KEY }));
    expect(b.getSession(show.id)?.title).toBe("Manual show");
  });
});

describe("storage failure is surfaced, not hidden", () => {
  it("works in memory and says so when storage is unavailable", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const store = boot();
    expect(store.getSnapshot().storage).toBe("unavailable");
    expect(store.getSnapshot().notices.join(" ")).toContain("not being saved");
    const show = newRealShow(store);
    expect(store.dispatch(show.id, { type: "start_live", nowMs: at(0) })!.receipt.outcome).toBe("committed");
  });

  it("reports a failed write after a successful start", () => {
    const store = boot();
    const show = newRealShow(store);
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    store.dispatch(show.id, { type: "start_live", nowMs: at(0) });
    expect(store.getSnapshot().storage).toBe("write_failed");
  });
});

describe("Next LIVE and simulator reset", () => {
  it("creates and persists the next show without touching the source", () => {
    const store = boot();
    const source = store.getSession("sim-buffered-done")!;
    const before = JSON.stringify(source);
    const changeIds = proposeChanges(source).map((p) => p.id);
    const result = store.createNext(source.id, { title: "Next", plannedStartMs: at(0) + 86_400_000, changeIds, note: "n" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(store.getSession(source.id))).toBe(before);
    expect(result.session.environment).toBe("SIMULATED");
    expect(result.session.id).toMatch(/^sim-\d+$/);
    expect(boot().getSession(result.session.id)?.derivedFrom?.sessionId).toBe(source.id);
  });

  it("resetSimulator regenerates rehearsals and leaves REAL data alone", () => {
    const store = boot();
    const show = newRealShow(store);
    store.dispatch("sim-buffered", { type: "start_live" });
    expect(store.getSession("sim-buffered")!.lifecycle).toBe("active");
    store.resetSimulator();
    expect(store.getSession("sim-buffered")!.lifecycle).toBe("planned");
    expect(store.getSession(show.id)?.title).toBe("Manual show");
  });

  it("applies scripted rehearsal steps through the same authority", () => {
    const store = boot();
    const r = store.applyNextScriptStep("sim-buffered")!;
    expect(r.receipt?.outcome).toBe("committed");
    expect(store.getSession("sim-buffered")!.scriptCursor).toBe(1);
    expect(store.getSession("sim-buffered")!.lifecycle).toBe("active");
    // REAL shows have no script.
    const show = newRealShow(store);
    expect(store.applyNextScriptStep(show.id)).toBeNull();
  });
});
