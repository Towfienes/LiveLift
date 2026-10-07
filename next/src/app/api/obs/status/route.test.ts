// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { ObsBridge } from "@/lib/integrations/obs/bridge";
import { MockObsSocket } from "@/lib/integrations/obs/mock";

// Exercise the existing HTTP/auth boundary; isolate storage, which OBS never reads/writes.
vi.mock("@/lib/server/runtime", () => ({
  getRuntime: async () => ({
    config: { roomId: "room-1", dbPath: "/unused", capabilities: [{ token: "viewer-fixture", roomId: "room-1", actorId: "viewer-1", name: "Viewer", role: "viewer" }] },
    authority: {},
  }),
  ensureAvailable: () => {},
}));
const runtime = vi.hoisted(() => ({ getObsBridge: vi.fn() }));
vi.mock("@/lib/integrations/obs/runtime", () => runtime);
import { GET } from "./route";

afterEach(() => { vi.restoreAllMocks(); runtime.getObsBridge.mockReset(); });

describe("protected OBS status endpoint", () => {
  it("requires existing LiveLift authorization before creating an OBS connection", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const reply = await GET(new Request("http://localhost/api/obs/status"));
    expect(reply.status).toBe(401);
    expect(runtime.getObsBridge).not.toHaveBeenCalled();
    expect(reply.headers.get("cache-control")).toBe("no-store");
  });

  it("allows viewers to read only a redacted OBS snapshot", async () => {
    const bridge = new ObsBridge({ LIVELIFT_OBS_ENABLED: "1", LIVELIFT_OBS_PASSWORD: "route-fixture-password" }, () => new MockObsSocket());
    runtime.getObsBridge.mockReturnValue(bridge);
    const reply = await GET(new Request("http://localhost/api/obs/status", { headers: { authorization: "Bearer viewer-fixture" } }));
    expect(reply.status).toBe(200);
    expect(reply.headers.get("cache-control")).toBe("no-store");
    expect(reply.headers.get("vary")).toBe("Cookie");
    const body = await reply.text();
    expect(JSON.parse(body)).toMatchObject({ provider: "obs", provenance: "provider_observed" });
    expect(body).not.toContain("route-fixture-password");
    expect(body).not.toContain("viewer-fixture");
  });
});
