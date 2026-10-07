"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StandardShell } from "@/components/shell";
import {
  CATEGORIES,
  type CapabilityCategory,
  type Variant,
} from "./categories";

const VARIANT_STYLE: Record<Variant, { badge: string; icon: string }> = {
  available: {
    badge: "bg-[#1E2718] text-[#DFFF00] border-[#3E5224]",
    icon: "ri-checkbox-circle-line",
  },
  manual: {
    badge: "bg-[#2A2316] text-[#F6C875] border-[#5E4822]",
    icon: "ri-hand-heart-line",
  },
  adapter_ready: {
    badge: "bg-[#211E2E] text-[#C8B2FF] border-[#4A3866]",
    icon: "ri-plug-line",
  },
  unsupported: {
    badge: "bg-[#20181A] text-[#9AA5B5] border-[#3D262B]",
    icon: "ri-shield-line",
  },
  unknown: {
    badge: "bg-[#1B1F27] text-[#CAD0DA] border-[#333C4B]",
    icon: "ri-question-line",
  },
  unavailable: {
    badge: "bg-[#20181A] text-[#9AA5B5] border-[#3D262B]",
    icon: "ri-close-circle-line",
  },
  not_connected: {
    badge: "bg-[#20181A] text-[#9AA5B5] border-[#3D262B]",
    icon: "ri-link-unlink-m",
  },
};

const CATEGORY_THEMES: Record<
  CapabilityCategory,
  {
    badgeClass: string;
    borderClass: string;
    headerAccent: string;
    icon: string;
  }
> = {
  available: {
    badgeClass: "bg-[#1E2718] text-[#DFFF00] border-[#3E5224]",
    borderClass: "border-[#22351E]",
    headerAccent: "text-[#DFFF00]",
    icon: "ri-checkbox-circle-line",
  },
  manual: {
    badgeClass: "bg-[#2A2316] text-[#F6C875] border-[#5E4822]",
    borderClass: "border-[#3D331E]",
    headerAccent: "text-[#F6C875]",
    icon: "ri-hand-heart-line",
  },
  adapter_ready: {
    badgeClass: "bg-[#211E2E] text-[#C8B2FF] border-[#4A3866]",
    borderClass: "border-[#332A4A]",
    headerAccent: "text-[#C8B2FF]",
    icon: "ri-plug-line",
  },
  unsupported: {
    badgeClass: "bg-[#20181A] text-[#9AA5B5] border-[#3D262B]",
    borderClass: "border-[#332024]",
    headerAccent: "text-[#CAD0DA]",
    icon: "ri-shield-line",
  },
};

export default function IntegrationsPage(): React.ReactElement {
  const [selectedCategory, setSelectedCategory] = useState<
    CapabilityCategory | "all"
  >("all");

  const totalCapabilitiesCount = CATEGORIES.reduce(
    (acc, cat) => acc + cat.items.length,
    0
  );

  const displayedCategories =
    selectedCategory === "all"
      ? CATEGORIES
      : CATEGORIES.filter((c) => c.id === selectedCategory);

  return (
    <StandardShell>
      <div className="flex-1 overflow-y-auto w-full max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] font-semibold uppercase tracking-wider text-[#DFFF00] bg-[#1E2718] border border-[#3E5224] px-2.5 py-0.5 rounded-[4px]">
              V3 Capability Center
            </span>
            <span className="text-[13px] text-[#CAD0DA]">
              Operational Independence & Platform Boundary Matrix
            </span>
          </div>
          <h1 className="text-[32px] sm:text-[36px] font-semibold tracking-tight text-[#F5F7FC]">
            Integrations & Capability Center
          </h1>
          <p className="text-[15px] sm:text-[16px] text-[#B7C1CE] leading-relaxed max-w-[900px]">
            LiveLift is built on intentional architecture: 100% standalone
            autonomy with zero external integrations required to run live
            broadcasts. External platform connections are bounded extensions,
            never brittle prerequisites.
          </p>
        </div>

        {/* Standalone Autonomy Guarantee Banner */}
        <section
          aria-labelledby="autonomy-guarantee-heading"
          className="rounded-[14px] bg-gradient-to-br from-[#141A1F] via-[#11161D] to-[#161B22] border border-[#263529] p-6 sm:p-7 shadow-lg space-y-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-[720px]">
              <div className="flex items-center gap-2.5 text-[#DFFF00]">
                <i
                  className="ri-shield-check-line text-[24px]"
                  aria-hidden="true"
                />
                <h2
                  id="autonomy-guarantee-heading"
                  className="text-[20px] sm:text-[22px] font-semibold text-[#F5F7FC]"
                >
                  Standalone Autonomy Guarantee
                </h2>
              </div>
              <p className="text-[15px] text-[#CAD0DA] leading-relaxed">
                LiveLift is production-ready standalone today with zero
                third-party integrations. Preparation, live pacing, cue
                reporting, replay review, and session cloning operate natively.
                Third-party connections are optional, intentionally bounded
                extensions — their absence or failure cannot stop a show.
              </p>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="rounded-[10px] bg-[#1A2218] border border-[#3E5224] p-3 text-center min-w-[96px]">
                <div className="text-[22px] font-bold text-[#DFFF00]">100%</div>
                <div className="text-[12px] text-[#CAD0DA] font-medium leading-tight mt-0.5">
                  Standalone Autonomy
                </div>
              </div>
              <div className="rounded-[10px] bg-[#161B22] border border-[#2D3748] p-3 text-center min-w-[96px]">
                <div className="text-[22px] font-bold text-[#F5F7FC]">0</div>
                <div className="text-[12px] text-[#CAD0DA] font-medium leading-tight mt-0.5">
                  API Dependencies
                </div>
              </div>
              <div className="rounded-[10px] bg-[#1C1F2B] border border-[#3B385E] p-3 text-center min-w-[96px]">
                <div className="text-[22px] font-bold text-[#C8B2FF]">100%</div>
                <div className="text-[12px] text-[#CAD0DA] font-medium leading-tight mt-0.5">
                  Native Workflows
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#20272F] flex flex-wrap items-center justify-between gap-3 text-[14px]">
            <div className="flex items-center gap-2 text-[#CAD0DA]">
              <i
                className="ri-checkbox-circle-line text-[#DFFF00]"
                aria-hidden="true"
              />
              <span>
                Manual flight desk and catalog spreadsheet import are 100%
                complete today.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/live/new"
                className="min-h-[44px] px-4 py-2 rounded-[8px] bg-[#DFFF00] text-[#111407] font-semibold hover:bg-[#CBEA00] transition-colors inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2"
              >
                <i className="ri-play-circle-line" aria-hidden="true" />
                <span>Start Live Session</span>
              </Link>
              <Link
                href="/simulator"
                className="min-h-[44px] px-4 py-2 rounded-[8px] bg-[#292D35] text-[#F5F7FC] font-medium hover:bg-[#343944] transition-colors inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2"
              >
                <i className="ri-flask-line" aria-hidden="true" />
                <span>Test Simulator</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Epistemic Truth Ledger Callout */}
        <section
          aria-labelledby="epistemic-ledger-heading"
          className="rounded-[14px] bg-[#13161C] border border-[#252C38] p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 text-[#C8B2FF]">
              <i className="ri-scales-3-line text-[22px]" aria-hidden="true" />
              <h2
                id="epistemic-ledger-heading"
                className="text-[18px] sm:text-[20px] font-semibold text-[#F5F7FC]"
              >
                Epistemic Truth Ledger & Evidence Hierarchy
              </h2>
            </div>
            <span className="text-[13px] text-[#8A95A5] font-mono">
              Integrity Mandate: Truth in Evidence
            </span>
          </div>

          <p className="text-[14px] text-[#CAD0DA] leading-relaxed">
            In livestream commerce, misrepresenting unverified operator actions
            as platform-confirmed events introduces severe operational drift.
            LiveLift strictly enforces three foundational epistemic rules:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="rounded-[10px] bg-[#181C24] border border-[#2D3545] p-4 space-y-1.5">
              <div className="text-[13px] font-mono font-semibold text-[#DFFF00] flex items-center gap-1.5">
                <i className="ri-hand-heart-line" aria-hidden="true" />
                <span>Evidence Tiers</span>
              </div>
              <div className="text-[14px] font-medium text-[#F5F7FC]">
                Operator reported != Provider observed != Platform confirmed
              </div>
              <p className="text-[13px] text-[#9AA5B5] leading-relaxed">
                An operator report is a human claim. Adapter telemetry is an
                observation. Platform confirmation requires authoritative
                callback proof.
              </p>
            </div>

            <div className="rounded-[10px] bg-[#181C24] border border-[#2D3545] p-4 space-y-1.5">
              <div className="text-[13px] font-mono font-semibold text-[#C8B2FF] flex items-center gap-1.5">
                <i className="ri-question-line" aria-hidden="true" />
                <span>Neutrality Rule</span>
              </div>
              <div className="text-[14px] font-medium text-[#F5F7FC]">
                Unknown != Failed
              </div>
              <p className="text-[13px] text-[#9AA5B5] leading-relaxed">
                The absence of confirmation or telemetry is neutral. Missing
                acknowledgements render with question icons, never false error
                badges.
              </p>
            </div>

            <div className="rounded-[10px] bg-[#181C24] border border-[#2D3545] p-4 space-y-1.5">
              <div className="text-[13px] font-mono font-semibold text-[#F6C875] flex items-center gap-1.5">
                <i className="ri-numbers-line" aria-hidden="true" />
                <span>Value Rule</span>
              </div>
              <div className="text-[14px] font-medium text-[#F5F7FC]">
                Missing != Zero
              </div>
              <p className="text-[13px] text-[#9AA5B5] leading-relaxed">
                Omitted prices, unpolled view counts, or missing metrics display
                as &ldquo;Not entered&rdquo; or &ldquo;Not available&rdquo;,
                never coerced to 0 or $0.
              </p>
            </div>
          </div>
        </section>

        {/* Category Filter Pills */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-semibold text-[#F5F7FC]">
                Capability Matrix
              </h2>
              <p className="text-[14px] text-[#9AA5B5]">
                {totalCapabilitiesCount} documented capabilities across 4
                rigorous architectural tiers
              </p>
            </div>

            <div
              className="flex items-center gap-1.5 p-1 bg-[#13161C] border border-[#232936] rounded-[10px] overflow-x-auto"
              role="tablist"
              aria-label="Filter capabilities by category"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedCategory === "all"}
                onClick={() => setSelectedCategory("all")}
                className={`min-h-[44px] px-3.5 py-1.5 rounded-[8px] text-[14px] font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                  selectedCategory === "all"
                    ? "bg-[#292D35] text-[#DFFF00] font-semibold shadow-sm"
                    : "text-[#CAD0DA] hover:text-white hover:bg-[#1B1F27]"
                }`}
              >
                All Capabilities ({totalCapabilitiesCount})
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`min-h-[44px] px-3.5 py-1.5 rounded-[8px] text-[14px] font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                    selectedCategory === cat.id
                      ? "bg-[#292D35] text-[#DFFF00] font-semibold shadow-sm"
                      : "text-[#CAD0DA] hover:text-white hover:bg-[#1B1F27]"
                  }`}
                >
                  {cat.id === "available"
                    ? "Available"
                    : cat.id === "manual"
                    ? "Manual / Built-In"
                    : cat.id === "adapter_ready"
                    ? "Adapter-Ready"
                    : "Unsupported"}{" "}
                  ({cat.items.length})
                </button>
              ))}
            </div>
          </div>

          {/* Structured Categories Container */}
          <div data-testid="integrations-list" className="space-y-10">
            {displayedCategories.map((cat) => {
              const theme = CATEGORY_THEMES[cat.id];
              return (
                <section
                  key={cat.id}
                  aria-labelledby={`category-heading-${cat.id}`}
                  className="space-y-4"
                >
                  {/* Category Section Header */}
                  <div
                    className={`rounded-[12px] bg-[#11141B] border ${theme.borderClass} p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <i
                          className={`${theme.icon} ${theme.headerAccent} text-[20px]`}
                          aria-hidden="true"
                        />
                        <h3
                          id={`category-heading-${cat.id}`}
                          className="text-[18px] sm:text-[20px] font-semibold text-[#F5F7FC]"
                        >
                          {cat.title}
                        </h3>
                      </div>
                      <p className="text-[14px] text-[#B7C1CE] leading-relaxed">
                        {cat.description}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center text-[13px] font-semibold px-2.5 py-1 rounded-[6px] border ${theme.badgeClass} shrink-0 self-start sm:self-auto`}
                    >
                      {cat.badge}
                    </span>
                  </div>

                  {/* Capability Cards Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {cat.items.map((item) => {
                      const variantConfig = VARIANT_STYLE[item.variant];
                      return (
                        <div
                          key={item.id}
                          className="rounded-[12px] bg-[#13161C] border border-[#202632] hover:border-[#2C3444] transition-colors p-5 flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="text-[17px] font-semibold text-[#F5F7FC] leading-snug">
                                {item.name}
                              </h4>
                              <span
                                className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-0.5 rounded-[4px] border ${variantConfig.badge} shrink-0`}
                              >
                                <i
                                  className={variantConfig.icon}
                                  aria-hidden="true"
                                />
                                <span>{item.status}</span>
                              </span>
                            </div>

                            {/* Details Paragraph */}
                            <p className="text-[14px] text-[#B7C1CE] leading-relaxed">
                              {item.details}
                            </p>
                          </div>

                          {/* Footer: Epistemic Note & Action CTAs */}
                          <div className="space-y-3 pt-3 border-t border-[#1B212C]">
                            <div className="flex items-start gap-2 text-[12px] text-[#9AA5B5] leading-normal font-mono bg-[#0D0F14] rounded-[6px] p-2 border border-[#191F2B]">
                              <i
                                className="ri-information-line text-[#CAD0DA] shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <span>{item.epistemicNote}</span>
                            </div>

                            {/* Action Buttons if applicable */}
                            {(item.cta || item.secondaryCta) && (
                              <div className="flex items-center gap-2 pt-1 flex-wrap">
                                {item.cta && (
                                  <Link
                                    href={item.cta.href}
                                    className="min-h-[44px] px-3.5 py-1.5 rounded-[8px] bg-[#242A34] text-[#F5F7FC] hover:bg-[#2F3745] hover:text-white transition-colors text-[14px] font-medium inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2"
                                  >
                                    <i
                                      className={item.cta.icon}
                                      aria-hidden="true"
                                    />
                                    <span>{item.cta.label}</span>
                                  </Link>
                                )}
                                {item.secondaryCta && (
                                  <Link
                                    href={item.secondaryCta.href}
                                    className="min-h-[44px] px-3.5 py-1.5 rounded-[8px] bg-transparent text-[#CAD0DA] hover:text-white hover:bg-[#1B2028] transition-colors text-[14px] font-medium inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2"
                                  >
                                    <i
                                      className={item.secondaryCta.icon}
                                      aria-hidden="true"
                                    />
                                    <span>{item.secondaryCta.label}</span>
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </StandardShell>
  );
}
