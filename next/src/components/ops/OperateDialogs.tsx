"use client";

import React, { useMemo, useState } from "react";
import type { Cue, Session } from "@/contracts";
import {
  applyCommand,
  baselinePlan,
  currentPlan,
  emptyCueRun,
  emptySegmentRun,
  forecastSession,
  formatClock,
  formatDuration,
  msToZonedParts,
  zonedTimeToMs,
  type RecoveryAnalysis,
  type RecoveryOption,
} from "@/lib/domain";
import { Dialog } from "@/components/ui";
import { Signal } from "./StatusChips";

const INPUT =
  "w-full h-11 bg-[#13161C] border border-[#39414D] rounded-[8px] px-3 text-[16px] text-[#F5F7FC] tabular-nums";

// ---------------------------------------------------------------------------------------------

export function EndLiveDialog({
  isOpen,
  onClose,
  onConfirm,
  session,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  session: Session;
}): React.ReactElement {
  const plan = currentPlan(session);
  const notReached = plan.segments.filter((s) => (session.runtime.segments[s.id] ?? emptySegmentRun()).state === "pending");
  const unreported = plan.cues.filter(
    (c) => c.audience === "operator" && (session.runtime.cues[c.id] ?? emptyCueRun()).state === "pending"
  );
  const running = session.runtime.currentSegmentId !== null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="End LIVE tracking?"
      confirmText="End tracking"
      cancelText="Keep operating"
      onConfirm={onConfirm}
    >
      <div className="space-y-3 text-[15px] leading-relaxed text-[#CAD0DA]" data-testid="end-live-dialog">
        <p>
          This stops <strong className="text-[#F5F7FC]">LiveLift tracking</strong>. It does not stop your platform broadcast — end that in
          TikTok LIVE Manager separately.
        </p>
        <ul className="space-y-1.5 text-[14px]">
          {running && <li>The running segment will be closed with the show; its coverage stays undeclared.</li>}
          <li>
            {notReached.length === 0
              ? "Every segment has run or been skipped."
              : `${notReached.length} segment${notReached.length === 1 ? "" : "s"} not reached (${notReached.map((s) => s.title).join(", ")}) will be recorded as "not reached" — not as zero-length.`}
          </li>
          <li>
            {unreported.length === 0
              ? "Every operator cue has a report."
              : `${unreported.length} operator cue${unreported.length === 1 ? " has" : "s have"} no report (${unreported.map((c) => c.title).join(", ")}). They will be recorded as "no report" — unknown, not failed.`}
          </li>
        </ul>
        <p className="text-[14px] text-[#9AA5B5]">After ending, the runtime is frozen. Review can append notes and corrections but never rewrites what happened.</p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function AckDialog({
  isOpen,
  title,
  message,
  confirmText,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  onClose: () => void;
  onConfirm: () => void;
}): React.ReactElement {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} confirmText={confirmText} onConfirm={onConfirm} size="sm">
      <p className="text-[15px] leading-relaxed text-[#CAD0DA]" data-testid="ack-message">
        {message}
      </p>
      <p className="text-[13px] text-[#9AA5B5] mt-3">The exception is recorded in the history. Nothing is hidden or rewritten.</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function ReanchorDialog({
  isOpen,
  onClose,
  onConfirm,
  session,
  nowMs,
  segmentId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (input: { segmentId: string; anchorOffsetSec: number; reason: string }) => void;
  session: Session;
  nowMs: number;
  segmentId: string | null;
}): React.ReactElement | null {
  const plan = currentPlan(session);
  const tz = session.timezone;
  const segment = plan.segments.find((s) => s.id === segmentId);
  const committed = segment ? plan.plannedStartMs + (segment.anchorOffsetSec ?? 0) * 1000 : nowMs;
  const projected = useMemo(() => {
    if (!segment) return committed;
    const f = forecastSession(session, nowMs).segments.find((x) => x.segmentId === segment.id);
    return f?.startMs ?? committed;
  }, [session, nowMs, segment, committed]);

  const [timeText, setTimeText] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const text = timeText ?? formatClock(Math.max(projected, committed), tz, true);

  const parsed = useMemo(() => {
    const date = msToZonedParts(committed, tz).date;
    let ms = zonedTimeToMs(date, text.length === 5 ? `${text}:00` : text, tz);
    if (ms !== null && ms < plan.plannedStartMs) ms += 86_400_000;
    return ms;
  }, [text, committed, tz, plan.plannedStartMs]);

  const offset = parsed === null ? null : Math.round((parsed - plan.plannedStartMs) / 1000);
  const preview = useMemo(() => {
    if (!segment || offset === null || reason.trim().length < 3) return null;
    const res = applyCommand(session, {
      type: "reanchor_segment",
      segmentId: segment.id,
      anchorOffsetSec: offset,
      reason: reason.trim(),
      nowMs,
      key: "preview",
    });
    if (res.receipt.outcome !== "committed") {
      return { error: res.receipt.message ?? "Not allowed.", stillBroken: [] as Array<{ segmentId: string }> };
    }
    const f = forecastSession(res.session, nowMs);
    const stillBroken = f.segments.filter(
      (s) => s.state === "pending" && s.anchor && (s.anchor.status === "at_risk" || s.anchor.status === "missed")
    );
    return { error: null, stillBroken };
  }, [session, nowMs, segment, offset, reason]);

  if (!segment) return null;
  const valid = offset !== null && offset >= 0 && offset !== segment.anchorOffsetSec && reason.trim().length >= 3 && !preview?.error;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Re-anchor ${segment.title}`}
      confirmText="Record new commitment"
      onConfirm={() => offset !== null && onConfirm({ segmentId: segment.id, anchorOffsetSec: offset, reason: reason.trim() })}
      confirmDisabled={!valid}
    >
      <div className="space-y-4" data-testid="reanchor-dialog">
        <p className="text-[14px] text-[#CAD0DA] leading-relaxed">
          A hard anchor is a commitment. Changing it is a <strong className="text-[#F5F7FC]">new plan version</strong>, not a recovery:
          the original <span className="tabular-nums">{formatClock(baselinePlanAnchor(session, segment.id) ?? committed, tz, true)}</span>{" "}
          stays in the baseline and in Review.
        </p>
        <div>
          <label htmlFor="reanchor-time" className="block text-[14px] text-[#CAD0DA] mb-1">
            New committed start ({tz})
          </label>
          <input
            id="reanchor-time"
            data-testid="reanchor-time"
            data-autofocus
            type="time"
            step={1}
            value={text}
            onChange={(e) => setTimeText(e.target.value)}
            className={INPUT}
          />
          <p className="text-[13px] text-[#9AA5B5] mt-1">
            Currently {formatClock(committed, tz, true)} · earliest projected arrival {formatClock(projected, tz, true)}
          </p>
        </div>
        <div>
          <label htmlFor="reanchor-reason" className="block text-[14px] text-[#CAD0DA] mb-1">
            Reason (recorded with the change)
          </label>
          <input
            id="reanchor-reason"
            data-testid="reanchor-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Host needs two more minutes on the current product"
            className={INPUT}
          />
        </div>
        {preview?.error && <Signal tone="danger" icon="ri-error-warning-line">{preview.error}</Signal>}
        {preview && !preview.error && (
          <div className="text-[14px] text-[#CAD0DA]" data-testid="reanchor-preview">
            {preview.stillBroken.length === 0 ? (
              <Signal tone="neutral" icon="ri-checkbox-circle-line">After this change no other commitment is at risk.</Signal>
            ) : (
              <Signal tone="warn" icon="ri-error-warning-line">
                Still at risk after this change:{" "}
                {preview.stillBroken.map((s) => currentPlan(session).segments.find((x) => x.id === s.segmentId)?.title).join(", ")}.
              </Signal>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function baselinePlanAnchor(session: Session, segmentId: string): number | null {
  const base = baselinePlan(session);
  const seg = base.segments.find((s) => s.id === segmentId);
  return seg && seg.anchorOffsetSec !== null ? base.plannedStartMs + seg.anchorOffsetSec * 1000 : null;
}

// ---------------------------------------------------------------------------------------------

export function ChooseNextDialog({
  isOpen,
  onClose,
  onChoose,
  session,
  nowMs,
}: {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (segmentId: string) => void;
  session: Session;
  nowMs: number;
}): React.ReactElement {
  const plan = currentPlan(session);
  const pending = plan.segments.filter((s) => (session.runtime.segments[s.id] ?? emptySegmentRun()).state === "pending");
  const next = pending[0];

  const rows = pending.map((seg, i) => {
    if (i === 0) return { seg, blocked: "Already next" };
    const res = applyCommand(session, {
      type: "reorder_segment",
      segmentId: seg.id,
      beforeSegmentId: next.id,
      nowMs,
      key: "preview",
    });
    return { seg, blocked: res.receipt.outcome === "committed" ? null : (res.receipt.message ?? "Not allowed") };
  });

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Choose next" cancelText="Close" size="md"
      description="Reordering is an explicit plan change. It cannot cross a hard anchor or work that already ran.">
      <ul className="space-y-2 pb-1" data-testid="choose-next-list">
        {rows.map(({ seg, blocked }) => (
          <li key={seg.id} className="p-3 rounded-[8px] bg-[#14171E] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-medium text-[#F5F7FC] truncate">{seg.title}</p>
              <p className="text-[13px] text-[#9AA5B5]">
                {seg.targetSec !== null ? formatDuration(seg.targetSec) : "no duration"}
                {seg.anchorOffsetSec !== null ? " · hard anchor" : ""}
                {seg.optional ? " · optional" : ""}
              </p>
              {blocked && blocked !== "Already next" && <p className="text-[13px] text-[#F6C875] mt-0.5">{blocked}</p>}
            </div>
            <button
              type="button"
              disabled={blocked !== null}
              onClick={() => onChoose(seg.id)}
              data-testid={`choose-next-${seg.id}`}
              className="min-h-[40px] px-3 rounded-[8px] text-[14px] font-medium bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {blocked === "Already next" ? "Already next" : "Run next"}
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="text-[14px] text-[#9AA5B5]">No pending segments.</li>}
      </ul>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function SkipDialog({
  isOpen,
  onClose,
  onSkip,
  session,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSkip: (segmentId: string) => void;
  session: Session;
}): React.ReactElement {
  const plan = currentPlan(session);
  const pending = plan.segments.filter((s) => (session.runtime.segments[s.id] ?? emptySegmentRun()).state === "pending");
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Skip a segment" cancelText="Close"
      description="Skipped segments are recorded as skipped — never as performed. Required coverage needs acknowledgement.">
      <ul className="space-y-2 pb-1" data-testid="skip-list">
        {pending.map((seg) => (
          <li key={seg.id} className="p-3 rounded-[8px] bg-[#14171E] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-medium text-[#F5F7FC] truncate">{seg.title}</p>
              <p className="text-[13px] text-[#9AA5B5]">
                {seg.optional ? "Optional" : "Required coverage"}
                {seg.anchorOffsetSec !== null ? " · hard anchor (a commitment)" : ""}
                {seg.targetSec !== null ? ` · frees ${formatDuration(seg.targetSec)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSkip(seg.id)}
              data-testid={`skip-${seg.id}`}
              className="min-h-[40px] px-3 rounded-[8px] text-[14px] font-medium bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944] cursor-pointer whitespace-nowrap"
            >
              Skip
            </button>
          </li>
        ))}
        {pending.length === 0 && <li className="text-[14px] text-[#9AA5B5]">No pending segments.</li>}
      </ul>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function CueReportDialog({
  isOpen,
  onClose,
  onConfirm,
  cue,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (input: { report: "performed" | "attempted" | "cancelled"; secondsAgo: number; reason: string }) => void;
  cue: Cue | null;
}): React.ReactElement | null {
  const [report, setReport] = useState<"performed" | "attempted" | "cancelled">("performed");
  const [secondsAgo, setSecondsAgo] = useState(15);
  const [reason, setReason] = useState("");
  if (!cue) return null;
  const valid = report !== "cancelled" || reason.trim().length >= 3;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Report: ${cue.title}`}
      confirmText="Record report"
      onConfirm={() => onConfirm({ report, secondsAgo, reason: reason.trim() })}
      confirmDisabled={!valid}
    >
      <div className="space-y-4" data-testid="cue-report-dialog">
        <fieldset>
          <legend className="text-[14px] text-[#CAD0DA] mb-1.5">What happened?</legend>
          <div className="space-y-1.5">
            {(
              [
                ["performed", "I performed this in TikTok"],
                ["attempted", "I attempted it — the outcome is unknown"],
                ["cancelled", "We decided not to do it (cancel the cue)"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer text-[15px] text-[#F5F7FC]">
                <input type="radio" name="cue-report" checked={report === value} onChange={() => setReport(value)} className="accent-[#DFFF00]" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {report !== "cancelled" ? (
          <div>
            <label htmlFor="cue-when" className="block text-[14px] text-[#CAD0DA] mb-1">
              It happened
            </label>
            <select id="cue-when" value={secondsAgo} onChange={(e) => setSecondsAgo(Number(e.target.value))} className={INPUT}>
              <option value={0}>just now</option>
              <option value={15}>15 seconds ago</option>
              <option value={30}>30 seconds ago</option>
              <option value={60}>1 minute ago</option>
              <option value={120}>2 minutes ago</option>
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="cue-reason" className="block text-[14px] text-[#CAD0DA] mb-1">
              Reason (recorded; never relabelled as performed)
            </label>
            <input id="cue-reason" data-testid="cue-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={INPUT} />
          </div>
        )}
        <p className="text-[13px] text-[#9AA5B5]">A report records what the operator says. It is not platform confirmation; verification stays unknown.</p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function NoteDialog({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
}): React.ReactElement {
  const [text, setText] = useState("");
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add a note"
      confirmText="Save note"
      onConfirm={() => {
        onSave(text);
        setText("");
      }}
      confirmDisabled={text.trim() === ""}
    >
      <textarea
        data-testid="note-input"
        data-autofocus
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        placeholder="e.g. Viewers keep asking about waist sizing."
        className="w-full bg-[#13161C] border border-[#39414D] rounded-[8px] p-3 text-[15px] text-[#F5F7FC]"
      />
      <p className="text-[13px] text-[#9AA5B5] mt-2">Notes are timestamped and attributed. They never change the plan.</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function AllOptionsDialog({
  isOpen,
  onClose,
  analysis,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  analysis: RecoveryAnalysis;
  onApply: (option: RecoveryOption) => void;
}): React.ReactElement {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Recovery options" cancelText="Close" size="lg"
      description="Each option shows what it frees and what it costs. Nothing runs until you choose it, and a hard anchor never moves unless you re-anchor it.">
      <div className="pb-1" data-testid="all-options-dialog">
        {analysis.status === "no_feasible_recovery" && (
          <p className="mb-3 text-[15px] font-medium text-[#F6C875]">
            <i className="ri-error-warning-line mr-1.5" aria-hidden="true" />
            No feasible recovery under current constraints. Clean options free at most {formatDuration(analysis.maxCleanSavingsSec)}; the
            deficit is {formatDuration(analysis.deficitSec)}.
          </p>
        )}
        <ul className="divide-y divide-[#262C38]">
          {analysis.options.map((o) => (
            <li key={o.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[16px] font-medium text-[#F5F7FC]">{o.label}</p>
                <p className="text-[14px] text-[#B7C1CE] mt-0.5">{o.detail}</p>
                <p className="text-[13px] mt-1 text-[#9AA5B5] tabular-nums">
                  Frees {formatDuration(o.savesSec)} · leaves {formatDuration(o.resultingDeficitSec)} late ·{" "}
                  {o.exception ? (o.exception.code === "commitment_change" ? "commitment change" : "needs an exception") : "respects minimums and required coverage"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onApply(o)}
                className="min-h-[40px] px-3 rounded-[8px] text-[14px] font-medium bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944] cursor-pointer whitespace-nowrap"
              >
                {o.exception?.code === "commitment_change" ? "Review" : "Apply"}
              </button>
            </li>
          ))}
          {analysis.options.length === 0 && <li className="py-3 text-[14px] text-[#9AA5B5]">Nothing needs recovering.</li>}
        </ul>
      </div>
    </Dialog>
  );
}
