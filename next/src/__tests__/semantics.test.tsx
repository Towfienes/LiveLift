import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { EnvironmentBadge } from "@/components/ui/EnvironmentBadge";
import { MetricValue } from "@/components/ui/MetricValue";
import { EvidenceLabel } from "@/components/ui/EvidenceLabel";
import {
  analyzeRecovery,
  applyCommand,
  buildReview,
  createScenarioSession,
  runScript,
  SCENARIO_START_MS,
} from "@/lib/domain";

describe("Non-negotiable Semantic Invariants", () => {
  it("distinguishes REAL and SIMULATED environments visibly", () => {
    const { unmount: unmountReal } = render(<EnvironmentBadge environment="REAL" />);
    const realBadge = screen.getByTestId("environment-badge-real");
    expect(realBadge).toHaveTextContent("REAL");
    unmountReal();

    render(<EnvironmentBadge environment="SIMULATED" />);
    const simBadge = screen.getByTestId("environment-badge-simulated");
    expect(simBadge).toHaveTextContent("SIMULATED");
    expect(simBadge).not.toHaveTextContent("REAL");
  });

  it("ensures Unknown verification does NOT render as Failed", () => {
    const { unmount } = render(<EvidenceLabel type="unknown" />);
    const unknownLabel = screen.getByTestId("evidence-label-unknown");
    expect(unknownLabel).toHaveTextContent("Unknown");
    expect(unknownLabel).not.toHaveTextContent("Failed");
    unmount();

    render(<EvidenceLabel type="failed" />);
    const failedLabel = screen.getByTestId("evidence-label-failed");
    expect(failedLabel).toHaveTextContent("Failed");
    expect(failedLabel).not.toHaveTextContent("Unknown");
  });

  it("ensures missing metric renders as 'Not available' and NEVER as 0", () => {
    render(<MetricValue label="Platform GMV" value={null} unit="USD" finality="unavailable" />);

    const notAvailable = screen.getByTestId("metric-not-available");
    expect(notAvailable).toHaveTextContent("Not available");

    // Must never contain '0' or '0 USD'
    expect(screen.queryByTestId("metric-numeric-value")).toBeNull();
  });

  it("ensures numeric zero is rendered accurately when measured as zero", () => {
    render(<MetricValue label="Returns Recorded" value={0} unit="items" finality="final" />);

    const numericVal = screen.getByTestId("metric-numeric-value");
    expect(numericVal).toHaveTextContent("0 items");
    expect(screen.queryByTestId("metric-not-available")).toBeNull();
  });

  it("recommendation != acceptance: showing recovery options changes nothing until one is chosen", () => {
    // 20:07 — the host estimate has put the 20:12 Flash Sale at risk.
    const s = runScript(createScenarioSession("buffered"), 3);
    const before = JSON.stringify(s);
    const analysis = analyzeRecovery(s, SCENARIO_START_MS + 7 * 60_000);
    expect(analysis.options.length).toBeGreaterThan(0);
    expect(JSON.stringify(s)).toBe(before);

    // Choosing one records the decision first, then the transition — and still reports nothing to the platform.
    const option = analysis.options[0];
    const chosen = applyCommand(s, { ...option.command, nowMs: 0, recoveryId: option.id, recoveryLabel: option.label });
    const types = chosen.session.events.slice(s.events.length).map((e) => e.type);
    expect(types[0]).toBe("recovery_selected");
    expect(Object.values(chosen.session.runtime.cues).every((c) => c.state === "pending")).toBe(true);
  });

  it("a report is not platform confirmation: operator cues stay 'reported' with verification Unknown", () => {
    const review = buildReview(runScript(createScenarioSession("buffered")))!;
    const operatorCues = review.cues.filter((c) => c.audience === "operator");
    expect(operatorCues.length).toBeGreaterThan(0);
    expect(operatorCues.every((c) => c.state === "performed" && c.verification === "unknown")).toBe(true);
    // Nothing in the model can represent "platform confirmed".
    expect(JSON.stringify(review)).not.toMatch(/platform_confirmed|confirmed by platform/i);
  });
});
