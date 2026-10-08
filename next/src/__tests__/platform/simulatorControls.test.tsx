import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SCENARIO_START_MS, createScenarioSession } from "@/lib/domain";
import type { Session } from "@/contracts";
import { SimulatorStrip } from "@/components/ops/SimulatorStrip";
import { useSimulatorControls, type ClockCommand } from "@/components/platform/lab/useSimulatorControls";

const T = SCENARIO_START_MS;

function Harness({ session, run, scripted }: { session: Session; run: (b: ClockCommand) => void; scripted: boolean }): React.ReactElement {
  const sim = useSimulatorControls({
    session,
    nowMs: 0,
    nextAnchorMs: T + 12 * 60_000,
    run,
    script: scripted ? { apply: (say) => say("Step rejected. Skip it if you already did this by hand."), skip: (say) => say(null) } : undefined,
  });
  return <SimulatorStrip {...sim.strip} />;
}

afterEach(cleanup);

describe("useSimulatorControls, shared by Operate and the Lab", () => {
  it("each clock control sends the same command on every desk", () => {
    const run = vi.fn();
    render(<Harness session={createScenarioSession("buffered")} run={run} scripted={false} />);
    expect(screen.getByTestId("virtual-clock")).toHaveTextContent("20:00:00");
    fireEvent.click(screen.getByTestId("sim-plus-30s"));
    fireEvent.click(screen.getByTestId("sim-plus-5m"));
    fireEvent.click(screen.getByTestId("sim-to-anchor"));
    expect(run.mock.calls.map((c) => c[0])).toEqual([
      { type: "advance_clock", byMs: 30_000 },
      { type: "advance_clock", byMs: 300_000 },
      { type: "set_clock", toMs: T + 11 * 60_000 },
    ]);
  });

  it("offers the scenario script only where the desk asks for it, and shows what the script said", () => {
    const { unmount } = render(<Harness session={createScenarioSession("buffered")} run={vi.fn()} scripted={false} />);
    expect(screen.queryByTestId("sim-apply-step")).toBeNull();
    unmount();
    render(<Harness session={createScenarioSession("buffered")} run={vi.fn()} scripted />);
    expect(screen.getByTestId("sim-step-label")).toHaveTextContent("Start the simulated session at 20:00");
    fireEvent.click(screen.getByTestId("sim-apply-step"));
    expect(screen.getByRole("status")).toHaveTextContent("Skip it if you already did this by hand.");
    fireEvent.click(screen.getByTestId("sim-skip-step"));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
