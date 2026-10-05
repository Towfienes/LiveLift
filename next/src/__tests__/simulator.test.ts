import { describe, it, expect, beforeEach } from "vitest";
import { simulator } from "@/lib/simulator/simulatorEngine";
import { draftStore } from "@/lib/storage/draftStore";

describe("Deterministic Simulator Engine & Invariants", () => {
  beforeEach(() => {
    simulator.reset();
  });

  it("handles rejection without skipping the planned segment", () => {
    const res = simulator.rejectRecommendation("session_oct_evening", "rec_m03", "Wait for viewer count");
    expect(res?.activeRecommendation?.decision).toBe("rejected");
    expect(res?.activeRecommendation?.decisionReason).toBe("Wait for viewer count");

    // The planned segment M03 Cargo Pants must STILL be pending in Run of Show!
    const m03Seg = res?.segments.find((s) => s.id === "seg_05");
    expect(m03Seg?.state).toBe("pending");
  });

  it("explicitly executes segment start and transitions presenting product", () => {
    // Start seg_05 (M03 Cargo Pants)
    const afterStart = simulator.startSegment("session_oct_evening", "seg_05");

    // Previous segment seg_03 is now completed
    const prevSeg = afterStart?.segments.find((s) => s.id === "seg_03");
    expect(prevSeg?.state).toBe("completed");
    expect(prevSeg?.actualEndedAt).toBeDefined();

    // seg_05 is now current
    const currentSeg = afterStart?.currentSegment;
    expect(currentSeg?.id).toBe("seg_05");
    expect(currentSeg?.state).toBe("current");

    // Presenting product is now M03
    expect(afterStart?.presentingProduct?.code).toBe("M03");
  });

  it("extends operational target duration without modifying planned baseline", () => {
    const snap = simulator.getSnapshot("session_oct_evening");
    const originalPlanned = snap?.currentSegment?.plannedDurationMinutes;
    const initialTarget = snap?.currentSegment?.targetDurationMinutes;

    const updated = simulator.extendDuration("session_oct_evening", 1);
    expect(updated?.currentSegment?.targetDurationMinutes).toBe((initialTarget ?? 0) + 1);
    // Original planned baseline remains intact
    expect(updated?.currentSegment?.plannedDurationMinutes).toBe(originalPlanned);
  });

  it("preserves Unknown platform pin verification when operator reports pin", () => {
    const updated = simulator.reportPlatformAction(
      "session_oct_evening",
      "prod_m03",
      "pin_product",
      "performed"
    );

    expect(updated?.pinnedProduct?.code).toBe("M03");
    expect(updated?.pinnedReportedBy).toBe("Linh");
    // Invariant: Platform verification must remain Unknown!
    expect(updated?.pinnedVerification).toBe("unknown");
  });

  it("ends LIVE, freezes runtime timestamps and marks session ended", () => {
    const ended = simulator.endLive("session_oct_evening");
    expect(ended?.session.lifecycle).toBe("ended");
    expect(ended?.session.actualEndedAt).toBeDefined();
    expect(ended?.currentSegment?.state).toBe("completed");
  });

  it("marks unsynced drafts as device-local and prevents automatic submission", () => {
    draftStore.setOnlineStatus(false);
    const draft = draftStore.saveDraft({
      sessionId: "session_oct_evening",
      draftType: "note",
      assertion: "Host mentioned restock next Tuesday.",
      capturedAt: new Date().toISOString(),
    });

    expect(draft.deviceLocal).toBe(true);
    expect(draft.confirmedForSubmission).toBe(false);
    expect(draft.submissionStatus).toBe("draft");

    // Requires explicit confirmation
    const confirmed = draftStore.confirmDraft(draft.id);
    expect(confirmed).toBe(true);
    const all = draftStore.getDrafts("session_oct_evening");
    expect(all[0].confirmedForSubmission).toBe(true);
    expect(all[0].submissionStatus).toBe("submitted");
  });
});
