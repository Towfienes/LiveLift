import type {
  Cue,
  DerivedFrom,
  EnvironmentIdentity,
  OperatorContext,
  PlanVersion,
  ProductSnapshot,
  Receipt,
  Segment,
  Session,
  SessionEvent,
} from "@/contracts";
import { baselinePlan, currentPlan, emptyCueRun, emptySegmentRun } from "./forecast";
import { anchorMs, effectiveMinSec, hasBlockers, validatePlan } from "./plan";
import { formatClock, formatDuration, secToMs } from "./time";

/**
 * Command engine: a pure, idempotent reducer.
 *
 * - Commands carry a key (duplicate delivery returns the committed receipt) and an optional
 *   expected revision (stale commands are rejected, never blindly replayed).
 * - Time is injected (`nowMs`); simulated sessions use their own virtual clock.
 * - The baseline plan is immutable once started. In-show changes append plan revisions.
 * - Events are append-only. Ending freezes runtime; only notes and corrections may follow.
 * - A hard anchor changes only through an explicit `reanchor_segment` command.
 */

export type RejectCode =
  | "not_found"
  | "stale_revision"
  | "invalid_state"
  | "invalid_payload"
  | "plan_invalid"
  | "not_next"
  | "current_segment_active"
  | "no_active_segment"
  | "anchor_not_reached"
  | "needs_ack_below_minimum"
  | "needs_ack_required_coverage"
  | "constraint_violation"
  | "wrong_environment"
  | "already_reported";

export interface CommandBase {
  /** Idempotency key. Defaults to a deterministic per-session counter. */
  key?: string;
  actor?: string;
  /** Reject if the session has moved on since the caller rendered it. */
  expectedRevision?: number;
  /** Device time. Ignored for simulated sessions, which use their virtual clock. */
  nowMs: number;
  /** When the command carries out a shown recovery option, record the decision. */
  recoveryId?: string;
  recoveryLabel?: string;
}

export type CommandBody =
  | { type: "start_live"; rebaseToNow?: boolean }
  | { type: "start_segment"; segmentId: string }
  | {
      type: "end_segment";
      segmentId: string;
      coverage?: "complete" | "partial";
      acknowledgeBelowMinimum?: boolean;
    }
  | {
      type: "advance_segment";
      coverage?: "complete" | "partial";
      acknowledgeBelowMinimum?: boolean;
    }
  | { type: "shorten_segment"; segmentId: string; newTargetSec: number; acknowledgeBelowMinimum?: boolean }
  | { type: "extend_segment"; segmentId: string; deltaSec: number }
  | { type: "commit_end_by"; segmentId: string; endByMs: number; acknowledgeBelowMinimum?: boolean }
  | { type: "set_remaining_estimate"; segmentId: string; remainingSec: number | null }
  | { type: "skip_segment"; segmentId: string; acknowledgeCoverageLoss?: boolean }
  | { type: "reorder_segment"; segmentId: string; beforeSegmentId: string | null }
  | { type: "reanchor_segment"; segmentId: string; anchorOffsetSec: number; reason: string }
  | {
      type: "report_cue";
      cueId: string;
      report: "performed" | "attempted" | "cancelled";
      occurredAtMs?: number;
      reason?: string;
    }
  | { type: "add_note"; text: string }
  | { type: "end_live" }
  | { type: "advance_clock"; byMs: number }
  | { type: "set_clock"; toMs: number }
  | { type: "append_correction"; targetEventId: string; text: string; correctedAtMs?: number };

export type Command = CommandBase & CommandBody;
export type CommandType = CommandBody["type"];

export interface CommandResult {
  session: Session;
  receipt: Receipt;
  /** true when the key had already been committed and nothing was re-applied. */
  duplicate: boolean;
}

class Reject extends Error {
  constructor(
    public code: RejectCode,
    message: string
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Session factory
// ---------------------------------------------------------------------------

export interface CreateSessionInput {
  id: string;
  title: string;
  environment: EnvironmentIdentity;
  timezone: string;
  plannedStartMs: number;
  nowMs: number;
  objective?: string | null;
  accountLabel?: string | null;
  products?: ProductSnapshot[];
  segments?: Segment[];
  cues?: Cue[];
  scenarioId?: string | null;
  derivedFrom?: DerivedFrom | null;
  operator?: OperatorContext;
}

export const DEFAULT_OPERATOR: OperatorContext = {
  id: "op_linh",
  name: "Linh",
  role: "lead",
  isLead: true,
};

export function createSession(input: CreateSessionInput): Session {
  const segments = input.segments ?? [];
  const cues = input.cues ?? [];
  return {
    id: input.id,
    title: input.title,
    environment: input.environment,
    timezone: input.timezone,
    objective: input.objective ?? null,
    accountLabel: input.accountLabel ?? null,
    lifecycle: "planned",
    operator: input.operator ?? DEFAULT_OPERATOR,
    scenarioId: input.scenarioId ?? null,
    derivedFrom: input.derivedFrom ?? null,
    products: input.products ?? [],
    plans: [
      {
        id: `${input.id}:p1`,
        version: 1,
        kind: "baseline",
        plannedStartMs: input.plannedStartMs,
        segments,
        cues,
        createdAtMs: input.nowMs,
        reason: null,
      },
    ],
    baselineLocked: false,
    runtime: {
      startedAtMs: null,
      endedAtMs: null,
      currentSegmentId: null,
      segments: {},
      cues: {},
    },
    events: [],
    receipts: {},
    revision: 0,
    seq: { event: 0, command: 0, segment: segments.length, cue: cues.length },
    virtualNowMs: input.environment === "SIMULATED" ? input.plannedStartMs : null,
    scriptCursor: 0,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** First pending (not skipped) segment in the current plan order: the NEXT executable one. */
export function nextPendingSegment(session: Session): Segment | null {
  const plan = currentPlan(session);
  for (const seg of plan.segments) {
    const run = session.runtime.segments[seg.id];
    if (!run || run.state === "pending") return seg;
  }
  return null;
}

export function activeSegment(session: Session): Segment | null {
  const id = session.runtime.currentSegmentId;
  return id ? (currentPlan(session).segments.find((s) => s.id === id) ?? null) : null;
}

/** The clock a command will use: the virtual clock for simulated sessions, else the device time. */
export function effectiveNowMs(session: Session, deviceNowMs: number): number {
  if (session.environment === "SIMULATED") {
    return session.virtualNowMs ?? currentPlan(session).plannedStartMs;
  }
  return deviceNowMs;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Ctx {
  s: Session;
  cmd: Command;
  now: number;
  actor: string;
  eventIds: string[];
}

function reject(code: RejectCode, message: string): never {
  throw new Reject(code, message);
}

function emit(
  ctx: Ctx,
  type: SessionEvent["type"],
  summary: string,
  data: SessionEvent["data"] = {},
  occurredAtMs: number = ctx.now
): SessionEvent {
  const s = ctx.s;
  s.seq.event += 1;
  const event: SessionEvent = {
    id: `${s.id}:e${s.seq.event}`,
    seq: s.seq.event,
    type,
    occurredAtMs,
    recordedAtMs: ctx.now,
    actor: ctx.actor,
    source: s.environment === "SIMULATED" ? "simulator" : "operator",
    commandKey: ctx.cmd.key ?? "",
    planVersionId: currentPlan(s).id,
    summary,
    data,
  };
  s.events.push(event);
  ctx.eventIds.push(event.id);
  return event;
}

function segmentOrReject(ctx: Ctx, segmentId: string): Segment {
  const seg = currentPlan(ctx.s).segments.find((x) => x.id === segmentId);
  if (!seg) return reject("not_found", "That segment is not in this show.");
  return seg;
}

function requireActive(ctx: Ctx): void {
  if (ctx.s.lifecycle === "planned") reject("invalid_state", "Start LIVE first.");
  if (ctx.s.lifecycle === "ended") reject("invalid_state", "This show has ended. Runtime is frozen; add a note or correction in Review.");
}

function runOf(ctx: Ctx, segmentId: string) {
  return ctx.s.runtime.segments[segmentId] ?? emptySegmentRun();
}

function recordRecoveryDecision(ctx: Ctx): void {
  if (ctx.cmd.recoveryId) {
    emit(ctx, "recovery_selected", `Operator chose: ${ctx.cmd.recoveryLabel ?? ctx.cmd.recoveryId}`, {
      recoveryId: ctx.cmd.recoveryId,
      label: ctx.cmd.recoveryLabel ?? null,
    });
  }
}

function reviseDraftPlan(ctx: Ctx, mutate: (plan: PlanVersion) => PlanVersion, reason: string): PlanVersion {
  const s = ctx.s;
  const cur = currentPlan(s);
  const next = mutate(structuredClone(cur));
  const revised: PlanVersion = {
    ...next,
    id: `${s.id}:p${cur.version + 1}`,
    version: cur.version + 1,
    kind: "revision",
    createdAtMs: ctx.now,
    reason,
  };
  s.plans = [...s.plans, revised];
  return revised;
}

function startSegmentInternal(ctx: Ctx, seg: Segment): void {
  const s = ctx.s;
  const plan = currentPlan(s);
  const a = anchorMs(plan, seg);
  s.runtime.segments[seg.id] = {
    ...runOf(ctx, seg.id),
    state: "active",
    startedAtMs: ctx.now,
    endedAtMs: null,
  };
  s.runtime.currentSegmentId = seg.id;
  const lateBySec = a !== null && ctx.now > a ? Math.round((ctx.now - a) / 1000) : 0;
  emit(
    ctx,
    "segment_started",
    `${seg.title} started ${formatClock(ctx.now, s.timezone, true)}${lateBySec > 0 ? ` · ${formatDuration(lateBySec)} after its ${formatClock(a!, s.timezone, true)} anchor` : ""}`,
    { segmentId: seg.id, title: seg.title, anchorMs: a, lateBySec: a !== null ? lateBySec : null }
  );
}

function endSegmentInternal(
  ctx: Ctx,
  seg: Segment,
  endedBy: "advance" | "close" | "session_end",
  opts: { coverage?: "complete" | "partial"; acknowledgeBelowMinimum?: boolean } = {}
): void {
  const s = ctx.s;
  const run = runOf(ctx, seg.id);
  const startedAt = run.startedAtMs ?? ctx.now;
  const elapsedSec = Math.round((ctx.now - startedAt) / 1000);
  const floor = effectiveMinSec(seg);
  const belowMinimum = endedBy !== "session_end" && floor !== null && elapsedSec < floor;
  if (belowMinimum && !opts.acknowledgeBelowMinimum) {
    reject(
      "needs_ack_below_minimum",
      `${seg.title} has run ${formatDuration(elapsedSec)}; its minimum is ${formatDuration(floor!)}. Ending now needs an explicit minimum/coverage exception.`
    );
  }
  const coverage =
    endedBy === "session_end" ? null : (opts.coverage ?? (belowMinimum ? "partial" : "complete"));
  s.runtime.segments[seg.id] = {
    ...run,
    state: "completed",
    endedAtMs: ctx.now,
    endedBy,
    coverage,
    remainingEstimate: null,
    belowMinimum,
  };
  if (s.runtime.currentSegmentId === seg.id) s.runtime.currentSegmentId = null;
  emit(
    ctx,
    "segment_ended",
    `${seg.title} ended ${formatClock(ctx.now, s.timezone, true)} · ${formatDuration(elapsedSec)}${belowMinimum ? " · below minimum" : ""}${coverage === "partial" ? " · coverage partial" : ""}`,
    {
      segmentId: seg.id,
      title: seg.title,
      durationSec: elapsedSec,
      endedBy,
      coverage,
      belowMinimum,
    }
  );
}

function elapsedSecOf(ctx: Ctx, segmentId: string): number {
  const run = runOf(ctx, segmentId);
  return run.startedAtMs === null ? 0 : Math.round((ctx.now - run.startedAtMs) / 1000);
}

function anchorsStrictlyIncreasing(plan: PlanVersion): string | null {
  let prev: { ms: number; title: string } | null = null;
  for (const seg of plan.segments) {
    const a = anchorMs(plan, seg);
    if (a === null) continue;
    if (prev && a <= prev.ms) return `${seg.title} must stay after ${prev.title}.`;
    prev = { ms: a, title: seg.title };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleStartLive(ctx: Ctx, cmd: Extract<CommandBody, { type: "start_live" }>): void {
  const s = ctx.s;
  if (s.lifecycle !== "planned") reject("invalid_state", "This show has already started.");
  let plan = s.plans[0];
  if (cmd.rebaseToNow) plan = { ...plan, plannedStartMs: ctx.now };
  const blockers = validatePlan(plan, s.products, s.timezone).filter((i) => i.severity === "blocker");
  if (hasBlockers(blockers)) reject("plan_invalid", blockers[0].message);

  s.plans = [{ ...plan, kind: "baseline" }];
  s.baselineLocked = true;
  s.lifecycle = "active";
  s.runtime = {
    startedAtMs: ctx.now,
    endedAtMs: null,
    currentSegmentId: null,
    segments: Object.fromEntries(plan.segments.map((seg) => [seg.id, emptySegmentRun()])),
    cues: Object.fromEntries(plan.cues.map((cue) => [cue.id, emptyCueRun()])),
  };
  emit(ctx, "session_started", `LIVE tracking started ${formatClock(ctx.now, s.timezone, true)}`, {
    plannedStartMs: plan.plannedStartMs,
    rebasedToNow: Boolean(cmd.rebaseToNow),
    baselinePlanId: plan.id,
  });

  const next = nextPendingSegment(s);
  if (next) {
    const a = anchorMs(currentPlan(s), next);
    if (a === null || a <= ctx.now) startSegmentInternal(ctx, next);
  }
}

function handleStartSegment(ctx: Ctx, cmd: Extract<CommandBody, { type: "start_segment" }>): void {
  requireActive(ctx);
  const seg = segmentOrReject(ctx, cmd.segmentId);
  if (ctx.s.runtime.currentSegmentId) {
    reject("current_segment_active", "End the current segment first, or use Next segment.");
  }
  const next = nextPendingSegment(ctx.s);
  if (!next || next.id !== seg.id) {
    reject("not_next", `${seg.title} is not next in the Run of Show. Reorder it first.`);
  }
  const a = anchorMs(currentPlan(ctx.s), seg);
  if (a !== null && ctx.now < a) {
    reject(
      "anchor_not_reached",
      `${seg.title} is committed for ${formatClock(a, ctx.s.timezone, true)}. A hard anchor is not pulled forward; re-anchor it to start earlier.`
    );
  }
  startSegmentInternal(ctx, seg);
}

function handleEndSegment(ctx: Ctx, cmd: Extract<CommandBody, { type: "end_segment" }>): void {
  requireActive(ctx);
  const seg = segmentOrReject(ctx, cmd.segmentId);
  if (ctx.s.runtime.currentSegmentId !== seg.id) {
    reject("no_active_segment", `${seg.title} is not the active segment.`);
  }
  recordRecoveryDecision(ctx);
  endSegmentInternal(ctx, seg, "close", cmd);
}

function handleAdvance(ctx: Ctx, cmd: Extract<CommandBody, { type: "advance_segment" }>): void {
  requireActive(ctx);
  const s = ctx.s;
  const activeId = s.runtime.currentSegmentId;
  recordRecoveryDecision(ctx);
  if (activeId) {
    const cur = segmentOrReject(ctx, activeId);
    endSegmentInternal(ctx, cur, "advance", cmd);
  }
  const next = nextPendingSegment(s);
  if (!next) return; // Nothing left to start; the operator can End LIVE.
  const a = anchorMs(currentPlan(s), next);
  if (a !== null && ctx.now < a) {
    if (!activeId) {
      reject(
        "anchor_not_reached",
        `${next.title} is committed for ${formatClock(a, s.timezone, true)}; it starts when that time arrives.`
      );
    }
    return; // The host waits for the anchor; the buffer is real idle time, not a pulled-forward anchor.
  }
  startSegmentInternal(ctx, next);
}

function handleShorten(ctx: Ctx, cmd: Extract<CommandBody, { type: "shorten_segment" }>): void {
  requireActive(ctx);
  const seg = segmentOrReject(ctx, cmd.segmentId);
  const run = runOf(ctx, seg.id);
  if (run.state !== "pending" && run.state !== "active") {
    reject("invalid_state", `${seg.title} has already finished.`);
  }
  if (seg.targetSec === null) reject("invalid_payload", `${seg.title} has no duration to shorten.`);
  const newTarget = Math.round(cmd.newTargetSec);
  if (!(newTarget > 0) || newTarget >= seg.targetSec!) {
    reject("invalid_payload", `New duration must be shorter than ${formatDuration(seg.targetSec!)}.`);
  }
  if (run.state === "active" && newTarget < elapsedSecOf(ctx, seg.id)) {
    reject("constraint_violation", "That duration is already in the past. End the segment instead.");
  }
  const floor = effectiveMinSec(seg);
  if (floor !== null && newTarget < floor && !cmd.acknowledgeBelowMinimum) {
    reject(
      "needs_ack_below_minimum",
      `${seg.title} cannot go below ${formatDuration(floor)} without a minimum/coverage exception.`
    );
  }
  recordRecoveryDecision(ctx);
  const clearedEstimate = run.state === "active" && run.remainingEstimate !== null;
  reviseDraftPlan(
    ctx,
    (p) => ({ ...p, segments: p.segments.map((x) => (x.id === seg.id ? { ...x, targetSec: newTarget } : x)) }),
    `Shortened ${seg.title} ${formatDuration(seg.targetSec!)} → ${formatDuration(newTarget)}`
  );
  if (clearedEstimate) ctx.s.runtime.segments[seg.id] = { ...run, remainingEstimate: null };
  emit(ctx, "plan_changed", `${seg.title} shortened ${formatDuration(seg.targetSec!)} → ${formatDuration(newTarget)}`, {
    segmentId: seg.id,
    field: "targetSec",
    from: seg.targetSec,
    to: newTarget,
    belowMinimum: floor !== null && newTarget < floor,
    clearedEstimate,
  });
}

function handleExtend(ctx: Ctx, cmd: Extract<CommandBody, { type: "extend_segment" }>): void {
  requireActive(ctx);
  const seg = segmentOrReject(ctx, cmd.segmentId);
  const run = runOf(ctx, seg.id);
  if (run.state !== "pending" && run.state !== "active") {
    reject("invalid_state", `${seg.title} has already finished.`);
  }
  if (seg.targetSec === null) reject("invalid_payload", `${seg.title} has no duration to extend.`);
  const delta = Math.round(cmd.deltaSec);
  if (!(delta > 0) || delta > 3600) reject("invalid_payload", "Extension must be between 1 second and 1 hour.");
  recordRecoveryDecision(ctx);
  const to = seg.targetSec! + delta;
  reviseDraftPlan(
    ctx,
    (p) => ({ ...p, segments: p.segments.map((x) => (x.id === seg.id ? { ...x, targetSec: to } : x)) }),
    `Extended ${seg.title} ${formatDuration(seg.targetSec!)} → ${formatDuration(to)}`
  );
  emit(ctx, "plan_changed", `${seg.title} extended ${formatDuration(seg.targetSec!)} → ${formatDuration(to)}`, {
    segmentId: seg.id,
    field: "targetSec",
    from: seg.targetSec,
    to,
    belowMinimum: false,
    clearedEstimate: false,
  });
}

function handleCommitEndBy(ctx: Ctx, cmd: Extract<CommandBody, { type: "commit_end_by" }>): void {
  requireActive(ctx);
  const seg = segmentOrReject(ctx, cmd.segmentId);
  if (ctx.s.runtime.currentSegmentId !== seg.id) {
    reject("no_active_segment", `${seg.title} is not the active segment.`);
  }
  const run = runOf(ctx, seg.id);
  const startedAt = run.startedAtMs ?? ctx.now;
  if (cmd.endByMs <= ctx.now) reject("invalid_payload", "The end time must be in the future. Use End now instead.");
  const newTarget = Math.max(1, Math.round((cmd.endByMs - startedAt) / 1000));
  const floor = effectiveMinSec(seg);
  if (floor !== null && newTarget < floor && !cmd.acknowledgeBelowMinimum) {
    reject(
      "needs_ack_below_minimum",
      `Ending ${seg.title} by ${formatClock(cmd.endByMs, ctx.s.timezone, true)} is below its ${formatDuration(floor)} minimum.`
    );
  }
  if (seg.targetSec === newTarget && run.remainingEstimate === null) {
    reject("invalid_payload", `${seg.title} is already committed to end by ${formatClock(cmd.endByMs, ctx.s.timezone, true)}.`);
  }
  recordRecoveryDecision(ctx);
  const from = seg.targetSec;
  reviseDraftPlan(
    ctx,
    (p) => ({ ...p, segments: p.segments.map((x) => (x.id === seg.id ? { ...x, targetSec: newTarget } : x)) }),
    `Committed to end ${seg.title} by ${formatClock(cmd.endByMs, ctx.s.timezone, true)}`
  );
  ctx.s.runtime.segments[seg.id] = { ...run, remainingEstimate: null };
  emit(
    ctx,
    "plan_changed",
    `${seg.title}: committed to end by ${formatClock(cmd.endByMs, ctx.s.timezone, true)} (${from === null ? "no target" : formatDuration(from)} → ${formatDuration(newTarget)})`,
    {
      segmentId: seg.id,
      field: "targetSec",
      from,
      to: newTarget,
      endByMs: cmd.endByMs,
      belowMinimum: floor !== null && newTarget < floor,
      clearedEstimate: run.remainingEstimate !== null,
    }
  );
}

function handleEstimate(ctx: Ctx, cmd: Extract<CommandBody, { type: "set_remaining_estimate" }>): void {
  requireActive(ctx);
  const seg = segmentOrReject(ctx, cmd.segmentId);
  if (ctx.s.runtime.currentSegmentId !== seg.id) {
    reject("no_active_segment", `${seg.title} is not the active segment.`);
  }
  const run = runOf(ctx, seg.id);
  if (cmd.remainingSec === null) {
    ctx.s.runtime.segments[seg.id] = { ...run, remainingEstimate: null };
    emit(ctx, "remaining_estimated", `Host estimate for ${seg.title} cleared`, { segmentId: seg.id, remainingSec: null, endsAtMs: null });
    return;
  }
  const remaining = Math.round(cmd.remainingSec);
  if (!(remaining > 0) || remaining > 3600) reject("invalid_payload", "Estimate must be between 1 second and 1 hour.");
  const endsAtMs = ctx.now + secToMs(remaining);
  ctx.s.runtime.segments[seg.id] = {
    ...run,
    remainingEstimate: { endsAtMs, reportedAtMs: ctx.now },
  };
  emit(
    ctx,
    "remaining_estimated",
    `Host estimate: ${seg.title} needs ${formatDuration(remaining)} more · ends ${formatClock(endsAtMs, ctx.s.timezone, true)}`,
    { segmentId: seg.id, remainingSec: remaining, endsAtMs }
  );
}

function handleSkip(ctx: Ctx, cmd: Extract<CommandBody, { type: "skip_segment" }>): void {
  requireActive(ctx);
  const seg = segmentOrReject(ctx, cmd.segmentId);
  const run = runOf(ctx, seg.id);
  if (run.state !== "pending") {
    reject("invalid_state", run.state === "active" ? "End the active segment instead of skipping it." : `${seg.title} is already ${run.state}.`);
  }
  const anchored = seg.anchorOffsetSec !== null;
  if ((!seg.optional || anchored) && !cmd.acknowledgeCoverageLoss) {
    reject(
      "needs_ack_required_coverage",
      anchored
        ? `${seg.title} is a hard-anchored commitment. Skipping it cancels that commitment and needs explicit acknowledgement.`
        : `${seg.title} is required coverage. Skipping it needs explicit acknowledgement.`
    );
  }
  recordRecoveryDecision(ctx);
  ctx.s.runtime.segments[seg.id] = { ...run, state: "skipped", skipAcknowledged: Boolean(cmd.acknowledgeCoverageLoss) };
  emit(ctx, "segment_skipped", `${seg.title} skipped${seg.optional ? " (optional)" : " (required coverage acknowledged)"}`, {
    segmentId: seg.id,
    title: seg.title,
    optional: seg.optional,
    anchorCancelled: anchored,
  });
}

function handleReorder(ctx: Ctx, cmd: Extract<CommandBody, { type: "reorder_segment" }>): void {
  requireActive(ctx);
  const s = ctx.s;
  const segs = currentPlan(s).segments;
  const from = segs.findIndex((x) => x.id === cmd.segmentId);
  if (from < 0) reject("not_found", "That segment is not in this show.");
  const moved = segs[from];
  const run = runOf(ctx, moved.id);
  if (run.state !== "pending") reject("invalid_state", "Only pending segments can be reordered.");
  if (moved.anchorOffsetSec !== null) {
    reject("constraint_violation", `${moved.title} is hard-anchored and cannot be moved. Re-anchor it explicitly instead.`);
  }

  let boundary: number; // index (in the original array) of the segment it lands before
  if (cmd.beforeSegmentId === null) boundary = segs.length;
  else {
    boundary = segs.findIndex((x) => x.id === cmd.beforeSegmentId);
    if (boundary < 0) reject("not_found", "The destination segment is not in this show.");
    const beforeRun = runOf(ctx, cmd.beforeSegmentId);
    if (beforeRun.state !== "pending") reject("invalid_state", "A segment cannot be placed before work that already ran.");
  }
  if (boundary === from || boundary === from + 1) reject("invalid_payload", `${moved.title} is already there.`);

  const lo = Math.min(from, boundary);
  const hi = Math.max(from, boundary);
  // Moving later crosses (from, boundary); moving earlier crosses [boundary, from).
  const crossed = boundary > from ? segs.slice(from + 1, hi) : segs.slice(lo, from);
  const blocker = crossed.find((x) => x.anchorOffsetSec !== null);
  if (blocker) {
    reject("constraint_violation", `That would cross ${blocker.title}, a hard anchor. Anchors do not move implicitly.`);
  }

  const without = segs.filter((x) => x.id !== moved.id);
  const insertAt = boundary > from ? boundary - 1 : boundary;
  const reordered = [...without];
  reordered.splice(insertAt, 0, moved);
  const beforeTitle = cmd.beforeSegmentId === null ? null : segs[boundary].title;

  recordRecoveryDecision(ctx);
  reviseDraftPlan(
    ctx,
    (p) => ({ ...p, segments: reordered }),
    beforeTitle ? `Moved ${moved.title} before ${beforeTitle}` : `Moved ${moved.title} to the end`
  );
  if (boundary > from) {
    s.runtime.segments[moved.id] = { ...run, deferred: true };
  } else {
    for (const x of crossed) {
      const crossedRun = runOf(ctx, x.id);
      if (crossedRun.state === "pending") s.runtime.segments[x.id] = { ...crossedRun, deferred: true };
    }
  }
  emit(
    ctx,
    "segment_reordered",
    beforeTitle ? `${moved.title} moved before ${beforeTitle}` : `${moved.title} moved to the end`,
    { segmentId: moved.id, fromIndex: from, toIndex: insertAt, movedLater: boundary > from }
  );
}

function handleReanchor(ctx: Ctx, cmd: Extract<CommandBody, { type: "reanchor_segment" }>): void {
  requireActive(ctx);
  const seg = segmentOrReject(ctx, cmd.segmentId);
  const run = runOf(ctx, seg.id);
  if (run.state !== "pending") reject("invalid_state", `${seg.title} has already started or finished.`);
  if (seg.anchorOffsetSec === null) reject("invalid_payload", `${seg.title} is not hard-anchored.`);
  const offset = Math.round(cmd.anchorOffsetSec);
  if (!(offset >= 0)) reject("invalid_payload", "Anchor must be at or after the planned start.");
  if (offset === seg.anchorOffsetSec) reject("invalid_payload", "That is already the committed time.");
  const reason = cmd.reason.trim();
  if (reason.length < 3) reject("invalid_payload", "Give a short reason for changing the commitment.");

  const plan = currentPlan(ctx.s);
  const fromMs = anchorMs(plan, seg)!;
  const toMs = plan.plannedStartMs + secToMs(offset);
  const probe: PlanVersion = {
    ...plan,
    segments: plan.segments.map((x) => (x.id === seg.id ? { ...x, anchorOffsetSec: offset } : x)),
  };
  const orderProblem = anchorsStrictlyIncreasing(probe);
  if (orderProblem) reject("constraint_violation", orderProblem);

  recordRecoveryDecision(ctx);
  reviseDraftPlan(ctx, () => probe, `Re-anchored ${seg.title} ${formatClock(fromMs, ctx.s.timezone, true)} → ${formatClock(toMs, ctx.s.timezone, true)}: ${reason}`);
  emit(
    ctx,
    "anchor_changed",
    `${seg.title} re-anchored ${formatClock(fromMs, ctx.s.timezone, true)} → ${formatClock(toMs, ctx.s.timezone, true)} · baseline commitment unchanged`,
    {
      segmentId: seg.id,
      fromMs,
      toMs,
      deltaSec: Math.round((toMs - fromMs) / 1000),
      baselineMs: anchorMsOfBaseline(ctx.s, seg.id),
      reason,
    }
  );
}

function anchorMsOfBaseline(s: Session, segmentId: string): number | null {
  const base = baselinePlan(s);
  const seg = base.segments.find((x) => x.id === segmentId);
  return seg ? anchorMs(base, seg) : null;
}

function handleReportCue(ctx: Ctx, cmd: Extract<CommandBody, { type: "report_cue" }>): void {
  requireActive(ctx);
  const s = ctx.s;
  const cue = currentPlan(s).cues.find((c) => c.id === cmd.cueId);
  if (!cue) return reject("not_found", "That cue is not in this show.");
  if (cue.audience !== "operator") {
    reject("invalid_payload", "Presenter cues are informational; there is nothing to report.");
  }
  const prev = s.runtime.cues[cue.id] ?? emptyCueRun();
  if (prev.state === "performed" || prev.state === "cancelled") {
    reject("already_reported", `This cue is already recorded as ${prev.state}. Corrections are appended in Review.`);
  }
  if (prev.state === "attempted" && cmd.report === "attempted") {
    reject("already_reported", "An attempt is already recorded for this cue.");
  }
  const reason = cmd.reason?.trim() ?? "";
  if (cmd.report === "cancelled" && reason.length < 3) {
    reject("invalid_payload", "Give a short reason for cancelling the cue.");
  }
  const occurredAt = cmd.report === "cancelled" ? null : (cmd.occurredAtMs ?? ctx.now);
  if (occurredAt !== null && (occurredAt > ctx.now || occurredAt < (s.runtime.startedAtMs ?? 0))) {
    reject("invalid_payload", "The reported time must be between the start of the show and now.");
  }
  s.runtime.cues[cue.id] = {
    state: cmd.report,
    occurredAtMs: occurredAt,
    reportedAtMs: ctx.now,
    reason: reason || null,
  };
  const verb = cmd.report === "performed" ? "reported performed" : cmd.report === "attempted" ? "reported attempted" : "cancelled";
  emit(
    ctx,
    "cue_reported",
    `${cue.title} ${verb}${occurredAt !== null ? ` at ${formatClock(occurredAt, s.timezone, true)}` : ""} · platform verification unknown`,
    {
      cueId: cue.id,
      title: cue.title,
      action: cue.action,
      report: cmd.report,
      occurredAtMs: occurredAt,
      reason: reason || null,
      verification: "unknown",
    },
    occurredAt ?? ctx.now
  );
}

function handleNote(ctx: Ctx, cmd: Extract<CommandBody, { type: "add_note" }>): void {
  if (ctx.s.lifecycle === "planned") reject("invalid_state", "Start LIVE before adding runtime notes.");
  const text = cmd.text.trim();
  if (text === "") reject("invalid_payload", "A note cannot be empty.");
  if (text.length > 500) reject("invalid_payload", "Keep notes under 500 characters.");
  emit(ctx, "note_added", `Note: ${text}`, { text });
}

function handleEndLive(ctx: Ctx): void {
  requireActive(ctx);
  const s = ctx.s;
  const activeId = s.runtime.currentSegmentId;
  if (activeId) endSegmentInternal(ctx, segmentOrReject(ctx, activeId), "session_end");
  const pending = currentPlan(s).segments.filter((x) => runOf(ctx, x.id).state === "pending");
  s.runtime.endedAtMs = ctx.now;
  s.lifecycle = "ended";
  emit(ctx, "session_ended", `LIVE tracking ended ${formatClock(ctx.now, s.timezone, true)}. Runtime frozen.`, {
    notReached: pending.length,
  });
}

function handleClock(ctx: Ctx, cmd: Extract<CommandBody, { type: "advance_clock" | "set_clock" }>): void {
  const s = ctx.s;
  if (s.environment !== "SIMULATED") {
    reject("wrong_environment", "Only simulated sessions run on a virtual clock. REAL sessions use the device clock.");
  }
  if (s.lifecycle === "ended") reject("invalid_state", "This rehearsal has ended.");
  const from = s.virtualNowMs ?? currentPlan(s).plannedStartMs;
  const to = cmd.type === "advance_clock" ? from + cmd.byMs : cmd.toMs;
  if (!(to > from)) reject("invalid_payload", "The virtual clock only moves forward.");
  s.virtualNowMs = to;
  ctx.now = to;
  emit(ctx, "clock_advanced", `Virtual clock ${formatClock(from, s.timezone, true)} → ${formatClock(to, s.timezone, true)}`, {
    fromMs: from,
    toMs: to,
  });
}

function handleCorrection(ctx: Ctx, cmd: Extract<CommandBody, { type: "append_correction" }>): void {
  if (ctx.s.lifecycle !== "ended") reject("invalid_state", "Corrections are appended after the show has ended.");
  const target = ctx.s.events.find((e) => e.id === cmd.targetEventId);
  if (!target) reject("not_found", "That record is not in this show's history.");
  const text = cmd.text.trim();
  if (text.length < 3) reject("invalid_payload", "Describe the correction.");
  emit(ctx, "correction_added", `Correction to "${target!.summary}": ${text}. Original record retained.`, {
    targetEventId: cmd.targetEventId,
    text,
    correctedAtMs: cmd.correctedAtMs ?? null,
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function applyCommand(session: Session, cmd: Command): CommandResult {
  const key = cmd.key ?? `${session.id}:c${session.seq.command + 1}`;

  const existing = session.receipts[key];
  if (existing) return { session, receipt: existing, duplicate: true };

  const rejectedReceipt = (code: RejectCode, message: string): CommandResult => ({
    session,
    duplicate: false,
    receipt: {
      commandKey: key,
      type: cmd.type,
      outcome: "rejected",
      code,
      message,
      revisionAfter: session.revision,
      eventIds: [],
    },
  });

  if (cmd.expectedRevision !== undefined && cmd.expectedRevision !== session.revision) {
    return rejectedReceipt(
      "stale_revision",
      "The show changed since this screen was rendered. Review the current state and act again."
    );
  }

  const draft = structuredClone(session);
  // Time is monotonic: never record before the latest recorded event.
  const lastRecorded = draft.events.length > 0 ? draft.events[draft.events.length - 1].recordedAtMs : -Infinity;
  const now = Math.max(effectiveNowMs(draft, cmd.nowMs), lastRecorded);
  const ctx: Ctx = {
    s: draft,
    cmd: { ...cmd, key },
    now,
    actor: cmd.actor ?? draft.operator.name,
    eventIds: [],
  };

  try {
    switch (cmd.type) {
      case "start_live":
        handleStartLive(ctx, cmd);
        break;
      case "start_segment":
        handleStartSegment(ctx, cmd);
        break;
      case "end_segment":
        handleEndSegment(ctx, cmd);
        break;
      case "advance_segment":
        handleAdvance(ctx, cmd);
        break;
      case "shorten_segment":
        handleShorten(ctx, cmd);
        break;
      case "extend_segment":
        handleExtend(ctx, cmd);
        break;
      case "commit_end_by":
        handleCommitEndBy(ctx, cmd);
        break;
      case "set_remaining_estimate":
        handleEstimate(ctx, cmd);
        break;
      case "skip_segment":
        handleSkip(ctx, cmd);
        break;
      case "reorder_segment":
        handleReorder(ctx, cmd);
        break;
      case "reanchor_segment":
        handleReanchor(ctx, cmd);
        break;
      case "report_cue":
        handleReportCue(ctx, cmd);
        break;
      case "add_note":
        handleNote(ctx, cmd);
        break;
      case "end_live":
        handleEndLive(ctx);
        break;
      case "advance_clock":
      case "set_clock":
        handleClock(ctx, cmd);
        break;
      case "append_correction":
        handleCorrection(ctx, cmd);
        break;
      default: {
        const exhaustive: never = cmd;
        return rejectedReceipt("invalid_payload", `Unknown command ${(exhaustive as { type: string }).type}.`);
      }
    }
  } catch (err) {
    if (err instanceof Reject) return rejectedReceipt(err.code, err.message);
    throw err;
  }

  draft.seq.command += 1;
  draft.revision += 1;
  draft.updatedAtMs = ctx.now;
  const receipt: Receipt = {
    commandKey: key,
    type: cmd.type,
    outcome: "committed",
    code: null,
    message: null,
    revisionAfter: draft.revision,
    eventIds: ctx.eventIds,
  };
  draft.receipts[key] = receipt;
  return { session: draft, receipt, duplicate: false };
}
