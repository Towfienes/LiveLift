"use client";

import React, { useState, useEffect, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { StandardShell, SessionContextBar } from "@/components/shell";
import {
  Button,
  EvidenceLabel,
  Dialog,
} from "@/components/ui";
import {
  KnowledgeView,
  ReplayEvent,
  ReplayGap,
  MetricWindow,
  LearningObject,
  NextLiveChange,
  RuntimeSnapshot,
} from "@/contracts";
import { simulator } from "@/lib/simulator/simulatorEngine";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function ReviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view") === "learn" ? "learn" : "replay";

  const [activeView, setActiveView] = useState<"replay" | "learn">(initialView);
  const [knowledgeLens, setKnowledgeLens] = useState<KnowledgeView>("as_known_then");
  const [eventFilter, setEventFilter] = useState<"all" | "recommendations" | "actions" | "gaps">("all");
  const [selectedEventId, setSelectedEventId] = useState<string>("evt_05");
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);

  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [gaps, setGaps] = useState<ReplayGap[]>([]);
  const [metrics, setMetrics] = useState<MetricWindow[]>([]);
  const [learningObjects, setLearningObjects] = useState<LearningObject[]>([]);
  const [nextLiveChanges, setNextLiveChanges] = useState<NextLiveChange[]>([]);
  const [isAddObservationOpen, setIsAddObservationOpen] = useState(false);
  const [newObsTitle, setNewObsTitle] = useState("");
  const [newObsDesc, setNewObsDesc] = useState("");

  useEffect(() => {
    let snap = simulator.getSnapshot(sessionId);
    if (!snap) {
      snap = simulator.getSnapshot("session_collection_launch");
    }
    setSnapshot(snap);

    const replayData = simulator.getReplay(sessionId);
    setEvents(replayData.events);
    setGaps(replayData.gaps);
    setMetrics(replayData.metrics);

    const learnData = simulator.getLearning(sessionId);
    setLearningObjects(learnData.learningObjects);
    setNextLiveChanges(learnData.nextLiveChanges);
  }, [sessionId]);

  if (!snapshot) {
    return (
      <StandardShell>
        <div className="flex-1 flex items-center justify-center p-12 text-[#8A95A5]">
          Loading review workspace...
        </div>
      </StandardShell>
    );
  }

  const { session, segments } = snapshot;

  // Filter events based on Knowledge Lens:
  // "As known then" excludes late events received post-session or beyond lens moment!
  const visibleEvents = events.filter((evt) => {
    if (knowledgeLens === "as_known_then" && evt.isLate) {
      return false;
    }
    if (eventFilter === "recommendations") return evt.type === "recommendation";
    if (eventFilter === "actions") return evt.type === "decision" || evt.type === "attempt" || evt.type === "operator_report";
    if (eventFilter === "gaps") return evt.type === "gap_start" || evt.type === "gap_end";
    return true;
  });

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  const handleToggleChange = (changeId: string) => {
    simulator.toggleNextLiveChange(sessionId, changeId);
    setNextLiveChanges(
      nextLiveChanges.map((c) =>
        c.id === changeId ? { ...c, isSelected: !c.isSelected } : c
      )
    );
  };

  const handleAddObservation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newObsTitle.trim()) return;

    const added = simulator.addLearningObject(sessionId, {
      type: "observation",
      title: newObsTitle.trim(),
      description: newObsDesc.trim() || newObsTitle.trim(),
      scope: "product",
      targetId: "prod_m03",
      evidenceRecordIds: [selectedEventId],
      isAiSuggested: false,
      isAccepted: true,
    });

    setLearningObjects([...learningObjects, added]);
    setIsAddObservationOpen(false);
    setNewObsTitle("");
    setNewObsDesc("");
  };

  const handleCreateNextLiveFromLessons = () => {
    router.push(`/live/new`);
  };

  return (
    <StandardShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#090B0F]">
        <SessionContextBar
          eyebrow="Review"
          title={session.title}
          environment={session.environment}
          metaText="Oct 3 · 20:00–20:44:18 · 44:18 tracked"
          rightAction={
            <div className="flex items-center gap-2">
              <Button
                variant={activeView === "replay" ? "secondary" : "ghost"}
                size="sm"
                icon="ri-time-line"
                onClick={() => setActiveView("replay")}
                data-testid="toggle-replay-view-btn"
              >
                Semantic Replay
              </Button>
              <Button
                variant={activeView === "learn" ? "primary" : "ghost"}
                size="sm"
                icon="ri-arrow-right-line"
                onClick={() => setActiveView("learn")}
                data-testid="toggle-learn-view-btn"
              >
                Learn / Next LIVE
              </Button>
            </div>
          }
        />

        {/* VIEW 1: SEMANTIC REPLAY */}
        {activeView === "replay" && (
          <div className="flex-1 min-h-0 flex flex-col p-4 lg:p-6 max-w-[1760px] w-full mx-auto gap-3.5 overflow-hidden">
            {/* Knowledge Lens Controller */}
            <div
              data-testid="knowledge-lens-bar"
              className="rounded-[12px] bg-[#1B1F27] border border-[#2B3240] px-5 py-3 shrink-0 flex items-center justify-between gap-4 flex-wrap"
            >
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-[18px] font-medium text-[#F5F7FC]">Replay lens</h2>
                  <span className="text-[14px] text-[#B7C1CE]">Moment: 20:24:30</span>
                </div>
                <p className="text-[13px] text-[#CAD0DA] mt-0.5">
                  {knowledgeLens === "as_known_then"
                    ? "As known then: Only records available to LiveLift by 20:24:30 are visible. Later receipts are excluded."
                    : "With later evidence: Displays late provider receipts and post-LIVE confirmations marked in violet."}
                </p>
              </div>

              {/* Lens Toggle */}
              <div className="flex items-center gap-2 bg-[#13161C] p-1 rounded-[8px] border border-[#2A303A]" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={knowledgeLens === "as_known_then"}
                  onClick={() => setKnowledgeLens("as_known_then")}
                  data-testid="lens-as-known-then-btn"
                  className={`min-h-[38px] px-3.5 rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer ${
                    knowledgeLens === "as_known_then"
                      ? "bg-[#252A34] text-[#DFFF00]"
                      : "text-[#AFB8C7] hover:text-white"
                  }`}
                >
                  As known then
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={knowledgeLens === "with_later_evidence"}
                  onClick={() => setKnowledgeLens("with_later_evidence")}
                  data-testid="lens-with-later-evidence-btn"
                  className={`min-h-[38px] px-3.5 rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer ${
                    knowledgeLens === "with_later_evidence"
                      ? "bg-[#241F30] text-[#C8B2FF]"
                      : "text-[#AFB8C7] hover:text-white"
                  }`}
                >
                  With later evidence
                </button>
              </div>
            </div>

            {/* 3-Column Replay Workspace */}
            <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_340px] gap-4 flex-1 min-h-0 overflow-hidden">
              {/* LEFT: Segment Navigator (220px) */}
              <div className="rounded-[12px] bg-[#13161C] border border-[#232935] p-4 flex flex-col min-h-0">
                <h3 className="text-[18px] font-medium text-[#F5F7FC] mb-2 shrink-0">
                  Segments
                </h3>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
                  {segments.map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      className={`w-full text-left p-2.5 rounded-[8px] transition-colors cursor-pointer ${
                        seg.id === "seg_05"
                          ? "bg-[#252D28] text-[#DFFF00] font-medium"
                          : "hover:bg-[#1E232B] text-[#CAD0DA]"
                      }`}
                    >
                      <div className="text-[15px] truncate">{seg.title}</div>
                      <div className="text-[12px] font-mono text-[#8A95A5] mt-0.5">
                        00:{String(seg.plannedOffsetMinutes).padStart(2, "0")}–00:{String(seg.plannedOffsetMinutes + seg.plannedDurationMinutes).padStart(2, "0")}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#232935] shrink-0 space-y-1">
                  <span className="text-[13px] text-[#FFB800] inline-flex items-center gap-1.5">
                    <i className="ri-error-warning-line" />
                    <span>{gaps.length} provider gap{gaps.length === 1 ? "" : "s"} recorded</span>
                  </span>
                  {metrics.length > 0 && (
                    <span className="text-[12px] text-[#8A95A5] block">
                      {metrics.length} metric windows evaluated
                    </span>
                  )}
                </div>
              </div>

              {/* CENTER: Operational Timeline & Event Ledger */}
              <div className="flex flex-col min-h-0 gap-3">
                {/* Visual Timeline Rail */}
                <div className="rounded-[12px] bg-[#13161C] border border-[#232935] p-4 space-y-2.5 shrink-0">
                  <div className="flex items-center text-[13px] font-mono text-[#AEB7C5]">
                    <span className="w-[80px]">Elapsed</span>
                    <div className="flex-1 flex justify-between">
                      <span>12m</span>
                      <span>16m</span>
                      <span>20m</span>
                      <span>24m</span>
                      <span>28m</span>
                    </div>
                  </div>

                  {/* Planned lane */}
                  <div className="flex items-center gap-3">
                    <span className="w-[70px] text-[13px] text-[#C8CDD6]">Planned</span>
                    <div className="flex-1 flex gap-1 h-[32px]">
                      <div className="flex-[8] bg-[#2B313C] rounded flex items-center justify-center text-[13px] text-[#F5F7FC]">
                        M02
                      </div>
                      <div className="flex-[4] bg-[#2B313C] rounded flex items-center justify-center text-[13px] text-[#F5F7FC]">
                        Flash Sale
                      </div>
                      <div className="flex-[4] bg-[#2B313C] rounded flex items-center justify-center text-[13px] text-[#F5F7FC]">
                        M03
                      </div>
                    </div>
                  </div>

                  {/* Actual lane */}
                  <div className="flex items-center gap-3">
                    <span className="w-[70px] text-[13px] text-[#C8CDD6]">Actual</span>
                    <div className="flex-1 flex gap-1 h-[32px]">
                      <div className="flex-[10] bg-[#27312B] text-[#DFFF00] rounded flex items-center justify-center text-[13px] font-medium border border-[#3E4F32]">
                        M02
                      </div>
                      <div className="flex-[4] bg-[#303744] text-[#F5F7FC] rounded flex items-center justify-center text-[13px] font-medium">
                        M03
                      </div>
                      <div className="flex-[2] bg-[#1E232B] text-[#8A95A5] rounded flex items-center justify-center text-[12px]">
                        Lens
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event Ledger */}
                <div className="rounded-[12px] bg-[#13161C] border border-[#232935] p-4 flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between gap-4 mb-2 pb-2 border-b border-[#232935] shrink-0">
                    <h3 className="text-[18px] font-medium text-[#F5F7FC]">
                      Event ledger ({visibleEvents.length})
                    </h3>

                    {/* Filter buttons */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant={eventFilter === "all" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setEventFilter("all")}
                      >
                        All
                      </Button>
                      <Button
                        variant={eventFilter === "recommendations" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setEventFilter("recommendations")}
                      >
                        Recommendations
                      </Button>
                      <Button
                        variant={eventFilter === "actions" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setEventFilter("actions")}
                      >
                        Actions
                      </Button>
                      <Button
                        variant={eventFilter === "gaps" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setEventFilter("gaps")}
                      >
                        Gaps
                      </Button>
                    </div>
                  </div>

                  {/* Scrollable Event List */}
                  <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#202632] pr-1" data-testid="review-event-list">
                    {visibleEvents.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => setSelectedEventId(evt.id)}
                        className={`py-3 px-3 rounded-[8px] flex items-start gap-4 cursor-pointer transition-colors ${
                          selectedEventId === evt.id
                            ? "bg-[#252A34] border border-[#394252]"
                            : "hover:bg-[#181C24]"
                        }`}
                      >
                        <span className="text-[13px] font-mono text-[#AEB7C5] w-[70px] shrink-0 pt-0.5">
                          {evt.timestamp}
                        </span>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-[16px] font-medium text-[#F5F7FC] truncate">
                            {evt.title}
                          </h4>
                          <p
                            className={`text-[13px] mt-0.5 truncate ${
                              evt.isLate ? "text-[#C8B2FF]" : "text-[#CAD0DA]"
                            }`}
                          >
                            {evt.subtitle}
                          </p>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          {evt.isLate ? (
                            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#C8B2FF]">
                              <i className="ri-history-line" />
                              <span>Late receipt</span>
                            </span>
                          ) : (
                            <EvidenceLabel type={evt.evidenceClass} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT: Evidence Inspector Detail (340px) */}
              <div
                data-testid="evidence-inspector-panel"
                className="rounded-[12px] bg-[#1B1F27] border border-[#2B3240] p-5 flex flex-col justify-between overflow-y-auto"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#2A313E]">
                    <h3 className="text-[18px] font-medium text-[#F5F7FC]">
                      Evidence detail
                    </h3>
                    <span className="text-[13px] font-mono text-[#AEB7C5]">
                      {selectedEvent.timestamp}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-[50px] h-[50px] rounded-[10px] bg-[#2A303B] border border-[#373F4D] flex flex-col items-center justify-center">
                      <span className="text-[20px] font-medium text-[#D2D9E4]">CP</span>
                      <span className="text-[11px] font-mono text-[#AFB8C7]">M03</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-mono text-[#B7C1CE]">M03</p>
                      <h4 className="text-[18px] font-medium text-[#F5F7FC]">Cargo Pants</h4>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-[8px] bg-[#13161C] border border-[#232935]">
                    <p className="text-[14px] font-medium text-[#F5F7FC]">
                      {selectedEvent.title}
                    </p>
                    <p className="text-[13px] text-[#CAD0DA]">
                      {selectedEvent.details || selectedEvent.subtitle}
                    </p>
                  </div>

                  {/* Related Evidence Chain */}
                  <div className="space-y-2 pt-2">
                    <p className="text-[13px] font-mono uppercase text-[#AEB7C5]">
                      Related records in session
                    </p>
                    <div className="space-y-1.5 text-[13px] text-[#CAD0DA]">
                      <div className="flex items-center gap-2">
                        <i className="ri-sparkling-line text-[#8A95A5]" />
                        <span>Recommendation · 20:17:02</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-checkbox-circle-line text-[#DFFF00]" />
                        <span>Decision · Accepted 20:18:04</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-cursor-line text-[#8A95A5]" />
                        <span>Attempt · 20:19:00</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-hand-heart-line text-[#CAD0DA]" />
                        <span>Report · 20:19:04</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#FFB800]">
                        <i className="ri-question-line" />
                        <span>Platform confirmation: Unknown</span>
                      </div>
                    </div>
                  </div>

                  {/* Explicit Late Receipt Banner if late */}
                  {selectedEvent.isLate && (
                    <div className="p-3 rounded-[8px] bg-[#211F2B] border border-[#483B64] space-y-1 text-[13px]">
                      <span className="font-semibold text-[#C8B2FF] inline-flex items-center gap-1.5">
                        <i className="ri-history-line" />
                        <span>Later provider observation</span>
                      </span>
                      <p className="text-[#C8B2FF]">
                        Occurred {selectedEvent.timestamp} · Received {selectedEvent.lateReceiptAt || "21:02:10"}
                      </p>
                      <p className="text-[#CAD0DA]">
                        Room observer noted M03 present. Does not constitute verified platform confirmation.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#2A313E] space-y-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="ri-edit-line"
                    className="w-full"
                    onClick={() => setIsAddObservationOpen(true)}
                  >
                    Create observation
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: LEARN / NEXT LIVE */}
        {activeView === "learn" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-[1180px] w-full mx-auto space-y-8">
            <div>
              <h2 className="text-[28px] font-medium text-[#F5F7FC]">
                Learning & Next LIVE
              </h2>
              <p className="text-[16px] text-[#B7C1CE] mt-1">
                Reasoning chain: Observation → Insight → Hypothesis → Next LIVE change.
                Causal claims are restrained to verified evidence.
              </p>
            </div>

            {/* Learning Objects Chain */}
            <div className="space-y-4">
              <h3 className="text-[20px] font-medium text-[#F5F7FC]">
                Recorded Learning Objects
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {learningObjects.map((obj) => (
                  <div
                    key={obj.id}
                    className="rounded-[12px] bg-[#13161C] border border-[#232935] p-5 flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[12px] font-mono uppercase tracking-wider text-[#DFFF00]">
                        {obj.type}
                      </span>
                      <h4 className="text-[18px] font-medium text-[#F5F7FC] mt-2">
                        {obj.title}
                      </h4>
                      <p className="text-[14px] leading-relaxed text-[#CAD0DA] mt-2">
                        {obj.description}
                      </p>
                      {obj.uncertaintyNote && (
                        <p className="text-[12px] text-[#8A95A5] italic mt-2">
                          Note: {obj.uncertaintyNote}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 mt-4 border-t border-[#202632] flex items-center justify-between text-[13px] text-[#8A95A5]">
                      <span>Scope: {obj.scope}</span>
                      <span className="text-[#22C55E]">Accepted</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Concrete Next LIVE Changes */}
            <div className="rounded-[12px] bg-[#13161C] border border-[#232935] p-6 space-y-4">
              <h3 className="text-[20px] font-medium text-[#F5F7FC]">
                Selected Next LIVE Changes
              </h3>
              <p className="text-[15px] text-[#CAD0DA]">
                Choose which verified operational adjustments will be applied when cloning into the next LIVE:
              </p>

              <div className="space-y-3" data-testid="next-live-changes-list">
                {nextLiveChanges.map((change) => (
                  <label
                    key={change.id}
                    className={`flex items-start gap-4 p-4 rounded-[10px] cursor-pointer transition-colors border ${
                      change.isSelected
                        ? "bg-[#1B1F27] border-[#DFFF00]"
                        : "bg-[#101319] border-[#252C38]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={change.isSelected}
                      onChange={() => handleToggleChange(change.id)}
                      className="w-5 h-5 rounded border-[#39414D] bg-[#1B1F27] accent-[#DFFF00] mt-0.5"
                    />

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-mono uppercase text-[#DFFF00]">
                          {change.changeType}
                        </span>
                        <h4 className="text-[17px] font-medium text-[#F5F7FC]">
                          {change.targetName}
                        </h4>
                      </div>
                      <p className="text-[15px] text-[#CAD0DA] mt-1">{change.description}</p>
                      <p className="text-[13px] text-[#8A95A5] mt-1 font-mono">{change.appliedSummary}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Carry Forward CTA */}
              <div className="pt-4 border-t border-[#232935] flex items-center justify-between flex-wrap gap-4">
                <p className="text-[14px] text-[#8A95A5]">
                  Historical runtime timestamps, old verification, and actual durations are never copied into the new plan.
                </p>

                <Button
                  variant="primary"
                  size="lg"
                  icon="ri-arrow-right-line"
                  onClick={handleCreateNextLiveFromLessons}
                  data-testid="create-next-live-cta-btn"
                >
                  Create Next LIVE
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add Observation */}
        <Dialog
          isOpen={isAddObservationOpen}
          onClose={() => setIsAddObservationOpen(false)}
          title="Add Replay Observation"
          confirmText="Save Observation"
          onConfirm={handleAddObservation}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="obs-title" className="block text-[14px] text-[#CAD0DA] mb-1">
                Observation Title
              </label>
              <input
                id="obs-title"
                type="text"
                required
                value={newObsTitle}
                onChange={(e) => setNewObsTitle(e.target.value)}
                placeholder="e.g. Sizing questions were repeated during M03"
                className="w-full h-11 bg-[#13161C] border border-[#39414D] rounded px-3 text-[#F5F7FC]"
              />
            </div>

            <div>
              <label htmlFor="obs-desc" className="block text-[14px] text-[#CAD0DA] mb-1">
                Factual Context
              </label>
              <textarea
                id="obs-desc"
                rows={3}
                value={newObsDesc}
                onChange={(e) => setNewObsDesc(e.target.value)}
                placeholder="State what occurred without asserting causation."
                className="w-full bg-[#13161C] border border-[#39414D] rounded p-3 text-[14px] text-[#F5F7FC]"
              />
            </div>
          </div>
        </Dialog>
      </div>
    </StandardShell>
  );
}
