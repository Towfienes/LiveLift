"use client";

import React from "react";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";

export default function IntegrationsPage() {
  const capabilities = [
    {
      id: "manual",
      name: "Manual Operation Desk",
      status: "Available",
      statusVariant: "available",
      details: "Full core loop (Prepare, Run of Show, Desk, Replay, Learn) runs independently with zero external integrations.",
      actionText: "Core Active",
    },
    {
      id: "catalog",
      name: "Product Catalog Sync",
      status: "Available",
      statusVariant: "available",
      details: "Product pack import and session catalog snapshots are supported.",
      actionText: "Manage",
    },
    {
      id: "analytics",
      name: "Post-LIVE Platform Analytics",
      status: "Delayed / Pending",
      statusVariant: "delayed",
      details: "Platform post-session figures arrive asynchronously after broadcast ends.",
      actionText: "Configure",
    },
    {
      id: "realtime",
      name: "Realtime Live Stream Engagement",
      status: "Unavailable in P0",
      statusVariant: "unavailable",
      details: "Official TikTok realtime engagement stream is not connected. Plan-based rules and manual queue are used.",
      actionText: "Connect (Phase B)",
    },
    {
      id: "action_control",
      name: "Direct Platform Pin / Action Control",
      status: "Unsupported in P0",
      statusVariant: "unavailable",
      details: "Automatic platform control is not promised. Operator records manual actions explicitly.",
      actionText: "Manual only",
    },
    {
      id: "verification",
      name: "Platform Action Verification",
      status: "Unknown / Unverified",
      statusVariant: "unknown",
      details: "Independent server-side proof of platform pin is unavailable. HTTP response does not constitute platform confirmation.",
      actionText: "Inspect",
    },
  ];

  return (
    <StandardShell>
      <div className="flex-1 overflow-y-auto w-full max-w-[1080px] mx-auto px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-[34px] font-medium tracking-tight text-[#F5F7FC]">
            Integrations & Capabilities
          </h1>
          <p className="text-[16px] text-[#B7C1CE] mt-1">
            Explicit, capability-based provider transparency. LiveLift never claims unverified automation.
          </p>
        </div>

        {/* Honest Architecture Card */}
        <div className="rounded-[12px] bg-[#161B22] border border-[#2B3240] p-6 space-y-2">
          <div className="flex items-center gap-2 text-[#DFFF00]">
            <i className="ri-shield-check-line text-[20px]" />
            <h2 className="text-[18px] font-medium">Manual Operation Guarantee</h2>
          </div>
          <p className="text-[15px] leading-relaxed text-[#CAD0DA]">
            LiveLift is architected so that provider loss, API quota expiration, or absent credentials
            never block livestream preparation, runtime execution, wrap, or learning. All external
            providers act as optional adapters.
          </p>
        </div>

        {/* Capabilities Table / Cards */}
        <div className="rounded-[12px] bg-[#13161C] border border-[#232935] divide-y divide-[#202632] overflow-hidden" data-testid="integrations-list">
          {capabilities.map((cap) => (
            <div
              key={cap.id}
              className="p-5 flex items-center justify-between gap-6 flex-wrap sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-[18px] font-medium text-[#F5F7FC]">{cap.name}</h3>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[13px] font-mono px-2 py-0.5 rounded-[4px] border ${
                      cap.statusVariant === "available"
                        ? "bg-[#1E2718] text-[#DFFF00] border-[#3E5224]"
                        : cap.statusVariant === "delayed"
                        ? "bg-[#252016] text-[#FFB800] border-[#5E4822]"
                        : cap.statusVariant === "unknown"
                        ? "bg-[#1B1F27] text-[#CAD0DA] border-[#333C4B]"
                        : "bg-[#20181A] text-[#8A95A5] border-[#3D262B]"
                    }`}
                  >
                    {cap.status}
                  </span>
                </div>
                <p className="text-[14px] text-[#B7C1CE] leading-relaxed">{cap.details}</p>
              </div>

              <div className="shrink-0">
                <Button variant="secondary" size="sm" disabled={cap.statusVariant === "unavailable"}>
                  {cap.actionText}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </StandardShell>
  );
}
