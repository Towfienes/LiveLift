"use client";

import React from "react";
import type { Cue, CueRun } from "@/contracts";
import type { CueForecast } from "@/lib/domain";
import { formatClock, formatDuration } from "@/lib/domain";
import { Button } from "@/components/ui";
import { Signal } from "./StatusChips";

export const CUE_ACTION_LABEL: Record<Cue["action"], string> = {
  none: "Presenter note",
  pin_product: "Pin product",
  unpin_product: "Unpin product",
  start_promotion: "Start promotion",
};

/**
 * The next operator cue. A cue is a zero-duration marker performed in TikTok by a human.
 * LiveLift records what the operator reports; it never executes or confirms the action.
 */
export function CueBar({
  cues,
  forecasts,
  runs,
  tz,
  onPerformed,
  onAttempted,
  onMore,
}: {
  cues: Cue[];
  forecasts: CueForecast[];
  runs: Record<string, CueRun>;
  tz: string;
  onPerformed: (cueId: string) => void;
  onAttempted: (cueId: string) => void;
  onMore: (cueId: string) => void;
}): React.ReactElement {
  const open = cues
    .filter((c) => c.audience === "operator")
    .map((cue) => ({
      cue,
      fc: forecasts.find((f) => f.cueId === cue.id),
      run: runs[cue.id],
    }))
    .filter((x) => x.fc && !x.fc.orphaned && (x.run?.state ?? "pending") !== "performed" && (x.run?.state ?? "pending") !== "cancelled")
    .sort((a, b) => (a.fc!.timeMs ?? Infinity) - (b.fc!.timeMs ?? Infinity));

  const first = open[0];
  if (!first) {
    return (
      <div data-testid="cue-bar" className="flex items-center gap-2 min-h-[44px]">
        <Signal tone="muted" icon="ri-checkbox-multiple-line">
          No operator cues waiting
        </Signal>
      </div>
    );
  }

  const { cue, fc, run } = first;
  const due = fc!.dueInSec;
  const attempted = run?.state === "attempted";
  const urgent = due !== null && due <= 60;
  const overdue = due !== null && due < 0;

  return (
    <div data-testid="cue-bar" className="flex items-center gap-3 min-w-0 flex-wrap">
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-[#F5F7FC] truncate">
          <i className="ri-focus-3-line mr-1.5 text-[#AEB7C5]" aria-hidden="true" />
          <span data-testid="cue-title">{cue.title}</span>
          <span className="ml-2 text-[13px] font-normal text-[#9AA5B5]">operator cue · 0:00 host time</span>
        </p>
        <p className="text-[13px] tabular-nums text-[#B7C1CE]">
          {fc!.timeMs !== null ? (
            <>
              {fc!.lowerBound ? "Due ≥ " : "Due "}
              {formatClock(fc!.timeMs, tz, true)}
              {due !== null && (
                <span className={overdue ? "text-[#F6C875]" : urgent ? "text-[#DFFF00]" : ""}>
                  {" · "}
                  {overdue ? `${formatDuration(-due)} overdue` : `in ${formatDuration(due)}`}
                </span>
              )}
            </>
          ) : (
            "Due time depends on a segment that has not started"
          )}
          {attempted && run?.occurredAtMs != null && ` · attempted ${formatClock(run.occurredAtMs, tz, true)}, outcome unknown`}
          {open.length > 1 && ` · +${open.length - 1} more`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant={urgent || attempted ? "primary" : "secondary"}
          onClick={() => onPerformed(cue.id)}
          data-testid="cue-performed-btn"
          aria-label={`I performed this: ${cue.title}`}
        >
          I performed this
        </Button>
        {!attempted && (
          <Button size="sm" variant="secondary" onClick={() => onAttempted(cue.id)} data-testid="cue-attempted-btn" aria-label={`Attempted: ${cue.title}`}>
            Attempted
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onMore(cue.id)} data-testid="cue-more-btn" aria-label={`More for ${cue.title}`}>
          <i className="ri-more-line" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
