import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthState } from "@/lib/client/authStore";
import type { ObsSnapshot } from "@/lib/integrations/obs/types";

const deps = vi.hoisted(() => ({ auth: null as AuthState | null, ensureChecked: vi.fn(), markSessionEnded: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/store/hooks", () => ({ useAuth: () => deps.auth }));
vi.mock("@/lib/client/authStore", () => ({ authStore: deps }));
import { ObsPanel } from "./ObsPanel";

const snapshot: ObsSnapshot = {
  provider: "obs", provenance: "provider_observed", status: "connected", statusChangedAt: "2026-10-07T10:00:00Z",
  currentProgramScene: { value: "Opening", receivedAt: "2026-10-07T10:00:00Z", providerTimestamp: null },
  scenes: { value: ["Opening", "Demo"], receivedAt: "2026-10-07T10:00:00Z", providerTimestamp: null },
  streamActive: { value: false, receivedAt: "2026-10-07T10:00:00Z", providerTimestamp: null },
  streamSupported: true, error: null, reconnectAttempts: 0, nextRetryAt: null,
};

async function settle() { await act(async () => { await Promise.resolve(); }); }

beforeEach(() => {
  vi.useFakeTimers();
  deps.auth = {
    status: "authenticated", session: { workspaceId: "workspace-1", generation: "generation-1", roomId: "room-1", recoveryNotice: null, expiresAtMs: Date.now() + 60000, access: { actorId: "viewer-1", name: "Viewer", role: "viewer" } },
    recovery: null, loginError: null, unavailable: null, logoutNote: null,
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot), { status: 200 })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("dedicated OBS panel", () => {
  it("shows provider observations and uses existing session headers with no browser secrets", async () => {
    render(<ObsPanel />);
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("Connected");
    expect(screen.getByText("Opening")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText(/does not confirm TikTok LIVE status or product pins/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/obs/status", expect.objectContaining({
      credentials: "same-origin", cache: "no-store", headers: expect.objectContaining({ "X-LiveLift-Workspace": "workspace-1", "X-LiveLift-Generation": "generation-1" }),
    }));
    expect(localStorage.length).toBe(0);
  });

  it.each(["not_configured", "unavailable"] as const)("shows %s with unknown output", async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ...snapshot, status, currentProgramScene: null, scenes: null, streamActive: null }), { status: 200 }));
    render(<ObsPanel />);
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent(status === "not_configured" ? "Not configured" : "Unavailable");
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
    expect(screen.getAllByText("Unknown")).toHaveLength(3);
  });

  it("clears a prior observation on network loss", async () => {
    render(<ObsPanel />);
    await settle();
    vi.mocked(fetch).mockRejectedValue(new Error("network unavailable"));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByRole("status")).toHaveTextContent("Unavailable");
    expect(screen.queryByText("Opening")).not.toBeInTheDocument();
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
  });

  it("hides prior observations immediately when the session ends", async () => {
    const view = render(<ObsPanel />);
    await settle();
    deps.auth = { ...deps.auth!, status: "ended", session: null };
    view.rerender(<ObsPanel />);
    expect(screen.getByRole("status")).toHaveTextContent("Sign in");
    expect(screen.queryByText("Opening")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fobs");
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("a 401 ends the session through the existing store", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 }));
    render(<ObsPanel />);
    await settle();
    expect(deps.markSessionEnded).toHaveBeenCalledTimes(1);
  });
});
