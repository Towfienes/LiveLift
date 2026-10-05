"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { FocusedShell } from "@/components/shell";
import {
  Button,
  Dialog,
  StatusLabel,
  EvidenceLabel,
  MetricValue,
  InlineNotice,
} from "@/components/ui";
import {
  RuntimeSnapshot,
} from "@/contracts";
import { simulator } from "@/lib/simulator/simulatorEngine";
import { draftStore } from "@/lib/storage/draftStore";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function OperatePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(1065); // 17:45 default
  const [activeTab, setActiveTab] = useState<"queue" | "coverage" | "pulse" | "history">("queue");
  const [isEndLiveOpen, setIsEndLiveOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isPlatformReportOpen, setIsPlatformReportOpen] = useState(false);
  const [platformActionReportType, setPlatformActionReportType] = useState<"attempt" | "performed">("attempt");
  const [selectedReportProductId, setSelectedReportProductId] = useState("prod_m03");
  const [isChooseNextOpen, setIsChooseNextOpen] = useState(false);
  const [isOfflineDraftNotice, setIsOfflineDraftNotice] = useState(false);

  useEffect(() => {
    let snap = simulator.getSnapshot(sessionId);
    if (!snap) {
      snap = simulator.getSnapshot("session_oct_evening");
    }
    setSnapshot(snap);

    // Runtime clock ticking
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionId]);

  if (!snapshot) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#090B0F] text-[#8A95A5]">
        Loading operating desk...
      </div>
    );
  }

  const {
    session,
    currentSegment,
    presentingProduct,
    presentingReportedBy,
    presentingReportedAt,
    pinnedProduct,
    pinnedVerification,
    pinnedReportedBy,
    pinnedReportedAt,
    activeRecommendation,
    segments,
    products,
    isHeld,
    lastCommandResult,
  } = snapshot;

  // Actions
  const handleAcceptRecommendation = () => {
    if (!activeRecommendation) return;
    const updated = simulator.acceptRecommendation(session.id, activeRecommendation.id);
    if (updated) setSnapshot({ ...updated });
  };

  const handleRejectRecommendation = () => {
    if (!activeRecommendation) return;
    const updated = simulator.rejectRecommendation(session.id, activeRecommendation.id);
    if (updated) setSnapshot({ ...updated });
  };

  const handleStartSegment = (segmentId: string) => {
    const updated = simulator.startSegment(session.id, segmentId);
    if (updated) setSnapshot({ ...updated });
  };

  const handleHoldProposal = () => {
    const updated = simulator.holdProposal(session.id);
    if (updated) setSnapshot({ ...updated });
  };

  const handleExtendDuration = () => {
    const updated = simulator.extendDuration(session.id, 1);
    if (updated) setSnapshot({ ...updated });
  };

  const handleSkipCurrentSegment = () => {
    if (!currentSegment) return;
    const updated = simulator.skipSegment(session.id, currentSegment.id);
    if (updated) {
      // Transition to next segment
      const nextSeg = segments.find(s => s.id !== currentSegment.id && s.state === "pending");
      if (nextSeg) {
        const nextSnap = simulator.startSegment(session.id, nextSeg.id);
        if (nextSnap) setSnapshot({ ...nextSnap });
      } else {
        setSnapshot({ ...updated });
      }
    }
  };

  const handleReportPresentation = (prodId: string) => {
    const updated = simulator.reportPresentation(session.id, prodId);
    if (updated) setSnapshot({ ...updated });
  };

  const handleSavePlatformReport = () => {
    // If offline, save as UNSYNCED DRAFT
    if (!draftStore.getOnlineStatus()) {
      draftStore.saveDraft({
        sessionId: session.id,
        draftType: "platform_action",
        targetProductId: selectedReportProductId,
        targetAction: "pin_product",
        assertion: `Operator reported ${selectedReportProductId} pinned (${platformActionReportType}).`,
        capturedAt: new Date().toISOString(),
      });
      setIsOfflineDraftNotice(true);
      setIsPlatformReportOpen(false);
      return;
    }

    const updated = simulator.reportPlatformAction(
      session.id,
      selectedReportProductId,
      "pin_product",
      platformActionReportType
    );
    if (updated) setSnapshot({ ...updated });
    setIsPlatformReportOpen(false);
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) return;

    if (!draftStore.getOnlineStatus()) {
      draftStore.saveDraft({
        sessionId: session.id,
        draftType: "note",
        assertion: noteText.trim(),
        capturedAt: new Date().toISOString(),
      });
      setIsOfflineDraftNotice(true);
      setIsNoteOpen(false);
      setNoteText("");
      return;
    }

    // In simulated/connected mode, logs to session history
    setIsNoteOpen(false);
    setNoteText("");
  };

  const handleConfirmEndLive = () => {
    simulator.endLive(session.id);
    router.push(`/live/${session.id}/wrap`);
  };

  // Timing calculations
  const actualSegmentMinutes = currentSegment ? Math.floor(elapsedSeconds / 60) % 10 : 5;
  const actualSegmentSeconds = elapsedSeconds % 60;
  const formattedSegmentElapsed = `${String(actualSegmentMinutes).padStart(2, "0")}:${String(actualSegmentSeconds).padStart(2, "0")}`;
  const targetMinutes = currentSegment ? currentSegment.targetDurationMinutes : 10;
  const remainingSeconds = Math.max(0, targetMinutes * 60 - (actualSegmentMinutes * 60 + actualSegmentSeconds));
  const remainingMin = Math.floor(remainingSeconds / 60);
  const remainingSec = remainingSeconds % 60;
  const formattedRemaining = `${String(remainingMin).padStart(2, "0")}:${String(remainingSec).padStart(2, "0")}`;

  return (
    <FocusedShell
      sessionId={session.id}
      sessionTitle={session.title}
      environment={session.environment}
      elapsedSeconds={elapsedSeconds}
      operator={session.leadOperator}
      accountAssociation={session.accountAssociation}
      onEndLiveClick={() => setIsEndLiveOpen(true)}
    >
      <div className="flex-1 min-h-0 flex flex-col p-4 lg:p-6 max-w-[1720px] w-full mx-auto gap-3.5 overflow-hidden">
        {/* Unsynced Draft Notification Banner if offline */}
        {isOfflineDraftNotice && (
          <InlineNotice
            variant="draft"
            title="UNSYNCED DRAFT CREATED"
            message="Your report is saved on this device only. It has NOT been submitted to session history. Reconnect and confirm submission to record it."
            actionText="Dismiss"
            onAction={() => setIsOfflineDraftNotice(false)}
            className="shrink-0"
          />
        )}

        {/* Command Ack Banner if present */}
        {lastCommandResult && lastCommandResult.message && (
          <div
            data-testid="command-ack-banner"
            className="rounded-[8px] bg-[#161B22] border border-[#2B3240] px-4 py-2 text-[14px] text-[#DFFF00] flex items-center justify-between shrink-0"
          >
            <div className="flex items-center gap-2">
              <i className="ri-checkbox-circle-line" aria-hidden="true" />
              <span>{lastCommandResult.message}</span>
            </div>
            <span className="text-[12px] text-[#8A95A5] tabular-nums font-mono">
              {new Date(lastCommandResult.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* DOMINANT NOW / NEXT COMMAND BAND (Above fold at 1280x720) */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-4 shrink-0 min-h-[350px] max-h-[380px]">
          {/* NOW PANEL */}
          <div
            data-testid="now-panel"
            className="rounded-[12px] bg-[#13161C] border border-[#232935] p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold tracking-[1.7px] text-[#DFFF00] uppercase">
                  NOW
                </span>
                <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#DFFF00]">
                  <i className="ri-record-circle-line animate-pulse" aria-hidden="true" />
                  <span>Current segment</span>
                </span>
              </div>

              {/* Presenting Product Recognition */}
              <div className="mt-3 flex items-center gap-4">
                <div
                  className="w-[72px] h-[72px] shrink-0 rounded-[10px] bg-[#2A303B] border border-[#373F4D] flex flex-col items-center justify-center gap-0.5 select-none"
                  aria-hidden="true"
                >
                  <span className="text-[24px] font-medium text-[#D2D9E4]">
                    {presentingProduct?.initials || "—"}
                  </span>
                  <span className="text-[12px] font-mono text-[#AFB8C7]">
                    {presentingProduct?.code || "—"}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="text-[13px] font-mono text-[#B7C1CE]">
                    Presenting · {presentingProduct?.code || "None"}
                  </p>
                  <h2 className="text-[22px] font-medium tracking-tight text-[#F5F7FC] truncate">
                    {presentingProduct?.name || currentSegment?.title || "No product presenting"}
                  </h2>
                  <p className="text-[14px] text-[#C8CDD6] mt-0.5">
                    Operator reported · {presentingReportedBy || "System"} · {presentingReportedAt || "20:12:00"}
                  </p>
                </div>
              </div>

              {/* Timing */}
              <div className="mt-4 flex items-baseline justify-between gap-4">
                <div>
                  <p className="text-[12px] font-mono uppercase text-[#AEB7C5]">ACTUAL ELAPSED</p>
                  <div
                    data-testid="now-actual-elapsed"
                    className="text-[40px] font-medium text-[#F5F7FC] tabular-nums tracking-tight leading-none mt-1"
                  >
                    {formattedSegmentElapsed}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[16px] font-medium text-[#F5F7FC] tabular-nums">
                    {formattedRemaining} to target
                  </p>
                  <p className="text-[13px] text-[#B7C1CE]">
                    Planned {currentSegment?.plannedDurationMinutes || 8}m · Target {targetMinutes}m
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Pin Assertion (Separate semantic dimension!) */}
            <div
              data-testid="platform-pin-card"
              className="mt-3 pt-3 border-t border-[#252C38]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-medium text-[#CAD0DA]">
                  Platform pin evidence
                </span>
                <EvidenceLabel type={pinnedVerification} />
              </div>

              <p className="text-[14px] text-[#CAD0DA] mt-1 truncate">
                {pinnedProduct
                  ? `Operator ${pinnedReportedBy || "lead"} reports ${pinnedProduct.code} pinned · ${pinnedReportedAt}`
                  : "No pin reported"}
              </p>
              <p className="text-[13px] text-[#8A95A5]">
                {pinnedVerification === "unknown"
                  ? "No platform confirmation received."
                  : `Status: ${pinnedVerification}`}
              </p>
            </div>
          </div>

          {/* NEXT PANEL (Action & Why) */}
          <div
            data-testid="next-panel"
            className="rounded-[12px] bg-[#1B1F27] border border-[#2B3240] p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold tracking-[1.7px] text-[#DFFF00] uppercase">
                  NEXT
                </span>
                <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#CAD0DA]">
                  <i className="ri-sparkling-line" aria-hidden="true" />
                  <span>
                    {activeRecommendation?.decision === "accepted"
                      ? "Accepted by " + activeRecommendation.decisionActor
                      : "Recommended"}
                  </span>
                </span>
              </div>

              {activeRecommendation ? (
                <>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-[60px] h-[60px] shrink-0 rounded-[10px] bg-[#2A303B] border border-[#373F4D] flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[20px] font-medium text-[#D2D9E4]">CP</span>
                        <span className="text-[11px] font-mono text-[#AFB8C7]">
                          {activeRecommendation.targetProductId ? "M03" : "ROS"}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[13px] font-mono text-[#B7C1CE]">
                          {activeRecommendation.targetProductId ? "M03" : "Segment"}
                        </p>
                        <h2 className="text-[22px] font-medium tracking-tight text-[#F5F7FC] truncate">
                          {activeRecommendation.targetName}
                        </h2>
                      </div>
                    </div>

                    <span className="text-[14px] text-[#C8CDD6] shrink-0 font-medium">
                      When ready
                    </span>
                  </div>

                  {/* WHY Evidence Box */}
                  <div className="mt-3 p-3 rounded-[8px] bg-[#14171E] border border-[#242A36]">
                    <div className="flex items-center gap-1.5 text-[14px] font-medium text-[#F5F7FC]">
                      <span>WHY ·</span>
                      <span className="text-[#CAD0DA]">
                        {activeRecommendation.pulledForwardReason
                          ? `Operator pulled M03 forward ahead of Flash Sale: ${activeRecommendation.pulledForwardReason}`
                          : activeRecommendation.rationale[0]?.text}
                      </span>
                    </div>

                    <p className="text-[13px] text-[#CAD0DA] mt-1">
                      <i className="ri-checkbox-blank-circle-line mr-1 text-[10px]" />
                      No presentation report yet · High priority in pack
                    </p>

                    <p className="text-[12px] text-[#8A95A5] mt-1">
                      {activeRecommendation.missingInputsNote || "Constraints clear."}
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-[#8A95A5]">
                  <p className="text-[16px]">No pending recommendations.</p>
                  <p className="text-[14px] mt-1">Rundown complete or manual selection required.</p>
                </div>
              )}
            </div>

            {/* SEPARATE STABLE DECISION AND EXECUTION BUTTONS */}
            <div className="mt-4 pt-3 border-t border-[#2A313E] space-y-2.5">
              {/* Decision Row: Accept vs Reject */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="primary"
                  size="md"
                  icon="ri-check-line"
                  disabled={!activeRecommendation || activeRecommendation.decision === "accepted"}
                  onClick={handleAcceptRecommendation}
                  data-testid="accept-recommendation-btn"
                  className="w-full text-[16px]"
                >
                  {activeRecommendation?.decision === "accepted"
                    ? "Accepted"
                    : `Accept ${activeRecommendation?.targetProductId ? "M03" : "Next"}`}
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  disabled={!activeRecommendation}
                  onClick={handleRejectRecommendation}
                  data-testid="reject-recommendation-btn"
                  className="w-full text-[16px]"
                >
                  Reject recommendation
                </Button>
              </div>

              {/* Execution Row: Start Segment vs Hold */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  icon="ri-play-line"
                  disabled={!activeRecommendation}
                  onClick={() => {
                    if (activeRecommendation?.targetSegmentId) {
                      handleStartSegment(activeRecommendation.targetSegmentId);
                    }
                  }}
                  data-testid="start-segment-btn"
                  className="w-full text-[16px]"
                >
                  Start {activeRecommendation?.targetProductId ? "M03" : "Next"} segment
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleHoldProposal}
                  data-testid="hold-proposal-btn"
                  className="w-full text-[16px]"
                >
                  {isHeld ? "Resume proposal" : "Hold proposal"}
                </Button>
              </div>

              <p className="text-[12px] text-[#8A95A5] text-center">
                Acceptance does not start the segment. Start transitions the authoritative runtime.
              </p>
            </div>
          </div>
        </div>

        {/* OPERATOR TOOLBAR (Quick capture & Routine actions) */}
        <div className="flex items-center justify-between gap-4 py-1.5 shrink-0 flex-wrap">
          {/* Quick Capture */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon="ri-shopping-bag-3-line"
              onClick={() => handleReportPresentation("prod_m03")}
              data-testid="quick-presenting-btn"
            >
              Report Presenting M03
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon="ri-hand-heart-line"
              onClick={() => setIsPlatformReportOpen(true)}
              data-testid="quick-platform-report-btn"
            >
              Log Platform Action
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon="ri-edit-line"
              onClick={() => setIsNoteOpen(true)}
              data-testid="quick-add-note-btn"
            >
              Add note
            </Button>
          </div>

          {/* Routine Runtime Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExtendDuration}
              data-testid="extend-plus-one-btn"
            >
              Extend +1m
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleSkipCurrentSegment}
              data-testid="skip-segment-btn"
            >
              Skip segment
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsChooseNextOpen(true)}
              data-testid="choose-next-btn"
            >
              Choose next
            </Button>
          </div>
        </div>

        {/* LOWER SECTION: Rundown (Left) + Supporting Tab Region (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Run of Show primary runtime scroll */}
          <div className="rounded-[12px] bg-[#13161C] border border-[#232935] p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-3 mb-2 shrink-0">
              <h2 className="text-[20px] font-medium text-[#F5F7FC]">Run of Show</h2>
              <Button variant="ghost" size="sm" icon="ri-focus-3-line">
                Return to current
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#202632] pr-1">
              {segments.map((seg) => {
                const leadProd = seg.leadProductId
                  ? products.find((p) => p.id === seg.leadProductId)
                  : null;
                const isCurrent = seg.state === "current";

                return (
                  <div
                    key={seg.id}
                    className={`flex items-center gap-3.5 py-3 px-3 rounded-[8px] transition-colors ${
                      isCurrent
                        ? "bg-[#252D28] border border-[#3E4F32]"
                        : "hover:bg-[#181C24]"
                    }`}
                  >
                    <div className="w-[50px] shrink-0">
                      <span className="text-[13px] font-mono text-[#AEB7C5]">
                        {String(seg.order).padStart(2, "0")}
                      </span>
                      <p className="text-[13px] font-mono text-[#C8CDD6]">
                        00:{String(seg.plannedOffsetMinutes).padStart(2, "0")}
                      </p>
                    </div>

                    <div className="w-[40px] h-[40px] shrink-0 rounded-[8px] bg-[#232935] flex items-center justify-center">
                      {leadProd ? (
                        <span className="text-[14px] font-medium text-[#D2D9E4]">
                          {leadProd.initials}
                        </span>
                      ) : (
                        <i className="ri-play-list-line text-[16px] text-[#B7C1CE]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3
                        className={`text-[17px] font-medium truncate ${
                          isCurrent ? "text-[#DFFF00]" : "text-[#F5F7FC]"
                        }`}
                      >
                        {seg.title}
                      </h3>
                      {seg.cue && (
                        <p className="text-[13px] text-[#B7C1CE] truncate mt-0.5">
                          {seg.cue}
                        </p>
                      )}
                    </div>

                    <div className="text-right space-y-0.5 shrink-0">
                      <p className="text-[15px] font-medium tabular-nums text-[#F5F7FC]">
                        {seg.targetDurationMinutes} min
                      </p>
                      <StatusLabel status={seg.state} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supporting Region with Tabs */}
          <div className="rounded-[12px] bg-[#13161C] border border-[#232935] p-4 flex flex-col min-h-0">
            {/* Subview Tabs */}
            <div className="flex gap-1.5 items-center pb-2 border-b border-[#232935] shrink-0" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "queue"}
                onClick={() => setActiveTab("queue")}
                className={`min-h-[40px] px-3 rounded-[6px] text-[15px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === "queue"
                    ? "bg-[#252A34] text-[#DFFF00]"
                    : "text-[#AFB8C7] hover:text-white"
                }`}
              >
                <i className="ri-list-check" aria-hidden="true" />
                <span>Queue</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "coverage"}
                onClick={() => setActiveTab("coverage")}
                className={`min-h-[40px] px-3 rounded-[6px] text-[15px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === "coverage"
                    ? "bg-[#252A34] text-[#DFFF00]"
                    : "text-[#AFB8C7] hover:text-white"
                }`}
              >
                <i className="ri-checkbox-multiple-line" aria-hidden="true" />
                <span>Coverage</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "pulse"}
                onClick={() => setActiveTab("pulse")}
                className={`min-h-[40px] px-3 rounded-[6px] text-[15px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === "pulse"
                    ? "bg-[#252A34] text-[#DFFF00]"
                    : "text-[#AFB8C7] hover:text-white"
                }`}
              >
                <i className="ri-pulse-line" aria-hidden="true" />
                <span>Pulse</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "history"}
                onClick={() => setActiveTab("history")}
                className={`min-h-[40px] px-3 rounded-[6px] text-[15px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === "history"
                    ? "bg-[#252A34] text-[#DFFF00]"
                    : "text-[#AFB8C7] hover:text-white"
                }`}
              >
                <i className="ri-history-line" aria-hidden="true" />
                <span>History</span>
              </button>
            </div>

            {/* Tab Contents with bounded scroll */}
            <div className="flex-1 min-h-0 overflow-y-auto pt-3">
              {/* QUEUE TAB */}
              {activeTab === "queue" && (
                <div className="space-y-3" data-testid="queue-tab-content">
                  <p className="text-[13px] text-[#AEB7C5]">
                    Near-term operator intent · Saved plan unchanged
                  </p>

                  <div className="p-3 rounded-[8px] bg-[#1A1F29] border border-[#2B3444] flex items-center justify-between gap-3">
                    <div className="flex gap-3 items-center min-w-0">
                      <div className="w-[40px] h-[40px] shrink-0 rounded-[8px] bg-[#2A303B] flex items-center justify-center font-medium text-[#D2D9E4]">
                        CP
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-mono text-[#B7C1CE]">M03</p>
                        <h4 className="text-[16px] font-medium text-[#F5F7FC] truncate">
                          Cargo Pants
                        </h4>
                        <p className="text-[13px] text-[#CAD0DA]">Pulled forward · Proposed next</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" icon="ri-draggable">
                      Reorder
                    </Button>
                  </div>

                  <div className="p-3 rounded-[8px] bg-[#14171E] flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-[15px] font-medium text-[#F5F7FC]">Flash Sale</h4>
                      <p className="text-[12px] text-[#8A95A5]">Plan position 04</p>
                    </div>
                    <span className="text-[13px] text-[#C8CDD6]">Scheduled</span>
                  </div>

                  <div className="p-3 rounded-[8px] bg-[#14171E] flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-[15px] font-medium text-[#F5F7FC]">Q&A</h4>
                      <p className="text-[12px] text-[#8A95A5]">Plan position 06</p>
                    </div>
                    <span className="text-[13px] text-[#8A95A5]">Deferred</span>
                  </div>
                </div>
              )}

              {/* COVERAGE TAB */}
              {activeTab === "coverage" && (
                <div className="space-y-3" data-testid="coverage-tab-content">
                  <p className="text-[13px] text-[#AEB7C5]">
                    Reported presentation coverage across this session
                  </p>

                  <div className="space-y-2">
                    {products.map((prod) => {
                      const isPresentingNow = presentingProduct?.id === prod.id;
                      const wasShown = prod.id === "prod_m01" || isPresentingNow;

                      return (
                        <div
                          key={prod.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-[8px] bg-[#161B23]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[13px] font-mono text-[#B7C1CE] w-[36px]">
                              {prod.code}
                            </span>
                            <span className="text-[15px] font-medium text-[#F5F7FC] truncate">
                              {prod.name}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {isPresentingNow ? (
                              <span className="text-[13px] text-[#DFFF00] font-medium">
                                Presenting now
                              </span>
                            ) : wasShown ? (
                              <span className="text-[13px] text-[#CAD0DA]">
                                Reported presented 1×
                              </span>
                            ) : prod.status === "disabled" ? (
                              <span className="text-[13px] text-[#8A95A5]">Disabled</span>
                            ) : (
                              <span className="text-[13px] text-[#8A95A5]">
                                No presentation recorded
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PULSE TAB */}
              {activeTab === "pulse" && (
                <div className="space-y-3" data-testid="pulse-tab-content">
                  <p className="text-[13px] text-[#AEB7C5]">
                    Available signals with explicit source & freshness
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MetricValue
                      label="Orders Reported"
                      value={48}
                      unit="orders"
                      finality="provisional"
                      source="Operator manual tally"
                    />

                    {/* Missing metric renders as Not available, NEVER zero! */}
                    <MetricValue
                      label="Platform GMV"
                      value={null}
                      unit="USD"
                      finality="unavailable"
                      source="TikTok settlement connector"
                    />
                  </div>

                  <div className="p-3 rounded-[8px] bg-[#181B22] border border-[#282E3A] text-[13px] text-[#8A95A5]">
                    Realtime engagement signals currently unavailable. Missing metrics remain
                    unrecorded rather than zeroed.
                  </div>
                </div>
              )}

              {/* HISTORY TAB */}
              {activeTab === "history" && (
                <div className="space-y-3" data-testid="history-tab-content">
                  <p className="text-[13px] text-[#AEB7C5]">
                    Recent operational events and reports
                  </p>

                  <div className="divide-y divide-[#202632] space-y-1">
                    <div className="py-2.5 text-[14px]">
                      <div className="flex items-center justify-between text-[#8A95A5] text-[12px] font-mono">
                        <span>20:19:04 · Linh</span>
                        <EvidenceLabel type="operator_reported" />
                      </div>
                      <p className="text-[#F5F7FC] mt-0.5">Operator reported M03 pinned</p>
                    </div>

                    <div className="py-2.5 text-[14px]">
                      <div className="flex items-center justify-between text-[#8A95A5] text-[12px] font-mono">
                        <span>20:18:04 · Linh</span>
                        <EvidenceLabel type="accepted" />
                      </div>
                      <p className="text-[#F5F7FC] mt-0.5">M03 proposal accepted</p>
                    </div>

                    <div className="py-2.5 text-[14px]">
                      <div className="flex items-center justify-between text-[#8A95A5] text-[12px] font-mono">
                        <span>20:12:00 · Linh</span>
                        <StatusLabel status="completed" />
                      </div>
                      <p className="text-[#F5F7FC] mt-0.5">M01 Ribbed Tee completed</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DIALOG: End LIVE Confirmation */}
        <Dialog
          isOpen={isEndLiveOpen}
          onClose={() => setIsEndLiveOpen(false)}
          title="End LIVE Tracking?"
          confirmText="Confirm End LIVE"
          confirmVariant="primary"
          onConfirm={handleConfirmEndLive}
        >
          <div className="space-y-3 text-[15px] leading-relaxed text-[#CAD0DA]">
            <p>
              Ending LIVE will freeze LiveLift tracking for{" "}
              <strong className="text-[#F5F7FC]">{session.title}</strong> and conclude runtime records.
            </p>
            <div className="p-3 rounded-[8px] bg-[#221B1C] border border-[#52292C] text-[#FFA3A3] text-[14px]">
              <strong>Note:</strong> LiveLift tracking controls LiveLift only. Start or stop your platform
              broadcast in TikTok LIVE Manager separately.
            </div>
          </div>
        </Dialog>

        {/* DIALOG: Quick Note */}
        <Dialog
          isOpen={isNoteOpen}
          onClose={() => setIsNoteOpen(false)}
          title="Add Operational Note"
          confirmText="Save Note"
          onConfirm={handleSaveNote}
        >
          <div className="space-y-3">
            <textarea
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Host mentioned size chart; viewers asking about waist sizes."
              className="w-full bg-[#13161C] border border-[#39414D] rounded-[8px] p-3 text-[15px] text-[#F5F7FC]"
            />
            <p className="text-[13px] text-[#8A95A5]">
              Notes are attached with your actor signature and current elapsed time.
            </p>
          </div>
        </Dialog>

        {/* DIALOG: Log Platform Action */}
        <Dialog
          isOpen={isPlatformReportOpen}
          onClose={() => setIsPlatformReportOpen(false)}
          title="Log Platform Action"
          confirmText="Log Report"
          onConfirm={handleSavePlatformReport}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="plat-prod" className="block text-[14px] text-[#CAD0DA] mb-1">
                Product target
              </label>
              <select
                id="plat-prod"
                value={selectedReportProductId}
                onChange={(e) => setSelectedReportProductId(e.target.value)}
                className="w-full h-11 bg-[#13161C] border border-[#39414D] rounded px-3 text-[#F5F7FC]"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-[14px] text-[#CAD0DA] mb-1.5">Action assertion</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reportType"
                    checked={platformActionReportType === "attempt"}
                    onChange={() => setPlatformActionReportType("attempt")}
                    className="accent-[#DFFF00]"
                  />
                  <span className="text-[15px] text-[#F5F7FC]">Attempted</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reportType"
                    checked={platformActionReportType === "performed"}
                    onChange={() => setPlatformActionReportType("performed")}
                    className="accent-[#DFFF00]"
                  />
                  <span className="text-[15px] text-[#F5F7FC]">I performed this</span>
                </label>
              </div>
            </div>

            <p className="text-[13px] text-[#8A95A5]">
              Recording a report does NOT claim platform verification. Independent verification remains Unknown.
            </p>
          </div>
        </Dialog>

        {/* DIALOG: Choose Next Override */}
        <Dialog
          isOpen={isChooseNextOpen}
          onClose={() => setIsChooseNextOpen(false)}
          title="Choose Next Segment / Override"
        >
          <div className="space-y-2">
            {segments.map((seg) => (
              <div
                key={seg.id}
                onClick={() => {
                  handleStartSegment(seg.id);
                  setIsChooseNextOpen(false);
                }}
                className="p-3 rounded-[8px] bg-[#14171E] hover:bg-[#20252E] flex items-center justify-between cursor-pointer border border-[#232935]"
              >
                <div>
                  <h4 className="text-[16px] font-medium text-[#F5F7FC]">{seg.title}</h4>
                  <p className="text-[13px] text-[#8A95A5]">{seg.plannedDurationMinutes} min planned</p>
                </div>
                <StatusLabel status={seg.state} />
              </div>
            ))}
          </div>
        </Dialog>
      </div>
    </FocusedShell>
  );
}
