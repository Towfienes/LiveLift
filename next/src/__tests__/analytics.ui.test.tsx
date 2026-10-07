import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Session } from "@/contracts";
import { createScenarioSession, runScript } from "@/lib/domain";

const state = vi.hoisted(() => ({ sessions: [] as Session[], hydrated: true, connection: "connected", snapshot: {} as object | null, storage: "ok" }));
vi.mock("@/components/shell", () => ({ StandardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/ops/ConnectionStatus", () => ({ RoomStatusPanel: () => null }));
vi.mock("@/lib/store/hooks", () => ({
  useSessions: () => ({ hydrated: state.hydrated, sessions: state.sessions, remote: { snapshot: state.snapshot, connection: state.connection, problem: null } }),
  useStoreState: () => ({ storage: state.storage, notices: [] }),
}));
import InsightsPage from "@/app/insights/page";

afterEach(cleanup);
beforeEach(() => { state.sessions = []; state.hydrated = true; state.connection = "connected"; state.snapshot = {}; state.storage = "ok"; });

describe("Insights evidence UI", () => {
  it("has truthful empty, loading, unavailable and stale states", () => {
    const rendered = render(<InsightsPage />);
    expect(screen.getByTestId("insights-empty")).toHaveTextContent("No sessions match");
    state.snapshot = null;
    rendered.rerender(<InsightsPage />);
    expect(screen.getByTestId("insights-empty")).toHaveTextContent("does not mean there were no REAL shows");
    state.connection = "connecting";
    rendered.rerender(<InsightsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading history");
    state.snapshot = {};
    state.connection = "stale";
    rendered.rerender(<InsightsPage />);
    expect(screen.getByTestId("insights-stale")).toHaveTextContent("may be incomplete");
  });

  it("filters environments and states, exposes equivalent values, and leaves provider metrics unavailable", () => {
    const sim = runScript(createScenarioSession("buffered"));
    state.sessions = [sim, createScenarioSession("minimum"), { ...structuredClone(sim), id: "real", environment: "REAL", title: "REAL observed operations" }];
    render(<InsightsPage />);
    expect(screen.getByTestId("analytics-summaries")).toHaveTextContent("REAL observed operations");
    expect(screen.getByTestId("analytics-summaries")).not.toHaveTextContent(sim.title);
    fireEvent.change(screen.getByLabelText("Environment"), { target: { value: "SIMULATED" } });
    expect(screen.getByTestId("analytics-summaries")).not.toHaveTextContent("REAL observed operations");
    expect(screen.getByTestId("analytics-detail")).toHaveTextContent("SIMULATED reports are rehearsal evidence");
    expect(screen.getByTestId("analytics-detail")).toHaveTextContent("Platform verification: unknown");
    const timing = screen.getByRole("table", { name: "Segment timing and operator-declared coverage" });
    expect(within(timing).getByText("+3:00 · overrun")).toBeInTheDocument();
    expect(timing.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThan(0);
    expect(timing.parentElement?.tabIndex).toBe(0);
    expect(screen.getByText(/Unavailable: no provider-observed/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Show state"), { target: { value: "planned" } });
    expect(screen.getByTestId("analytics-summaries")).toHaveTextContent("minimum exhausted");
    expect(screen.getByTestId("analytics-detail")).toHaveTextContent("Not recorded");
    fireEvent.change(screen.getByLabelText("From date (UTC)"), { target: { value: "2027-01-01" } });
    expect(screen.getByTestId("insights-empty")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByTestId("analytics-summaries")).toHaveTextContent(sim.title);
  });
});
