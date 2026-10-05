import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { EnvironmentBadge } from "@/components/ui/EnvironmentBadge";
import { MetricValue } from "@/components/ui/MetricValue";
import { EvidenceLabel } from "@/components/ui/EvidenceLabel";
import { simulator } from "@/lib/simulator/simulatorEngine";
import { FIXTURE_ACTIVE_SNAPSHOT } from "@/fixtures/sessions";

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
    render(
      <MetricValue
        label="Platform GMV"
        value={null}
        unit="USD"
        finality="unavailable"
      />
    );

    const notAvailable = screen.getByTestId("metric-not-available");
    expect(notAvailable).toHaveTextContent("Not available");

    // Must never contain '0' or '0 USD'
    expect(screen.queryByTestId("metric-numeric-value")).toBeNull();
  });

  it("ensures numeric zero is rendered accurately when measured as zero", () => {
    render(
      <MetricValue
        label="Returns Recorded"
        value={0}
        unit="items"
        finality="final"
      />
    );

    const numericVal = screen.getByTestId("metric-numeric-value");
    expect(numericVal).toHaveTextContent("0 items");
    expect(screen.queryByTestId("metric-not-available")).toBeNull();
  });

  it("ensures recommendation acceptance does NOT start or change the presenting product", () => {
    simulator.reset();
    const before = simulator.getSnapshot("session_oct_evening");
    expect(before?.presentingProduct?.code).toBe("M02"); // Currently Zip Hoodie
    expect(before?.currentSegment?.id).toBe("seg_03");

    // Accept NEXT recommendation (which targets M03 Cargo Pants)
    const afterAccept = simulator.acceptRecommendation(
      "session_oct_evening",
      "rec_m03"
    );

    expect(afterAccept?.activeRecommendation?.decision).toBe("accepted");
    expect(afterAccept?.activeRecommendation?.decisionActor).toBe("Linh");

    // Invariant: NOW remains unchanged! Presenting product is STILL M02, NOT M03!
    expect(afterAccept?.presentingProduct?.code).toBe("M02");
    expect(afterAccept?.currentSegment?.id).toBe("seg_03");
  });

  it("ensures Presenting, Pinned, and Recommended products remain separate concepts", () => {
    const snap = FIXTURE_ACTIVE_SNAPSHOT;
    // Presenting: M02 (operator reported)
    expect(snap.presentingProduct?.code).toBe("M02");
    // Pinned: M02, but verification is UNKNOWN
    expect(snap.pinnedProduct?.code).toBe("M02");
    expect(snap.pinnedVerification).toBe("unknown");
    // Recommended: M03 (LiveLift policy)
    expect(snap.activeRecommendation?.targetProductId).toBe("prod_m03");

    expect(snap.presentingProduct?.code).not.toBe(
      snap.activeRecommendation?.targetProductId
    );
  });
});
