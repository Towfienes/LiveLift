"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@/contracts";
import { FocusedShell, StandardShell } from "@/components/shell";
import { Button, InlineNotice } from "@/components/ui";
import { SessionGate } from "@/components/ops/SessionGate";
import { NowPanel } from "@/components/ops/NowPanel";
import { NextPanel } from "@/components/ops/NextPanel";
import { CueBar } from "@/components/ops/CueBar";
import { RunOfShowLive, scrollCurrentRowIntoView } from "@/components/ops/RunOfShowLive";
import { SupportTabs } from "@/components/ops/SupportTabs";
import { SimulatorStrip } from "@/components/ops/SimulatorStrip";
import { Drift } from "@/components/ops/StatusChips";
import {
  AckDialog,
  AllOptionsDialog,
  ChooseNextDialog,
  CueReportDialog,
  EndLiveDialog,
  NoteDialog,
  ReanchorDialog,
  SkipDialog,
} from "@/components/ops/OperateDialogs";
import {
  SCENARIO_BY_ID,
  activeSegment,
  analyzeRecovery,
  applyCommand,
  currentPlan,
  effectiveNowMs,
  forecastSession,
  formatClock,
  formatDuration,
  nextPendingSegment,
  type RecoveryOption,
  type ScenarioId,
} from "@/lib/domain";
import { sessionStore, type DispatchInput } from "@/lib/store/sessionStore";
import { useNow, useSessionActions, useStoreState } from "@/lib/store/hooks";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function OperatePage({ params }: PageProps): React.ReactElement {
  const { sessionId } = use(params);
  return <SessionGate id={sessionId}>{(session) => <OperateRoot session={session} />}</SessionGate>;
}

/** The desk only exists while a show is running. Other lifecycles point to where the work is. */
function OperateRoot({ session }: { session: Session }): React.ReactElement {
  if (session.lifecycle === "active") return <LiveClock session={session} />;
  const ended = session.lifecycle === "ended";
  return (
    <StandardShell>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="operate-not-running">
        <h1 className="text-[28px] font-medium text-[#F5F7FC]">{ended ? "This show has ended" : "This show has not started"}</h1>
        <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[520px]">
          {ended
            ? "The runtime is frozen. Plan vs Actual, the history and Next LIVE adjustments are in Review."
            : "Prepare the Run of Show, then start LIVE to open the operating desk."}
        </p>
        <Link href={`/live/${session.id}/${ended ? "review" : "prepare"}`} className="mt-6">
          <Button variant="primary" size="lg" icon="ri-arrow-right-line">
            {ended ? "Open Review" : "Open Prepare"}
          </Button>
        </Link>
      </div>
    </StandardShell>
  );
}

function LiveClock({ session }: { session: Session }): React.ReactElement {
  const nowMs = useNow(session);
  if (nowMs === null) {
    return (
      <FocusedShell
        sessionTitle={session.title}
        environment={session.environment}
        elapsedLabel={null}
        tracking="active"
        operator={session.operator}
        accountLabel={session.accountLabel}
      >
        <div className="p-8 text-[#9AA5B5]" role="status">
          Loading desk…
        </div>
      </FocusedShell>
    );
  }
  return <Desk session={session} nowMs={nowMs} />;
}

type DialogId = "end" | "reanchor" | "choose" | "skip" | "note" | "options" | "cue" | null;

interface AckState {
  title: string;
  message: string;
  confirmText: string;
  body: DispatchInput;
}

function Desk({ session, nowMs }: { session: Session; nowMs: number }): React.ReactElement {
  const router = useRouter();
  const { dispatch } = useSessionActions(session);
  const storeState = useStoreState();

  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogId>(null);
  const [ack, setAck] = useState<AckState | null>(null);
  const [reanchorId, setReanchorId] = useState<string | null>(null);
  const [cueId, setCueId] = useState<string | null>(null);

  // A recorded-command acknowledgement is routine: it fades after a few seconds. Errors stay until dismissed.
  useEffect(() => {
    if (notice?.tone !== "ok") return;
    const timer = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const tz = session.timezone;
  const plan = currentPlan(session);
  const simulated = session.environment === "SIMULATED";
  const forecast = useMemo(() => forecastSession(session, nowMs), [session, nowMs]);
  const analysis = useMemo(() => analyzeRecovery(session, nowMs), [session, nowMs]);

  const active = activeSegment(session);
  const activeRun = active ? (session.runtime.segments[active.id] ?? null) : null;
  const next = nextPendingSegment(session);
  const nextFc = next ? (forecast.segments.find((s) => s.segmentId === next.id) ?? null) : null;
  const productById = useMemo(() => new Map(session.products.map((p) => [p.id, p])), [session.products]);
  const position = {
    index: active ? plan.segments.findIndex((s) => s.id === active.id) + 1 : 0,
    total: plan.segments.length,
  };
  const startedAt = session.runtime.startedAtMs ?? nowMs;
  const elapsedLabel = formatDuration(Math.max(0, Math.round((nowMs - startedAt) / 1000)));

  // ---- Command plumbing -------------------------------------------------------------------

  const run = useCallback(
    (body: DispatchInput, opts: { ackTitle?: string } = {}): boolean => {
      const res = dispatch(body);
      if (!res) return false;
      if (res.receipt.outcome === "committed") {
        const events = res.session.events;
        const last = events[events.length - 1];
        setNotice({ tone: "ok", text: last ? last.summary : "Recorded." });
        return true;
      }
      const code = res.receipt.code;
      if (code === "needs_ack_below_minimum" || code === "needs_ack_required_coverage") {
        setAck({
          title: opts.ackTitle ?? (code === "needs_ack_below_minimum" ? "Below the declared minimum" : "Required coverage"),
          message: res.receipt.message ?? "This needs an explicit exception.",
          confirmText: "Proceed with exception",
          body:
            code === "needs_ack_below_minimum"
              ? ({ ...body, acknowledgeBelowMinimum: true } as DispatchInput)
              : ({ ...body, acknowledgeCoverageLoss: true } as DispatchInput),
        });
        return false;
      }
      setNotice({ tone: "error", text: res.receipt.message ?? "That was not accepted." });
      return false;
    },
    [dispatch]
  );

  const applyOption = (o: RecoveryOption): void => {
    setDialog(null);
    if (o.kind === "reanchor") {
      setReanchorId(o.command.type === "reanchor_segment" ? o.command.segmentId : null);
      setDialog("reanchor");
      return;
    }
    const body: DispatchInput = { ...o.command, recoveryId: o.id, recoveryLabel: o.label };
    if (o.exception) {
      setAck({
        title: o.exception.code === "commitment_change" ? "Change a commitment" : "Needs an exception",
        message: `${o.exception.message} ${o.detail}`,
        confirmText: "Apply with exception",
        body,
      });
      return;
    }
    run(body);
  };

  const confirmAck = (): void => {
    if (!ack) return;
    const body = ack.body;
    setAck(null);
    run(body);
  };

  const openReanchorForNext = (): void => {
    const id = forecast.nextAnchorSegmentId ?? analysis.criticalSegmentId;
    if (!id) {
      setNotice({ tone: "error", text: "There is no hard-anchored segment ahead to re-anchor." });
      return;
    }
    setReanchorId(id);
    setDialog("reanchor");
  };

  // Extension cost, shown BEFORE the operator commits.
  const extendHint = useMemo(() => {
    if (!active) return null;
    const res = applyCommand(session, { type: "extend_segment", segmentId: active.id, deltaSec: 60, nowMs, key: "preview" });
    if (res.receipt.outcome !== "committed") return null;
    const anchorId = forecast.nextAnchorSegmentId;
    if (!anchorId) return { tone: "muted" as const, text: "no anchor affected", full: "No hard anchor ahead is affected" };
    const before = forecast.segments.find((s) => s.segmentId === anchorId)?.anchor;
    const after = forecastSession(res.session, nowMs).segments.find((s) => s.segmentId === anchorId)?.anchor;
    if (!before || !after) return null;
    const title = plan.segments.find((s) => s.id === anchorId)?.title ?? "anchor";
    const extra = after.deficitSec - before.deficitSec;
    if (extra > 0) return { tone: "warn" as const, text: `+${formatDuration(extra)} late`, full: `+${formatDuration(extra)} late for ${title}` };
    if (before.status === "at_risk" || before.status === "missed") {
      return {
        tone: "warn" as const,
        text: `already ${formatDuration(before.deficitSec)} late`,
        full: `${title} is already ${formatDuration(before.deficitSec)} late; this does not change the forecast`,
      };
    }
    if (after.bufferSec < before.bufferSec) {
      return { tone: "muted" as const, text: `uses buffer · ${formatDuration(after.bufferSec)} left`, full: `Uses 1:00 of the buffer before ${title}` };
    }
    return { tone: "muted" as const, text: "forecast unchanged", full: "Does not change the forecast" };
  }, [session, nowMs, active, forecast, plan.segments]);

  // ---- Simulator --------------------------------------------------------------------------

  const scenario = session.scenarioId ? SCENARIO_BY_ID[session.scenarioId as ScenarioId] : undefined;
  const stepDef = scenario?.script[session.scriptCursor];
  const virtualNow = effectiveNowMs(session, nowMs);
  const nextAnchorMs = forecast.anchorGuard?.committedMs ?? null;

  const simApplyStep = (): void => {
    const r = sessionStore.applyNextScriptStep(session.id);
    if (!r) return;
    if (r.receipt?.outcome === "rejected") setSimMessage(`${r.receipt.message ?? "Step rejected"} Skip it if you already did this by hand.`);
    else {
      setSimMessage(null);
      if (r.receipt) setNotice({ tone: "ok", text: r.step?.label ?? "Step applied." });
    }
  };

  // ---- Render ------------------------------------------------------------------------------

  const cue = cueId ? (plan.cues.find((c) => c.id === cueId) ?? null) : null;
  const deviceNow = (): number => effectiveNowMs(session, Date.now());

  return (
    <FocusedShell
      sessionTitle={session.title}
      environment={session.environment}
      elapsedLabel={elapsedLabel}
      tracking="active"
      operator={session.operator}
      accountLabel={session.accountLabel}
      onEndLiveClick={() => setDialog("end")}
      contextExtra={
        simulated ? (
          <SimulatorStrip
            virtualNowMs={virtualNow}
            tz={tz}
            nextAnchorMs={nextAnchorMs}
            scripted={Boolean(scenario)}
            step={
              scenario && stepDef
                ? { index: session.scriptCursor, total: scenario.script.length, label: stepDef.label }
                : null
            }
            onAdvance={(sec) => run({ type: "advance_clock", byMs: sec * 1000 })}
            onToAnchor={() => nextAnchorMs !== null && run({ type: "set_clock", toMs: nextAnchorMs - 60_000 })}
            onApplyStep={simApplyStep}
            onSkipStep={() => sessionStore.skipNextScriptStep(session.id)}
            message={simMessage}
          />
        ) : undefined
      }
    >
      <div className="h-full flex flex-col gap-3 p-3 [@media(min-height:860px)]:lg:p-4 max-w-[1720px] w-full mx-auto">
        {storeState.storage !== "ok" && storeState.hydrated && (
          <InlineNotice
            variant="warning"
            title={storeState.storage === "write_failed" ? "Latest changes could not be saved" : "Not being saved"}
            message="Browser storage is not accepting writes. The show continues, but a reload would lose recent work."
          />
        )}

        {notice && (
          <div
            role="status"
            data-testid="command-ack-banner"
            className={`rounded-[8px] px-3 py-1 text-[13px] flex items-center justify-between gap-3 shrink-0 ${
              notice.tone === "ok" ? "bg-[#161B22] text-[#DFFF00]" : "bg-[#302025] text-[#F4A4A4]"
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <i className={notice.tone === "ok" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} aria-hidden="true" />
              <span className="truncate">{notice.text}</span>
            </span>
            <button type="button" onClick={() => setNotice(null)} className="text-[#CAD0DA] hover:text-white cursor-pointer" aria-label="Dismiss">
              <i className="ri-close-line" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* NOW · NEXT · WHY · ACTION */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-3 shrink-0">
          <NowPanel
            segment={active}
            run={activeRun}
            product={active?.productId ? (productById.get(active.productId) ?? null) : null}
            position={position}
            active={forecast.active}
            guard={forecast.anchorGuard}
            nowMs={nowMs}
            tz={tz}
            nextSegment={next}
            nextForecast={nextFc}
            onSetEstimate={(sec) => {
              if (active) run({ type: "set_remaining_estimate", segmentId: active.id, remainingSec: sec });
            }}
          />
          <NextPanel
            nextSegment={next}
            nextForecast={nextFc}
            nextProduct={next?.productId ? (productById.get(next.productId) ?? null) : null}
            activeSegment={active}
            analysis={analysis}
            nowMs={nowMs}
            tz={tz}
            onAdvance={() => run({ type: "advance_segment" }, { ackTitle: "Ending below the declared minimum" })}
            onApply={applyOption}
            onShowAll={() => setDialog("options")}
            onReanchorNext={openReanchorForNext}
            onEndLive={() => setDialog("end")}
          />
        </div>

        {/* Operator toolbar: the next cue, then routine runtime actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap shrink-0 px-1" data-testid="operator-toolbar">
          <CueBar
            cues={plan.cues}
            forecasts={forecast.cues}
            runs={session.runtime.cues}
            tz={tz}
            onPerformed={(id) => run({ type: "report_cue", cueId: id, report: "performed" })}
            onAttempted={(id) => run({ type: "report_cue", cueId: id, report: "attempted" })}
            onMore={(id) => {
              setCueId(id);
              setDialog("cue");
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!active}
              onClick={() => active && run({ type: "extend_segment", segmentId: active.id, deltaSec: 60 })}
              data-testid="extend-plus-one-btn"
              className="!h-auto !py-1 flex-col !gap-0 leading-tight"
              title={extendHint ? `Extend ${active?.title} by 1:00 · ${extendHint.full}` : undefined}
            >
              <span>Extend +1m</span>
              {extendHint && (
                <span className={`text-[12px] font-normal max-w-[170px] truncate ${extendHint.tone === "warn" ? "text-[#F6C875]" : "text-[#9AA5B5]"}`} data-testid="extend-hint" title={extendHint.full}>
                  {extendHint.text}
                </span>
              )}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDialog("choose")} data-testid="choose-next-btn">
              Choose next
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDialog("skip")} data-testid="skip-segment-btn">
              Skip…
            </Button>
            <Button variant="ghost" size="sm" icon="ri-edit-line" onClick={() => setDialog("note")} data-testid="quick-add-note-btn">
              Note
            </Button>
          </div>
        </div>

        {/* Run of Show owns scroll; one support region beside it */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-3 flex-1 min-h-[220px]">
          <section className="rounded-[12px] bg-[#13161C] p-3 flex flex-col min-h-0" aria-label="Run of Show panel">
            <div className="flex items-center justify-between gap-3 pb-2 shrink-0 flex-wrap">
              <h2 className="text-[18px] font-medium text-[#F5F7FC]">Run of Show</h2>
              <div className="flex items-center gap-3 text-[14px]">
                {forecast.finishMs !== null && (
                  <span className="text-[#CAD0DA] tabular-nums" data-testid="projected-finish">
                    Projected finish {forecast.finishLowerBound ? "≥ " : ""}
                    {formatClock(forecast.finishMs, tz, true)}
                  </span>
                )}
                {forecast.baselineFinishMs !== null && (
                  <span className="inline-flex items-center gap-1.5 text-[#9AA5B5]" title="Downstream drift against the immutable baseline">
                    drift <Drift seconds={forecast.finishDriftSec} lowerBound={forecast.finishLowerBound} />
                    <span className="tabular-nums">· baseline {formatClock(forecast.baselineFinishMs, tz, true)}</span>
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  icon="ri-focus-3-line"
                  onClick={() => scrollCurrentRowIntoView()}
                >
                  Return to current
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pr-1" data-ros-scroll>
              <RunOfShowLive session={session} forecast={forecast} products={session.products} tz={tz} />
            </div>
          </section>

          <SupportTabs session={session} products={session.products} tz={tz} />
        </div>
      </div>

      <EndLiveDialog
        isOpen={dialog === "end"}
        onClose={() => setDialog(null)}
        session={session}
        onConfirm={() => {
          setDialog(null);
          if (run({ type: "end_live" })) router.push(`/live/${session.id}/review`);
        }}
      />
      <AckDialog
        isOpen={ack !== null}
        title={ack?.title ?? ""}
        message={ack?.message ?? ""}
        confirmText={ack?.confirmText ?? "Proceed"}
        onClose={() => setAck(null)}
        onConfirm={confirmAck}
      />
      <ReanchorDialog
        key={`reanchor-${reanchorId ?? "none"}`}
        isOpen={dialog === "reanchor"}
        onClose={() => setDialog(null)}
        session={session}
        nowMs={virtualNow}
        segmentId={reanchorId}
        onConfirm={(input) => {
          setDialog(null);
          run({
            type: "reanchor_segment",
            segmentId: input.segmentId,
            anchorOffsetSec: input.anchorOffsetSec,
            reason: input.reason,
            recoveryId: `reanchor:${input.segmentId}`,
            recoveryLabel: "Re-anchor (commitment change)",
          });
        }}
      />
      <ChooseNextDialog
        isOpen={dialog === "choose"}
        onClose={() => setDialog(null)}
        session={session}
        nowMs={virtualNow}
        onChoose={(id) => {
          if (next && run({ type: "reorder_segment", segmentId: id, beforeSegmentId: next.id })) setDialog(null);
        }}
      />
      <SkipDialog
        isOpen={dialog === "skip"}
        onClose={() => setDialog(null)}
        session={session}
        onSkip={(id) => {
          setDialog(null);
          run({ type: "skip_segment", segmentId: id }, { ackTitle: "Skipping required coverage" });
        }}
      />
      <NoteDialog
        isOpen={dialog === "note"}
        onClose={() => setDialog(null)}
        onSave={(text) => {
          setDialog(null);
          run({ type: "add_note", text });
        }}
      />
      <CueReportDialog
        key={`cue-${cueId ?? "none"}`}
        isOpen={dialog === "cue"}
        cue={cue}
        onClose={() => setDialog(null)}
        onConfirm={({ report, secondsAgo, reason }) => {
          if (!cue) return;
          setDialog(null);
          run({
            type: "report_cue",
            cueId: cue.id,
            report,
            reason: reason || undefined,
            occurredAtMs: report === "cancelled" ? undefined : deviceNow() - secondsAgo * 1000,
          });
        }}
      />
      <AllOptionsDialog isOpen={dialog === "options"} onClose={() => setDialog(null)} analysis={analysis} onApply={applyOption} />
    </FocusedShell>
  );
}
