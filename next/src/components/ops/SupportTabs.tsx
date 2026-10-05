"use client";

import React, { useState } from "react";
import type { ProductSnapshot, Session, SessionEvent } from "@/contracts";
import { baselinePlan, currentPlan, emptySegmentRun, formatClock } from "@/lib/domain";
import { Signal, type Tone } from "./StatusChips";

type TabId = "history" | "coverage" | "changes";

const EVENT_ICON: Partial<Record<SessionEvent["type"], string>> = {
  session_started: "ri-play-circle-line",
  segment_started: "ri-play-line",
  segment_ended: "ri-stop-line",
  segment_skipped: "ri-skip-forward-line",
  segment_reordered: "ri-arrow-up-down-line",
  plan_changed: "ri-file-edit-line",
  anchor_changed: "ri-lock-unlock-line",
  remaining_estimated: "ri-user-voice-line",
  recovery_selected: "ri-checkbox-circle-line",
  cue_reported: "ri-hand-heart-line",
  note_added: "ri-edit-line",
  session_ended: "ri-stop-circle-line",
  correction_added: "ri-history-line",
};

const EVENT_TONE: Partial<Record<SessionEvent["type"], Tone>> = {
  recovery_selected: "lime",
  anchor_changed: "warn",
  correction_added: "violet",
};

/** The one secondary region: actual history, coverage, and plan changes. Read-only. */
export function SupportTabs({
  session,
  products,
  tz,
}: {
  session: Session;
  products: ProductSnapshot[];
  tz: string;
}): React.ReactElement {
  const [tab, setTab] = useState<TabId>("history");
  const plan = currentPlan(session);
  const productById = new Map(products.map((p) => [p.id, p]));
  const events = session.events.filter((e) => e.type !== "clock_advanced").slice().reverse();

  const tabs: Array<{ id: TabId; label: string; icon: string }> = [
    { id: "history", label: "History", icon: "ri-history-line" },
    { id: "coverage", label: "Coverage", icon: "ri-checkbox-multiple-line" },
    { id: "changes", label: "Plan changes", icon: "ri-file-edit-line" },
  ];

  return (
    <section className="rounded-[12px] bg-[#13161C] p-3 flex flex-col min-h-0" aria-label="Support">
      <div className="flex gap-1 items-center pb-2 border-b border-[#232935] shrink-0" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            data-testid={`support-tab-${t.id}`}
            className={`min-h-[44px] px-3 rounded-[8px] text-[15px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === t.id ? "bg-[#252A34] text-[#DFFF00]" : "text-[#AFB8C7] hover:text-white"
            }`}
          >
            <i className={t.icon} aria-hidden="true" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pt-2" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "history" && (
          <ol className="divide-y divide-[#1F2530]" data-testid="history-list">
            {events.length === 0 && <li className="py-3 text-[14px] text-[#9AA5B5]">Nothing has been recorded yet.</li>}
            {events.map((e) => (
              <li key={e.id} className="py-2 flex gap-3 items-start">
                <span className="text-[13px] tabular-nums font-mono text-[#AEB7C5] w-[64px] shrink-0 pt-0.5">
                  {formatClock(e.occurredAtMs, tz, true)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-snug text-[#F5F7FC]">{e.summary}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <Signal tone={EVENT_TONE[e.type] ?? "muted"} icon={EVENT_ICON[e.type] ?? "ri-information-line"} className="text-[13px]">
                      {e.actor} · {e.source === "simulator" ? "Simulator" : "Operator"}
                    </Signal>
                    {Math.abs(e.recordedAtMs - e.occurredAtMs) >= 1000 && (
                      <Signal tone="violet" icon="ri-history-line" className="text-[13px]">
                        recorded {formatClock(e.recordedAtMs, tz, true)}
                      </Signal>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {tab === "coverage" && (
          <ul className="divide-y divide-[#1F2530]" data-testid="coverage-list">
            {plan.segments
              .filter((s) => s.kind === "product" || s.productId !== null)
              .map((s) => {
                const run = session.runtime.segments[s.id] ?? emptySegmentRun();
                const product = s.productId ? productById.get(s.productId) : null;
                // Coverage is what the operator declared. Running for the planned time is not proof of coverage.
                const status =
                  run.state === "active"
                    ? { tone: "lime" as Tone, text: "Presenting now" }
                    : run.state === "completed"
                      ? run.coverage === "complete"
                        ? { tone: "neutral" as Tone, text: "Covered (declared)" }
                        : run.coverage === "partial"
                          ? { tone: "warn" as Tone, text: "Unfinished (declared)" }
                          : { tone: "muted" as Tone, text: "Ran · coverage not declared" }
                      : run.state === "skipped"
                        ? { tone: "warn" as Tone, text: "Skipped — not covered" }
                        : { tone: "muted" as Tone, text: "Not started" };
                return (
                  <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] text-[#F5F7FC] truncate">
                        {product ? <span className="font-mono text-[13px] text-[#AEB7C5] mr-2">{product.code}</span> : null}
                        {s.title}
                      </p>
                      <p className="text-[13px] text-[#9AA5B5]">{s.optional ? "Optional" : "Required coverage"}</p>
                    </div>
                    <Signal tone={status.tone}>{status.text}</Signal>
                  </li>
                );
              })}
            <li className="py-2 text-[13px] text-[#9AA5B5]">
              Coverage comes from what actually ran in the Run of Show. It is not a separate queue.
            </li>
          </ul>
        )}

        {tab === "changes" && (
          <div data-testid="changes-list">
            <p className="text-[13px] text-[#9AA5B5] pb-2">
              Baseline locked {formatClock(session.runtime.startedAtMs ?? baselinePlan(session).createdAtMs, tz, true)} — the original
              commitments are never rewritten. Changes below are explicit plan versions.
            </p>
            <ol className="divide-y divide-[#1F2530]">
              {session.plans.length === 1 && <li className="py-2 text-[14px] text-[#9AA5B5]">No changes since the baseline.</li>}
              {session.plans.slice(1).map((p) => (
                <li key={p.id} className="py-2 flex gap-3">
                  <span className="text-[13px] tabular-nums font-mono text-[#AEB7C5] w-[64px] shrink-0">{formatClock(p.createdAtMs, tz, true)}</span>
                  <div>
                    <p className="text-[14px] text-[#F5F7FC]">{p.reason ?? "Plan revision"}</p>
                    <p className="text-[13px] text-[#9AA5B5]">Plan version {p.version}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
