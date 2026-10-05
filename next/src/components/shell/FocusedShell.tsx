"use client";

import React from "react";
import Link from "next/link";
import { EnvironmentIdentity, OperatorContext } from "@/contracts";
import { EnvironmentBadge, Button } from "@/components/ui";

export interface FocusedShellProps {
  sessionId: string;
  sessionTitle: string;
  environment: EnvironmentIdentity;
  elapsedSeconds: number;
  operator: OperatorContext;
  accountAssociation?: string | null;
  onEndLiveClick: () => void;
  children: React.ReactNode;
}

export const FocusedShell: React.FC<FocusedShellProps> = ({
  sessionId: _sessionId,
  sessionTitle,
  environment,
  elapsedSeconds,
  operator,
  accountAssociation,
  onEndLiveClick,
  children,
}) => {
  const formatElapsed = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="h-screen flex flex-col bg-[#090B0F] text-[#F5F7FC] overflow-hidden">
      {/* Focused Header (64px) */}
      <header className="h-[64px] bg-[#101319] px-6 flex items-center justify-between border-b border-[#1E232B] shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#DFFF00] hover:opacity-80" title="Return to Home">
            <span className="text-[24px]">
              <i className="ri-bar-chart-grouped-line" aria-hidden="true" />
            </span>
          </Link>

          <h1 className="text-[22px] font-medium tracking-[-0.6px] text-[#F5F7FC] truncate max-w-[400px]">
            {sessionTitle}
          </h1>

          <EnvironmentBadge environment={environment} size="sm" />
        </div>

        {/* Runtime clock & Actions */}
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-2 text-[15px] font-medium text-[#DFFF00]">
            <i className="ri-record-circle-line animate-pulse" aria-hidden="true" />
            <span>Tracking active</span>
          </span>

          <span
            data-testid="elapsed-runtime-clock"
            className="text-[28px] font-medium tracking-tight text-[#F5F7FC] tabular-nums"
          >
            {formatElapsed(elapsedSeconds)}
          </span>

          <Link
            href="/"
            className="min-h-[44px] px-3 rounded-[8px] text-[15px] text-[#CAD0DA] hover:text-white hover:bg-[#1E232B] inline-flex items-center gap-1.5 transition-colors"
          >
            <i className="ri-logout-box-r-line" aria-hidden="true" />
            <span>Leave desk</span>
          </Link>

          <Button
            variant="secondary"
            onClick={onEndLiveClick}
            data-testid="end-live-header-btn"
            className="bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944]"
          >
            End LIVE
          </Button>
        </div>
      </header>

      {/* Operator and Room Context Bar (36px) */}
      <div className="h-[36px] px-6 bg-[#0C0E14] border-b border-[#1A1F27] flex items-center justify-between text-[#B7C1CE] text-[14px] shrink-0">
        <div className="flex items-center gap-2">
          <i className="ri-user-settings-line text-[#CAD0DA]" aria-hidden="true" />
          <span className="text-[#CAD0DA]">
            {operator.isLead ? "You are Lead · " : "Assistant · "}
            <strong>{operator.name}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <i className="ri-live-line text-[#CAD0DA]" aria-hidden="true" />
          <span className="text-[#CAD0DA]">
            {accountAssociation || "Manual desk (no provider account attached)"}
          </span>
        </div>
      </div>

      {/* Desk Content */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
};
