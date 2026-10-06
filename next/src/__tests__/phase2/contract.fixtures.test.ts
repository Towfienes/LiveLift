import { describe, expect, it } from "vitest";
import type {
  AuthorityReceipt,
  CommandEnvelope,
  CommandResponse,
  RoomRead,
  RuntimeCommandBody,
} from "@/contracts/authority";
import {
  areCanonicalRequestsEqual,
  canonicalRequestHash,
  REJECTION_CODES,
  sampleCommandResponse,
  sampleCommittedReceipt,
  sampleCreateNextEnvelope,
  sampleCreateSessionEnvelope,
  sampleDuplicateCommandResponse,
  sampleEndSegmentEnvelope,
  sampleForbiddenReceipt,
  sampleIdempotencyConflictReceipt,
  sampleSavePrepareEnvelope,
  sampleStartLiveEnvelope,
  sampleStartSegmentEnvelope,
  sampleStaleRejectedReceipt,
  TEST_ROOM_ID,
  TEST_SESSION_ID,
} from "./fixtures/authorityFixtures";

describe("Phase 2 Authority Wire Contract & Fixtures", () => {
  describe("Command envelope discrimination & types", () => {
    it("differentiates create_session with sessionId: null", () => {
      const env: CommandEnvelope = sampleCreateSessionEnvelope;
      expect(env.type).toBe("create_session");
      expect(env.sessionId).toBeNull();
      expect(env.payload).toHaveProperty("title");
      expect(env.payload).toHaveProperty("timezone");
    });

    it("differentiates save_prepare with target sessionId and draft payload", () => {
      const env: CommandEnvelope = sampleSavePrepareEnvelope;
      expect(env.type).toBe("save_prepare");
      expect(env.sessionId).toBe(TEST_SESSION_ID);
      expect(env.payload).toHaveProperty("title");
      expect(env.payload).toHaveProperty("segments");
      // Must NOT contain runtime or events metadata
      expect(env.payload).not.toHaveProperty("runtime");
      expect(env.payload).not.toHaveProperty("events");
    });

    it("differentiates create_next with source sessionId and nextLive payload", () => {
      const env: CommandEnvelope = sampleCreateNextEnvelope;
      expect(env.type).toBe("create_next");
      expect(env.sessionId).toBe(TEST_SESSION_ID);
      expect(env.payload).toHaveProperty("title");
      expect(env.payload).toHaveProperty("changeIds");
      // id and nowMs must be omitted from payload as server assigns them
      expect(env.payload).not.toHaveProperty("id");
      expect(env.payload).not.toHaveProperty("nowMs");
    });

    it("differentiates runtime command envelopes (start_live, start_segment, end_segment)", () => {
      const startLive: CommandEnvelope = sampleStartLiveEnvelope;
      expect(startLive.type).toBe("start_live");
      expect(startLive.sessionId).toBe(TEST_SESSION_ID);

      const startSeg: CommandEnvelope = sampleStartSegmentEnvelope;
      expect(startSeg.type).toBe("start_segment");
      expect(startSeg.sessionId).toBe(TEST_SESSION_ID);
      expect(startSeg.payload).toEqual({ segmentId: "seg-intro" });

      const endSeg: CommandEnvelope = sampleEndSegmentEnvelope;
      expect(endSeg.type).toBe("end_segment");
      expect(endSeg.sessionId).toBe(TEST_SESSION_ID);
    });

    it("prohibits advance_clock and set_clock in RuntimeCommandBody at type level", () => {
      type ProhibitedClockTypes = Extract<RuntimeCommandBody, { type: "advance_clock" | "set_clock" }>;
      // ProhibitedClockTypes must resolve to never
      const check: [ProhibitedClockTypes] extends [never] ? true : false = true;
      expect(check).toBe(true);
    });
  });

  describe("Canonical request identity & hashing", () => {
    it("treats JSON key order as insignificant", () => {
      const envA = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: "s1",
        expectedRevision: 5,
        type: "end_segment",
        payload: {
          segmentId: "seg-1",
          coverage: "complete",
          acknowledgeBelowMinimum: false,
        },
      };

      const envB = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: "s1",
        expectedRevision: 5,
        type: "end_segment",
        payload: {
          acknowledgeBelowMinimum: false,
          coverage: "complete",
          segmentId: "seg-1",
        },
      };

      expect(areCanonicalRequestsEqual(envA, envB)).toBe(true);
      expect(canonicalRequestHash(envA)).toBe(canonicalRequestHash(envB));
    });

    it("treats array element order as strictly significant", () => {
      const envA = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: null,
        expectedRevision: 0,
        type: "create_session",
        payload: {
          title: "Session",
          timezone: "UTC",
          plannedStartMs: 1000,
          segments: [{ id: "s1" }, { id: "s2" }],
        },
      };

      const envB = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: null,
        expectedRevision: 0,
        type: "create_session",
        payload: {
          title: "Session",
          timezone: "UTC",
          plannedStartMs: 1000,
          segments: [{ id: "s2" }, { id: "s1" }],
        },
      };

      expect(areCanonicalRequestsEqual(envA, envB)).toBe(false);
      expect(canonicalRequestHash(envA)).not.toBe(canonicalRequestHash(envB));
    });

    it("strictly preserves missing vs explicit null vs zero", () => {
      const envZero = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: "s1",
        expectedRevision: 1,
        type: "set_remaining_estimate",
        payload: { segmentId: "seg-1", remainingSec: 0 },
      };

      const envNull = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: "s1",
        expectedRevision: 1,
        type: "set_remaining_estimate",
        payload: { segmentId: "seg-1", remainingSec: null },
      };

      const envMissing = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: "s1",
        expectedRevision: 1,
        type: "set_remaining_estimate",
        payload: { segmentId: "seg-1" },
      };

      expect(areCanonicalRequestsEqual(envZero, envNull)).toBe(false);
      expect(areCanonicalRequestsEqual(envNull, envMissing)).toBe(false);
      expect(areCanonicalRequestsEqual(envZero, envMissing)).toBe(false);
    });

    it("detects changed intent when same commandId is used with different revision or payload", () => {
      const original = sampleStartLiveEnvelope;
      const modifiedRevision = { ...sampleStartLiveEnvelope, expectedRevision: 99 };
      const modifiedPayload = {
        ...sampleStartLiveEnvelope,
        payload: { rebaseToNow: true },
      };

      expect(areCanonicalRequestsEqual(original, modifiedRevision)).toBe(false);
      expect(areCanonicalRequestsEqual(original, modifiedPayload)).toBe(false);
    });
  });

  describe("Authority receipt & response contracts", () => {
    it("validates committed receipt structure", () => {
      const receipt: AuthorityReceipt = sampleCommittedReceipt;
      expect(receipt.outcome).toBe("committed");
      expect(receipt.code).toBeNull();
      expect(receipt.roomRevisionAfter).toBeGreaterThan(0);
      expect(receipt.eventIds.length).toBeGreaterThan(0);
    });

    it("validates rejected receipts (stale_revision, idempotency_conflict, forbidden)", () => {
      expect(sampleStaleRejectedReceipt.outcome).toBe("rejected");
      expect(sampleStaleRejectedReceipt.code).toBe("stale_revision");

      expect(sampleIdempotencyConflictReceipt.outcome).toBe("rejected");
      expect(sampleIdempotencyConflictReceipt.code).toBe("idempotency_conflict");

      expect(sampleForbiddenReceipt.outcome).toBe("rejected");
      expect(sampleForbiddenReceipt.code).toBe("forbidden");
    });

    it("validates CommandResponse duplicate flag behavior", () => {
      const first: CommandResponse = sampleCommandResponse;
      expect(first.duplicate).toBe(false);

      const retry: CommandResponse = sampleDuplicateCommandResponse;
      expect(retry.duplicate).toBe(true);
      expect(retry.receipt).toEqual(first.receipt);
    });

    it("confirms complete rejection codes catalog", () => {
      expect(REJECTION_CODES).toContain("stale_revision");
      expect(REJECTION_CODES).toContain("idempotency_conflict");
      expect(REJECTION_CODES).toContain("another_show_active");
      expect(REJECTION_CODES).toContain("forbidden");
      expect(REJECTION_CODES).toContain("not_found");
      expect(REJECTION_CODES).toContain("invalid_state");
      expect(REJECTION_CODES).toContain("needs_ack_below_minimum");
    });
  });

  describe("RoomRead discriminated union contract", () => {
    it("ensures changed: false excludes sessions array from wire payload", () => {
      const readUnchanged: RoomRead = {
        roomId: TEST_ROOM_ID,
        revision: 4,
        serverNowMs: 1_700_000_000_000,
        clockBehindByMs: 0,
        access: {
          actorId: "actor-1",
          name: "Operator",
          role: "operator",
        },
        changed: false,
      };

      expect(readUnchanged.changed).toBe(false);
      expect("sessions" in readUnchanged).toBe(false);
    });

    it("ensures changed: true includes sessions array with server-authoritative sessions", () => {
      const readChanged: RoomRead = {
        roomId: TEST_ROOM_ID,
        revision: 4,
        serverNowMs: 1_700_000_000_000,
        clockBehindByMs: 0,
        access: {
          actorId: "actor-1",
          name: "Operator",
          role: "operator",
        },
        changed: true,
        sessions: [],
      };

      expect(readChanged.changed).toBe(true);
      expect("sessions" in readChanged).toBe(true);
      expect(Array.isArray(readChanged.sessions)).toBe(true);
    });
  });
});
