import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import HomePage from "@/app/page";
import CreateLivePage from "@/app/live/new/page";
import PreparePage from "@/app/live/[sessionId]/prepare/page";
import OperatePage from "@/app/live/[sessionId]/operate/page";
import WrapPage from "@/app/live/[sessionId]/wrap/page";
import ReviewPage from "@/app/live/[sessionId]/review/page";
import SessionsPage from "@/app/sessions/page";
import ProductsPage from "@/app/products/page";
import IntegrationsPage from "@/app/integrations/page";
import { simulator } from "@/lib/simulator/simulatorEngine";

describe("Core Product Screens & Interaction Flows", () => {
  beforeEach(() => {
    simulator.reset();
  });

  it("renders Home with active LIVE session card", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Home" })).toBeDefined();
    expect(screen.getByText("October collection · Evening LIVE")).toBeDefined();
    expect(screen.getByTestId("continue-live-btn")).toBeDefined();
    expect(screen.getByText("Prepared for next")).toBeDefined();
  });

  it("renders Create Live page with starting point choices", () => {
    render(<CreateLivePage />);
    expect(screen.getByRole("heading", { name: "Create LIVE" })).toBeDefined();
    expect(screen.getByText("Blank")).toBeDefined();
    expect(screen.getByText("Saved Pack")).toBeDefined();
    expect(screen.getByText("Previous Session")).toBeDefined();
    expect(screen.getByTestId("submit-create-live-btn")).toBeDefined();
  });

  it("renders Prepare workspace with Product Pack, Run of Show, and Manual readiness", async () => {
    const params = Promise.resolve({ sessionId: "session_weekend_essentials" });
    await React.act(async () => {
      render(
        <React.Suspense fallback={<div>Loading desk...</div>}>
          <PreparePage params={params} />
        </React.Suspense>
      );
    });

    expect(await screen.findByTestId("prepare-product-list")).toBeDefined();
    expect(await screen.findByTestId("prepare-ros-list")).toBeDefined();
    expect(await screen.findByText("Plan ready")).toBeDefined();
    expect(await screen.findByText("Manual operation")).toBeDefined();
    expect(await screen.findByTestId("start-live-cta-btn")).toBeDefined();
  });

  it("renders Operate desk with NOW and NEXT command band and distinct controls", async () => {
    const params = Promise.resolve({ sessionId: "session_oct_evening" });
    await React.act(async () => {
      render(
        <React.Suspense fallback={<div>Loading desk...</div>}>
          <OperatePage params={params} />
        </React.Suspense>
      );
    });

    expect(await screen.findByTestId("now-panel")).toBeDefined();
    expect(await screen.findByTestId("next-panel")).toBeDefined();
    expect(await screen.findByTestId("accept-recommendation-btn")).toBeDefined();
    expect(await screen.findByTestId("start-segment-btn")).toBeDefined();
    expect(await screen.findByTestId("end-live-header-btn")).toBeDefined();
    expect(await screen.findByTestId("platform-pin-card")).toBeDefined();
  });

  it("renders Wrap workspace with duration summary and Review link", async () => {
    const params = Promise.resolve({ sessionId: "session_collection_launch" });
    await React.act(async () => {
      render(
        <React.Suspense fallback={<div>Loading wrap...</div>}>
          <WrapPage params={params} />
        </React.Suspense>
      );
    });

    expect(await screen.findByText("Runtime summary")).toBeDefined();
    expect(await screen.findByText("44:18")).toBeDefined();
    expect(await screen.findByTestId("wrap-open-review-btn")).toBeDefined();
  });

  it("renders Review workspace and toggles between As Known Then and With Later Evidence", async () => {
    const params = Promise.resolve({ sessionId: "session_collection_launch" });
    await React.act(async () => {
      render(
        <React.Suspense fallback={<div>Loading review...</div>}>
          <ReviewPage params={params} />
        </React.Suspense>
      );
    });

    expect(await screen.findByTestId("knowledge-lens-bar")).toBeDefined();
    expect(await screen.findByTestId("lens-as-known-then-btn")).toBeDefined();
    expect(await screen.findByTestId("lens-with-later-evidence-btn")).toBeDefined();

    // Default lens is As Known Then: late event should be excluded
    expect(screen.queryByText("Late receipt")).toBeNull();
    expect(screen.queryByText("M03 observed in room")).toBeNull();

    // Toggle lens to With Later Evidence
    fireEvent.click(await screen.findByTestId("lens-with-later-evidence-btn"));
    // Late receipt indicator should now be visible
    expect(await screen.findByText("Late receipt")).toBeDefined();
    expect(await screen.findByText("M03 observed in room")).toBeDefined();
  });

  it("renders Sessions list with filterable rows", () => {
    render(<SessionsPage />);
    expect(screen.getByRole("heading", { name: "Sessions" })).toBeDefined();
    expect(screen.getByTestId("sessions-table")).toBeDefined();
  });

  it("renders Products and Packs minimal support surface", () => {
    render(<ProductsPage />);
    expect(screen.getByRole("heading", { name: "Product Library" })).toBeDefined();
    expect(screen.getByTestId("products-grid")).toBeDefined();
  });

  it("renders Integrations with explicit capability states and no fake OAuth", () => {
    render(<IntegrationsPage />);
    expect(screen.getByRole("heading", { name: "Integrations & Capabilities" })).toBeDefined();
    expect(screen.getByTestId("integrations-list")).toBeDefined();
    expect(screen.getByText("Manual Operation Desk")).toBeDefined();
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
  });
});
