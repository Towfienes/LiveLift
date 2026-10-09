import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { fixtureDeskView, fixtureStartView } from "@/lib/livedesk/fixtures";
import type { LiveDeskViewModel, StartViewModel, LiveDeskActions, StartActions } from "@/lib/livedesk/types";

const nav = vi.hoisted(() => ({ path: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useRouter: () => ({ push: nav.push }) }));
vi.mock("@/lib/store/hooks", () => ({ useRemoteState: () => ({ active: false }) }));
vi.mock("@/components/ops/ConnectionStatus", () => ({ ConnectionChip: () => null, RemoteBanners: () => null }));
vi.mock("@/lib/livedesk/hooks", () => ({
  useStartFlow: () => ({ view: startView, actions: startActions }),
  useLiveDesk: (id: string) => { deskId = id; return { view: deskView, actions: deskActions }; },
}));

import HomePage from "@/app/page";
import StartPage from "@/app/start/page";
import LegacyPage from "@/app/legacy/page";
import DeskPage from "@/app/desk/[liveId]/page";
import { LiveDeskScreen } from "@/components/livedesk/LiveDeskScreen";
import { DeskChart } from "@/components/livedesk/DeskChart";
import { toHostPreview } from "@/components/livedesk/HostPreview";

let startView: StartViewModel;
let deskView: LiveDeskViewModel | null;
let deskId: string;
let startActions: StartActions;
let deskActions: LiveDeskActions;

beforeEach(() => {
  localStorage.clear();
  nav.path = "/";
  nav.push.mockReset();
  startView = structuredClone(fixtureStartView());
  deskView = structuredClone(fixtureDeskView());
  deskId = "";
  startActions = { onConnect: vi.fn(), onImportText: vi.fn(), onImportSamplePack: vi.fn(), onRemoveProduct: vi.fn(), onStartLive: vi.fn(() => "demo-id") };
  deskActions = { onRun: vi.fn(), onPause: vi.fn(), onSpeed: vi.fn(), onSkip: vi.fn(), onReset: vi.fn(), onPin: vi.fn(), onUnpin: vi.fn(), onAcceptSuggestion: vi.fn(), onDismissSuggestion: vi.fn(), onEndLive: vi.fn() };
});
afterEach(cleanup);

describe("Live Desk routes and honesty", () => {
  it("Home shows platform status, product count, next step and the existing honesty panel", () => {
    render(<HomePage />);
    expect(screen.getByTestId("home-flow")).toHaveTextContent("SIMULATED Shopee Live");
    expect(screen.getByTestId("home-flow")).toHaveTextContent("3");
    expect(screen.getByTestId("home-flow")).toHaveTextContent("Start a live rehearsal");
    expect(screen.getByTestId("truth-panel")).toHaveTextContent("What is real, and what is not");
    expect(within(screen.getByTestId("home-flow")).getByRole("link", { name: "Start" })).toHaveAttribute("href", "/start");
  });

  it.each(["connect", "import"])("Home chooses the %s step from the supplied status", step => {
    if (step === "connect") startView.connected = false;
    else startView.products = [];
    render(<HomePage />);
    expect(screen.getByTestId("home-flow")).toHaveTextContent(step === "connect" ? "Connect the simulated platform" : "Import your products");
  });

  it("Legacy links to the six old destinations at their original URLs", () => {
    nav.path = "/legacy";
    render(<LegacyPage />);
    const links = within(screen.getByTestId("legacy-links")).getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual(["/sessions", "/products", "/insights", "/simulator", "/integrations", "/live/new"]);
  });

  it("the async desk route passes the exact live id to the hook", async () => {
    nav.path = "/desk/my-live";
    render(await DeskPage({ params: Promise.resolve({ liveId: "my-live" }) }));
    expect(deskId).toBe("my-live");
    expect(screen.getByTestId("live-desk")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Desk" })).toHaveAttribute("href", "/desk/my-live");
  });

  it("unknown lives offer Start without inventing a rehearsal", () => {
    deskView = null;
    nav.path = "/desk/unknown";
    render(<LiveDeskScreen liveId="unknown" />);
    expect(screen.getByTestId("desk-not-found")).toHaveTextContent("Live not found");
    expect(screen.queryByTestId("live-desk")).toBeNull();
    expect(screen.queryByRole("link", { name: "Desk" })).toBeNull();
  });

  it.each([HomePage, StartPage, LegacyPage])("new screens and navigation contain no forbidden claims or Create LIVE", Page => {
    const { container } = render(<Page />);
    expect(container.textContent).not.toMatch(/synced with Shopee|connected to Shopee|confirmed by Shopee|Create LIVE/i);
    const links = within(screen.getByRole("navigation", { name: "Main Navigation" })).getAllByRole("link");
    expect(links.map(link => link.textContent)).toEqual(["Home", "Start", "Integrations", "Legacy"]);
  });
});

describe("Start actions and blocked reasons", () => {
  it("imports exact pasted text, calls the sample pack and removes by product id", () => {
    render(<StartPage />);
    expect(screen.getByTestId("start-import")).toBeDisabled();
    expect(screen.getByText("Paste product rows to import.")).toBeInTheDocument();
    const text = "name\tprice\nHoodie\t350000\n";
    fireEvent.change(screen.getByLabelText("Paste CSV or TSV"), { target: { value: text } });
    fireEvent.click(screen.getByTestId("start-import"));
    expect(startActions.onImportText).toHaveBeenCalledExactlyOnceWith(text);
    fireEvent.click(screen.getByTestId("start-sample"));
    expect(startActions.onImportSamplePack).toHaveBeenCalledExactlyOnceWith();
    fireEvent.click(screen.getByRole("button", { name: "Remove Canvas Tote" }));
    expect(startActions.onRemoveProduct).toHaveBeenCalledExactlyOnceWith("p3");
    expect(screen.getByTestId("desk-product-p3")).toHaveTextContent("Not entered");
    expect(screen.getByTestId("desk-product-p3")).toHaveTextContent("error_param: item not found");
  });

  it("disconnected Start disables import and explains why starting is blocked", () => {
    startView.connected = false;
    startView.startBlockedReason = "Connect first";
    render(<StartPage />);
    expect(screen.getByTestId("start-connect")).toBeEnabled();
    fireEvent.click(screen.getByTestId("start-connect"));
    expect(startActions.onConnect).toHaveBeenCalledExactlyOnceWith();
    for (const id of ["start-import", "start-sample", "start-live"]) expect(screen.getByTestId(id)).toBeDisabled();
    expect(screen.getByLabelText("Paste CSV or TSV")).toBeDisabled();
    expect(screen.getByText("Connect first")).toBeInTheDocument();
    expect(screen.getByText("Connect the simulated platform before importing.")).toBeInTheDocument();
  });

  it("uses the hook's blocked reason for queued or failed sync, including no products", () => {
    startView.products = [];
    startView.startBlockedReason = "Wait for at least one synced product";
    render(<StartPage />);
    expect(screen.getByTestId("start-live")).toBeDisabled();
    expect(screen.getByText(startView.startBlockedReason)).toBeInTheDocument();
  });

  it("starts once and navigates only to the returned live id", () => {
    startActions.onStartLive = vi.fn(() => "live/with space");
    render(<StartPage />);
    fireEvent.click(screen.getByTestId("start-live"));
    expect(startActions.onStartLive).toHaveBeenCalledOnce();
    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/desk/live%2Fwith%20space");
  });

  it("a null start result stays on Start and announces the failure", () => {
    startActions.onStartLive = vi.fn(() => null);
    render(<StartPage />);
    fireEvent.click(screen.getByTestId("start-live"));
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByText(/Live did not start/).closest('[role="status"]')).toBeInTheDocument();
  });

  it("restores and persists EN/VI using the Lab preference", () => {
    render(<StartPage />);
    fireEvent.click(screen.getByTestId("desk-lang-vi"));
    expect(localStorage.getItem("livelift.lab.lang")).toBe("vi");
    expect(screen.getByTestId("start-live")).toHaveTextContent("Bắt đầu live");
    cleanup();
    render(<HomePage />);
    expect(screen.getByTestId("livedesk-frame")).toHaveAttribute("lang", "vi");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bàn điều hành Live");
  });
});

describe("Desk interactions", () => {
  const renderDesk = (): void => { nav.path = "/desk/demo"; render(<LiveDeskScreen liveId="demo" />); };

  it("pins, unpins and pins again immediately with no confirmation or cooldown", () => {
    renderDesk();
    for (const id of ["desk-pin-p1", "desk-pin-p2", "desk-unpin"]) expect(screen.getByTestId(id)).toBeEnabled();
    expect(screen.getByTestId("desk-pin-p3")).toBeDisabled();
    fireEvent.click(screen.getByTestId("desk-pin-p1"));
    fireEvent.click(screen.getByTestId("desk-unpin"));
    fireEvent.click(screen.getByTestId("desk-pin-p1"));
    expect(deskActions.onPin).toHaveBeenNthCalledWith(1, "p1");
    expect(deskActions.onPin).toHaveBeenNthCalledWith(2, "p1");
    expect(deskActions.onUnpin).toHaveBeenCalledExactlyOnceWith();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Unpin is guessed, no Shopee page found.")).toBeInTheDocument();
  });

  it("unpin remains enabled when nothing is showing", () => {
    deskView!.showingProductId = null;
    deskView!.products.forEach(product => { product.showing = false; });
    renderDesk();
    expect(screen.getByTestId("desk-unpin")).toBeEnabled();
  });

  it("calls all clock controls with the exact virtual values", () => {
    renderDesk();
    fireEvent.click(screen.getByTestId("desk-run"));
    expect(deskActions.onRun).toHaveBeenCalledExactlyOnceWith();
    expect(screen.getByTestId("desk-pause")).toBeDisabled();
    expect(within(screen.getByTestId("desk-speed")).getAllByRole("option").map(option => option.textContent)).toEqual(["1×", "5×", "15×", "60×"]);
    fireEvent.change(screen.getByTestId("desk-speed"), { target: { value: "60" } });
    expect(deskActions.onSpeed).toHaveBeenCalledExactlyOnceWith(60);
    for (const seconds of [30, 60, 300]) fireEvent.click(screen.getByTestId(`desk-skip-${seconds}`));
    expect(deskActions.onSkip).toHaveBeenNthCalledWith(1, 30);
    expect(deskActions.onSkip).toHaveBeenNthCalledWith(2, 60);
    expect(deskActions.onSkip).toHaveBeenNthCalledWith(3, 300);
    fireEvent.click(screen.getByTestId("desk-reset"));
    expect(deskActions.onReset).toHaveBeenCalledExactlyOnceWith();
    cleanup();
    deskView!.clock.running = true;
    renderDesk();
    expect(screen.getByTestId("desk-run")).toBeDisabled();
    fireEvent.click(screen.getByTestId("desk-pause"));
    expect(deskActions.onPause).toHaveBeenCalledExactlyOnceWith();
  });

  it("accepts and dismisses by suggestion id without inventing performed state", () => {
    renderDesk();
    const panel = screen.getByTestId("desk-copilot");
    for (const text of ["Show Zip Hoodie next", "7 comments", "Sample size: 12", "Confidence: Medium", "Source: Rules", "Proposed", "Rules only"]) expect(panel).toHaveTextContent(text);
    fireEvent.click(screen.getByTestId("desk-accept-s1"));
    fireEvent.click(screen.getByTestId("desk-dismiss-s1"));
    expect(deskActions.onAcceptSuggestion).toHaveBeenCalledExactlyOnceWith("s1");
    expect(deskActions.onDismissSuggestion).toHaveBeenCalledExactlyOnceWith("s1");
    expect(screen.getByTestId("desk-suggestion-s1")).toHaveTextContent("Proposed");
  });

  it.each(["accepted", "dismissed", "performed"] as const)("a %s suggestion disables both choices", state => {
    deskView!.copilot.suggestions[0].state = state;
    renderDesk();
    expect(screen.getByTestId("desk-accept-s1")).toBeDisabled();
    expect(screen.getByTestId("desk-dismiss-s1")).toBeDisabled();
  });

  it("shows AI source, fallback status, banner and null metrics honestly", () => {
    deskView!.copilot.suggestions[0].source = "ai";
    deskView!.copilot.statusLabel = "AI unavailable; rules fallback";
    deskView!.banner = { tone: "warn", text: "Authorisation expired" };
    deskView!.viewers = null;
    deskView!.fingerprint = null;
    renderDesk();
    expect(screen.getByTestId("desk-suggestion-s1")).toHaveTextContent("Source: AI");
    expect(screen.getByTestId("desk-ai-status")).toHaveTextContent("AI unavailable; rules fallback");
    expect(screen.getByTestId("desk-banner")).toHaveTextContent("SIMULATED · Authorisation expired");
    expect(screen.getByTestId("desk-viewers")).toHaveTextContent("Not simulated");
    expect(screen.getByTestId("desk-fingerprint")).toHaveTextContent("No events yet");
  });

  it("comments are newest first with intents, counters and no live announcements", () => {
    renderDesk();
    const panel = screen.getByTestId("desk-comments");
    expect(panel).toHaveTextContent("Last 2 minutes");
    expect(panel).toHaveTextContent("Ask price: 7");
    expect(panel).toHaveTextContent("Ready to buy: 3");
    expect(panel.querySelectorAll('[data-testid^="desk-comment-"]')[0]).toHaveAttribute("data-testid", "desk-comment-c3");
    expect(screen.getByTestId("desk-comment-c2")).toHaveTextContent("PII masked");
    expect(panel.querySelector('[aria-live="off"]')).not.toBeNull();
    expect(panel.querySelector('[role="status"], [role="log"]')).toBeNull();
  });

  it("all simulated panels label themselves and charts provide text and action markers", () => {
    const { container } = render(<LiveDeskScreen liveId="demo" />);
    for (const id of ["desk-clock", "desk-products", "desk-viewers", "desk-viewers-chart", "desk-cart-chart", "desk-comments", "desk-copilot", "desk-phone", "desk-assumptions"]) expect(screen.getByTestId(id)).toHaveTextContent("SIMULATED");
    expect(screen.getAllByText("Markers show when you acted, not what caused a change")).toHaveLength(2);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByTestId("desk-viewers-chart")).toHaveTextContent("Pinned Cargo Pants");
    expect(within(screen.getByTestId("desk-cart-chart")).getByRole("heading")).toHaveTextContent("Add to cart per minute · Cargo Pants");
    expect(screen.getByTestId("desk-fingerprint")).toHaveTextContent("e8d00fb0");
    expect(container.textContent).not.toMatch(/synced with Shopee|connected to Shopee|confirmed by Shopee|Create LIVE/i);
  });

  it("End live calls the action and ended mode disables live controls but allows Reset", () => {
    renderDesk();
    fireEvent.click(screen.getByTestId("desk-end"));
    expect(deskActions.onEndLive).toHaveBeenCalledExactlyOnceWith();
    cleanup();
    deskView!.mode = "ended";
    renderDesk();
    for (const id of ["desk-end", "desk-run", "desk-pause", "desk-pin-p1", "desk-unpin", "desk-accept-s1", "desk-speed", "desk-skip-30"]) expect(screen.getByTestId(id)).toBeDisabled();
    expect(screen.getByTestId("desk-reset")).toBeEnabled();
  });
});

describe("Chart and phone display adapters", () => {
  it("chart titles hydrate from server HTML without recovery", async () => {
    const chart = <DeskChart title="Viewers" lang="en" testId="chart" chart={fixtureDeskView().charts.viewers} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(chart);
    document.body.appendChild(container);
    const recover = vi.fn();
    const root = hydrateRoot(container, chart, { onRecoverableError: recover });
    await act(async () => {});
    await act(async () => root.unmount());
    container.remove();
    expect(recover).not.toHaveBeenCalled();
  });

  it("empty and zero charts have text alternatives and finite SVG coordinates", () => {
    const { container, rerender } = render(<DeskChart title="Viewers" lang="en" testId="chart" chart={{ title: "Viewers", unit: "viewers", points: [], markers: [], summary: "No observations" }} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Viewers · SIMULATED");
    expect(screen.getByText("No chart data yet")).toBeInTheDocument();
    rerender(<DeskChart title="Viewers" lang="en" testId="chart" chart={{ title: "Viewers", unit: "viewers", points: [{ atSec: 0, value: 0 }], markers: [{ atSec: 0, kind: "unpin", label: "Unpinned" }], summary: "Zero viewers" }} />);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(container.querySelector("circle")).toHaveAttribute("cy", "124");
  });

  it("the read-only phone includes only synced products and preserves missing values", () => {
    const view = fixtureDeskView();
    view.products = structuredClone(view.products);
    view.products[0].priceLabel = null;
    const preview = toHostPreview(view);
    expect(preview.bag.map(item => item.name)).toEqual(["Zip Hoodie", "Cargo Pants"]);
    expect(preview.bag[0].priceLabel).toBeNull();
    expect(preview.bag[1].pinned).toBe(true);
    expect(preview.sessionId).toBeNull();
    expect(preview.promotion).toBeNull();
    expect(toHostPreview({ ...view, mode: "ended" }).viewers).toBeNull();
    expect(preview.comments.map(comment => comment.id)).toEqual(["c1", "c2", "c3"]);
    render(<LiveDeskScreen liveId="demo" />);
    expect(screen.getByTestId("host-app").parentElement).toHaveAttribute("inert");
    expect(screen.getByTestId("host-app").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});
