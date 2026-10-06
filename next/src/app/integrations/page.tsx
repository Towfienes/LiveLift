"use client";

import React from "react";
import { StandardShell } from "@/components/shell";

type Variant = "available" | "delayed" | "unavailable" | "unknown";

const CAPABILITIES: Array<{ id: string; name: string; status: string; variant: Variant; details: string }> = [
  {
    id: "manual",
    name: "Manual Operation Desk",
    status: "Available",
    variant: "available",
    details: "The whole loop — Prepare, Operate, Review and Next LIVE — runs with zero external integrations: REAL shows in the shared room, rehearsals in this browser.",
  },
  {
    id: "catalog",
    name: "Product import",
    status: "Manual",
    variant: "available",
    details: "Add products by hand, from the library, or by pasting CSV/TSV rows. There is no catalog sync with any platform.",
  },
  {
    id: "analytics",
    name: "Post-LIVE Platform Analytics",
    status: "Not connected",
    variant: "unavailable",
    details: "Platform figures stay in TikTok. Nothing here is imported, so no metric is shown — a missing figure is never shown as zero.",
  },
  {
    id: "realtime",
    name: "Realtime Live Stream Engagement",
    status: "Unavailable",
    variant: "unavailable",
    details: "No realtime stream is connected. The desk runs on the plan, the clock and what the operator records.",
  },
  {
    id: "action_control",
    name: "Direct Platform Pin / Action Control",
    status: "Unsupported",
    variant: "unavailable",
    details: "LiveLift never pins, unpins or starts a promotion for you. The operator does it in TikTok and reports it here.",
  },
  {
    id: "verification",
    name: "Platform Action Verification",
    status: "Unknown",
    variant: "unknown",
    details: "A report is the operator's word. Without an independent channel, platform verification stays Unknown — not failed, not confirmed.",
  },
];

const VARIANT_STYLE: Record<Variant, string> = {
  available: "bg-[#1E2718] text-[#DFFF00] border-[#3E5224]",
  delayed: "bg-[#2A2316] text-[#F6C875] border-[#5E4822]",
  unknown: "bg-[#1B1F27] text-[#CAD0DA] border-[#333C4B]",
  unavailable: "bg-[#20181A] text-[#9AA5B5] border-[#3D262B]",
};

export default function IntegrationsPage(): React.ReactElement {
  return (
    <StandardShell>
      <div className="flex-1 overflow-y-auto w-full max-w-[1080px] mx-auto px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-[34px] font-medium tracking-tight text-[#F5F7FC]">Integrations & Capabilities</h1>
          <p className="text-[16px] text-[#B7C1CE] mt-1">
            What each capability can actually do today. LiveLift never claims unverified automation, and nothing here is connected.
          </p>
        </div>

        <div className="rounded-[12px] bg-[#161B22] p-6 space-y-2">
          <div className="flex items-center gap-2 text-[#DFFF00]">
            <i className="ri-shield-check-line text-[20px]" aria-hidden="true" />
            <h2 className="text-[18px] font-medium">Manual Operation Guarantee</h2>
          </div>
          <p className="text-[15px] leading-relaxed text-[#CAD0DA]">
            Preparation, operation, review and the next plan never depend on a provider. If an integration is ever added it is optional, and its
            absence or failure cannot stop a show.
          </p>
        </div>

        <ul className="rounded-[12px] bg-[#13161C] divide-y divide-[#202632] overflow-hidden" data-testid="integrations-list">
          {CAPABILITIES.map((cap) => (
            <li key={cap.id} className="p-5 space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-[18px] font-medium text-[#F5F7FC]">{cap.name}</h3>
                <span className={`inline-flex items-center text-[13px] px-2 py-0.5 rounded-[4px] border ${VARIANT_STYLE[cap.variant]}`}>
                  {cap.status}
                </span>
              </div>
              <p className="text-[14px] text-[#B7C1CE] leading-relaxed">{cap.details}</p>
            </li>
          ))}
        </ul>
      </div>
    </StandardShell>
  );
}
