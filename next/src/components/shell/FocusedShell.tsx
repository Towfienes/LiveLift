"use client";

import React from "react";
import Link from "next/link";
import type { EnvironmentIdentity, OperatorContext } from "@/contracts";
import { EnvironmentBadge, Button } from "@/components/ui";

export interface FocusedShellProps {
  sessionTitle: string;
  environment: EnvironmentIdentity;
  /** Runtime elapsed as m:ss, or null until the clock is available (avoids a hydration mismatch). */
  elapsedLabel: string | null;
  tracking: "active" | "ended";
  operator: OperatorContext;
  accountLabel?: string | null;
  /** Right side of the operator line — e.g. the rehearsal controls for a SIMULATED show. */
  contextExtra?: React.ReactNode;
  onEndLiveClick?: () => void;
  children: React.ReactNode;
}

export const FocusedShell: React.FC<FocusedShellProps> = ({
  sessionTitle,
  environment,
  elapsedLabel,
  tracking,
  operator,
  accountLabel,
  contextExtra,
  onEndLiveClick,
  children,
}) => {
  const simulated = environment === "SIMULATED";

  return (
    <div className="h-dvh flex flex-col bg-[#090B0F] text-[#F5F7FC] overflow-hidden">
      {/* Focused header: no global navigation. Leaving the desk does not stop runtime. */}
      <header className="h-[60px] [@media(max-height:800px)]:h-[52px] bg-[#101319] px-5 flex items-center justify-between border-b border-[#1E232B] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="text-[#DFFF00] hover:opacity-80 shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2"
            title="Leave the desk (tracking continues)"
            aria-label="Leave the desk (tracking continues)"
          >
            <span className="text-[24px]">
              <i className="ri-bar-chart-grouped-line" aria-hidden="true" />
            </span>
          </Link>
          <h1 className="text-[20px] font-medium tracking-[-0.4px] text-[#F5F7FC] truncate max-w-[34vw]">
            {sessionTitle}
          </h1>
          <EnvironmentBadge environment={environment} size="md" />
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <span
            className={`inline-flex items-center gap-2 text-[16px] font-medium ${
              tracking === "active" ? "text-[#DFFF00]" : "text-[#CAD0DA]"
            }`}
          >
            <i
              className={tracking === "active" ? "ri-record-circle-line" : "ri-stop-circle-line"}
              aria-hidden="true"
            />
            <span>
              {simulated ? "Simulated session" : "Tracking"} {tracking === "active" ? "active" : "ended"}
            </span>
          </span>

          <span
            className="inline-flex items-baseline gap-2"
            title="Time since LiveLift tracking started for the whole show — not the current segment's time."
          >
            <span className="text-[16px] text-[#AEB7C5] whitespace-nowrap">Show time</span>
            <span
              data-testid="elapsed-runtime-clock"
              aria-label="LiveLift tracked time"
              className="text-[26px] font-medium tracking-tight text-[#F5F7FC] tabular-nums min-w-[72px] text-right"
            >
              {elapsedLabel ?? "--:--"}
            </span>
          </span>

          <Link
            href="/"
            className="min-h-[44px] px-3 rounded-[8px] text-[16px] text-[#CAD0DA] hover:text-white hover:bg-[#1E232B] inline-flex items-center gap-1.5 transition-colors"
          >
            <i className="ri-logout-box-r-line" aria-hidden="true" />
            <span>Leave desk</span>
          </Link>

          {onEndLiveClick && (
            <Button
              variant="secondary"
              onClick={onEndLiveClick}
              data-testid="end-live-header-btn"
              className="bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944]"
            >
              {simulated ? "End simulated session" : "End LIVE"}
            </Button>
          )}
        </div>
      </header>

      {/* Operator and room context line */}
      <div
        className={`min-h-[36px] px-5 border-b flex items-center justify-between gap-4 text-[16px] shrink-0 ${
          simulated
            ? "bg-[#1A1726] border-[#2E2745] text-[#C8B2FF]"
            : "bg-[#0C0E14] border-[#1A1F27] text-[#B7C1CE]"
        }`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <span className="inline-flex items-center gap-2 text-[#CAD0DA] whitespace-nowrap">
            <i className="ri-user-settings-line" aria-hidden="true" />
            <span>
              {operator.isLead ? "You are Lead · " : "Assistant · "}
              <strong>{operator.name}</strong>
            </span>
          </span>
          {!simulated && (
            <span className="inline-flex items-center gap-2 text-[#CAD0DA] truncate">
              <i className="ri-live-line" aria-hidden="true" />
              <span className="truncate">{accountLabel || "Manual desk · no provider attached"}</span>
            </span>
          )}
          {simulated && (
            <span className="hidden 2xl:inline-flex items-center gap-2 truncate" title="Rehearsal only: nothing is broadcast and TikTok is not involved.">
              <i className="ri-flask-line" aria-hidden="true" />
              <span className="truncate">Rehearsal · no real broadcast</span>
            </span>
          )}
        </div>
        {contextExtra}
      </div>

      {/* Desk content. If the window is too short the desk scrolls rather than clipping controls. */}
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
};
