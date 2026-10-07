// @vitest-environment node
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObsBridge } from "./bridge";
import { readObsConfig } from "./config";
import { MockObsSocket } from "./mock";

const env = { LIVELIFT_OBS_ENABLED: "1", LIVELIFT_OBS_PASSWORD: "fixture-password" };
const scenes = { currentProgramSceneName: "Opening", scenes: [{ sceneName: "Opening" }, { sceneName: "Demo" }] };
let bridges: ObsBridge[];

function fixture(overrides: Record<string, string | undefined> = {}) {
  const sockets: MockObsSocket[] = [];
  const factory = vi.fn(() => { const socket = new MockObsSocket(); sockets.push(socket); return socket; });
  const bridge = new ObsBridge({ ...env, ...overrides }, factory);
  bridges.push(bridge);
  bridge.start();
  return { bridge, sockets, factory, socket: sockets[0] };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-07T10:00:00Z")); bridges = []; });
afterEach(() => { bridges.forEach((bridge) => bridge.stop()); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("OBS configuration and authentication", () => {
  it("is inert when not configured", () => {
    const { bridge, factory } = fixture({ LIVELIFT_OBS_ENABLED: undefined });
    expect(factory).not.toHaveBeenCalled();
    expect(bridge.snapshot()).toMatchObject({ status: "not_configured", currentProgramScene: null, streamActive: null });
  });

  it.each([
    { LIVELIFT_OBS_PASSWORD: undefined }, { LIVELIFT_OBS_PORT: "0" }, { LIVELIFT_OBS_PORT: "65536" },
    { LIVELIFT_OBS_HOST: "user:password@localhost" }, { LIVELIFT_OBS_HOST: "192.168.1.2" },
    { LIVELIFT_OBS_ENABLED: "true" }, { LIVELIFT_OBS_TLS: "true" },
  ])("fails closed for invalid config %j", (overrides) => {
    const { bridge, factory } = fixture(overrides);
    expect(factory).not.toHaveBeenCalled();
    expect(bridge.snapshot()).toMatchObject({ status: "unavailable", error: "invalid_config" });
  });

  it("defaults to loopback and permits explicit port, IPv6 and TLS hosts", () => {
    expect(readObsConfig(env)).toMatchObject({ url: "ws://127.0.0.1:4455" });
    expect(readObsConfig({ ...env, LIVELIFT_OBS_HOST: "::1", LIVELIFT_OBS_PORT: "4456" })).toMatchObject({ url: "ws://[::1]:4456" });
    expect(readObsConfig({ ...env, LIVELIFT_OBS_HOST: "obs.example.org", LIVELIFT_OBS_TLS: "1" })).toMatchObject({ url: "wss://obs.example.org:4455" });
  });

  it("waits for Hello and Identified; sends a challenge hash and only read requests", () => {
    const { bridge, socket, factory } = fixture();
    bridge.start();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(socket.sent).toEqual([]);
    expect(bridge.snapshot().status).toBe("connecting");
    socket.hello();
    expect(socket.sent).toEqual([{ op: 1, d: { rpcVersion: 1, authentication: "c2JC/0iz1OnAFlxoRN7VPCl01BBUOZN+YaBU0/FEYwM=", eventSubscriptions: 70 } }]);
    expect(bridge.snapshot().status).toBe("connecting");
    socket.receive(2, { negotiatedRpcVersion: 1 });
    expect(bridge.snapshot().status).toBe("connected");
    expect(socket.sent.filter((frame) => frame.op === 6).map((frame) => frame.d.requestType)).toEqual(["GetSceneList", "GetStreamStatus"]);
    expect(JSON.stringify(socket.sent)).not.toContain(env.LIVELIFT_OBS_PASSWORD);
  });

  it("rejects an unauthenticated OBS server without retry", () => {
    const { bridge, socket, factory } = fixture();
    socket.hello(false);
    vi.advanceTimersByTime(120000);
    expect(bridge.snapshot()).toMatchObject({ status: "unavailable", error: "authentication_required", nextRetryAt: null });
    expect(socket.sent).toEqual([]);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("reports authentication failure without echoing the provider reason or retrying", () => {
    const { bridge, socket, factory } = fixture();
    socket.hello();
    socket.disconnect(4009, env.LIVELIFT_OBS_PASSWORD);
    vi.advanceTimersByTime(120000);
    expect(bridge.snapshot()).toMatchObject({ status: "unavailable", error: "authentication_failed" });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(bridge.snapshot())).not.toContain(env.LIVELIFT_OBS_PASSWORD);
  });
});

describe("OBS provider observations", () => {
  it("reads current program scene, list and inactive stream with receipt timestamps", () => {
    const { bridge, socket } = fixture();
    socket.identify();
    socket.reply("GetSceneList", scenes);
    socket.reply("GetStreamStatus", { outputActive: false });
    expect(bridge.snapshot()).toMatchObject({
      provider: "obs", provenance: "provider_observed", status: "connected", streamSupported: true,
      currentProgramScene: { value: "Opening", receivedAt: "2026-10-07T10:00:00.000Z", providerTimestamp: null },
      scenes: { value: ["Opening", "Demo"] }, streamActive: { value: false, providerTimestamp: null },
    });
    const copy = bridge.snapshot();
    copy.scenes!.value.push("not observed");
    expect(bridge.snapshot().scenes!.value).toEqual(["Opening", "Demo"]);
  });

  it("keeps null provider scene unknown", () => {
    const { bridge, socket } = fixture();
    socket.identify();
    socket.reply("GetSceneList", { ...scenes, currentProgramSceneName: null });
    expect(bridge.snapshot().currentProgramScene).toBeNull();
    expect(bridge.snapshot().status).toBe("connected");
  });

  it("updates scene, scene list and stream from events and ignores preview state", () => {
    const { bridge, socket } = fixture();
    socket.identify();
    socket.reply("GetSceneList", scenes);
    socket.reply("GetStreamStatus", { outputActive: false });
    vi.advanceTimersByTime(1000);
    socket.event("CurrentPreviewSceneChanged", { sceneName: "Preview" });
    expect(bridge.snapshot().currentProgramScene!.value).toBe("Opening");
    socket.event("CurrentProgramSceneChanged", { sceneName: "Demo" });
    socket.event("SceneListChanged", { scenes: [{ sceneName: "Demo" }] });
    socket.event("StreamStateChanged", { outputActive: true, outputState: "OBS_WEBSOCKET_OUTPUT_STARTED" });
    expect(bridge.snapshot()).toMatchObject({ currentProgramScene: { value: "Demo", receivedAt: "2026-10-07T10:00:01.000Z" }, scenes: { value: ["Demo"] }, streamActive: { value: true } });
    socket.event("StreamStateChanged", { outputActive: false });
    expect(bridge.snapshot().streamActive!.value).toBe(false);
  });

  it("does not let a delayed read overwrite newer events", () => {
    const { bridge, socket } = fixture();
    socket.identify();
    socket.event("CurrentProgramSceneChanged", { sceneName: "Newer" });
    socket.event("SceneListChanged", { scenes: [{ sceneName: "Newer" }] });
    socket.event("StreamStateChanged", { outputActive: true });
    socket.reply("GetSceneList", scenes);
    socket.reply("GetStreamStatus", { outputActive: false });
    expect(bridge.snapshot()).toMatchObject({ currentProgramScene: { value: "Newer" }, scenes: { value: ["Newer"] }, streamActive: { value: true } });
  });

  it("refreshes renamed/created/removed scenes and pauses reads during collection changes", () => {
    const { bridge, socket } = fixture();
    socket.identify();
    const old = socket.request("GetSceneList");
    socket.reply("GetStreamStatus", { outputActive: false });
    socket.event("CurrentSceneCollectionChanging", { sceneCollectionName: "Second" });
    socket.reply("GetSceneList", scenes, 100, old);
    expect(bridge.snapshot().currentProgramScene).toBeNull();
    vi.advanceTimersByTime(30000);
    expect(socket.sent.filter((frame) => frame.d.requestType === "GetSceneList")).toHaveLength(1);
    socket.reply("GetStreamStatus", { outputActive: false });
    socket.event("CurrentSceneCollectionChanged", { sceneCollectionName: "Second" });
    socket.reply("GetSceneList", { ...scenes, currentProgramSceneName: "Second" });
    expect(bridge.snapshot().currentProgramScene!.value).toBe("Second");
    for (const eventType of ["SceneCreated", "SceneRemoved", "SceneNameChanged"]) {
      socket.event(eventType, { sceneName: "Changed" });
      expect(bridge.snapshot().scenes).toBeNull();
      socket.reply("GetSceneList", scenes);
      expect(bridge.snapshot().scenes!.value).toEqual(["Opening", "Demo"]);
    }
  });

  it("distinguishes unsupported stream state from inactive; other failures are unavailable", () => {
    const { bridge, socket } = fixture();
    socket.identify();
    socket.reply("GetSceneList", scenes);
    socket.reply("GetStreamStatus", undefined, 204);
    expect(bridge.snapshot()).toMatchObject({ status: "connected", streamSupported: false, streamActive: null });
    vi.advanceTimersByTime(30000);
    expect(socket.sent.filter((frame) => frame.d.requestType === "GetStreamStatus")).toHaveLength(1);
    socket.reply("GetSceneList", { comment: env.LIVELIFT_OBS_PASSWORD }, 500);
    expect(bridge.snapshot()).toMatchObject({ status: "disconnected", error: "request_failed", currentProgramScene: null });
    expect(JSON.stringify(bridge.snapshot())).not.toContain(env.LIVELIFT_OBS_PASSWORD);
  });

  it("does not infer TikTok state, pins or authority from scene names, streams or custom events", () => {
    const { bridge, socket } = fixture();
    socket.identify();
    socket.reply("GetSceneList", { ...scenes, currentProgramSceneName: "TikTok LIVE / product pinned" });
    socket.reply("GetStreamStatus", { outputActive: true });
    const before = bridge.snapshot();
    socket.event("VendorEvent", { vendorName: "tiktok", live: true, pinnedProductId: "sku-1", authorityRevision: 99 });
    expect(bridge.snapshot()).toEqual(before);
    expect(Object.keys(before).sort()).toEqual(["provider", "provenance", "status", "statusChangedAt", "currentProgramScene", "scenes", "streamActive", "streamSupported", "error", "reconnectAttempts", "nextRetryAt"].sort());
    expect(socket.sent.filter((frame) => frame.op === 6).every((frame) => ["GetSceneList", "GetStreamStatus"].includes(String(frame.d.requestType)))).toBe(true);
  });
});

describe("OBS failures, redaction and reconnects", () => {
  it("clears observations immediately, reconnects, reauthenticates and resyncs", () => {
    const { bridge, socket, sockets } = fixture();
    socket.identify();
    socket.reply("GetSceneList", scenes);
    socket.reply("GetStreamStatus", { outputActive: true });
    const queuedEvent = socket.onmessage!;
    socket.disconnect();
    expect(bridge.snapshot()).toMatchObject({ status: "disconnected", currentProgramScene: null, scenes: null, streamActive: null, reconnectAttempts: 1, nextRetryAt: "2026-10-07T10:00:01.000Z" });
    vi.advanceTimersByTime(1000);
    queuedEvent.call(socket as unknown as WebSocket, { data: JSON.stringify({ op: 5, d: { eventType: "StreamStateChanged", eventData: { outputActive: true }, eventIntent: 64 } }) } as MessageEvent);
    expect(bridge.snapshot().streamActive).toBeNull();
    expect(sockets).toHaveLength(2);
    sockets[1].identify();
    sockets[1].reply("GetSceneList", scenes);
    sockets[1].reply("GetStreamStatus", { outputActive: false });
    expect(bridge.snapshot()).toMatchObject({ status: "connected", currentProgramScene: { value: "Opening" }, streamActive: { value: false } });
  });

  it("bounds retries even across connections that repeatedly authenticate then drop", () => {
    const { bridge, sockets, factory } = fixture();
    for (let attempt = 0; attempt <= 5; attempt++) {
      sockets[attempt].identify();
      sockets[attempt].disconnect();
      vi.advanceTimersByTime(1000 * 2 ** attempt);
    }
    bridge.start();
    vi.advanceTimersByTime(120000);
    expect(factory).toHaveBeenCalledTimes(6);
    expect(bridge.snapshot()).toMatchObject({ status: "unavailable", reconnectAttempts: 5, nextRetryAt: null });
  });

  it.each([false, true])("times out a silent handshake/request (identified=%s)", (identified) => {
    const { bridge, socket } = fixture();
    if (identified) socket.identify();
    vi.advanceTimersByTime(5000);
    expect(bridge.snapshot()).toMatchObject({ status: "disconnected", error: "timeout", currentProgramScene: null });
  });

  it("periodic reads detect a silent socket after a successful snapshot", () => {
    const { bridge, socket } = fixture();
    socket.identify();
    socket.reply("GetSceneList", scenes);
    socket.reply("GetStreamStatus", { outputActive: true });
    vi.advanceTimersByTime(35000);
    expect(bridge.snapshot()).toMatchObject({ status: "disconnected", error: "timeout", streamActive: null });
  });

  it.each(["not json", JSON.stringify({ op: 5, d: { eventType: "CurrentProgramSceneChanged", eventIntent: 4, eventData: { sceneName: 42 } } }), JSON.stringify({ op: 5, d: { eventType: "StreamStateChanged", eventIntent: 64, eventData: { outputActive: "true" } } })])("fails closed for malformed messages", (raw) => {
    const { bridge, socket, factory } = fixture();
    socket.identify();
    socket.raw(raw);
    vi.advanceTimersByTime(120000);
    expect(bridge.snapshot()).toMatchObject({ status: "unavailable", error: "malformed_message", currentProgramScene: null, streamActive: null });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("redacts reflected secrets and keeps config private without logging", () => {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    const { bridge, socket } = fixture();
    socket.identify();
    socket.reply("GetSceneList", { currentProgramSceneName: env.LIVELIFT_OBS_PASSWORD, scenes: [{ sceneName: env.LIVELIFT_OBS_PASSWORD }] });
    expect(bridge.snapshot().currentProgramScene!.value).toBe("[redacted]");
    expect(JSON.stringify(bridge.snapshot()) + JSON.stringify(bridge) + inspect(bridge)).not.toContain(env.LIVELIFT_OBS_PASSWORD);
    socket.raw(env.LIVELIFT_OBS_PASSWORD);
    expect(JSON.stringify(bridge.snapshot())).not.toContain(env.LIVELIFT_OBS_PASSWORD);
    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it("does not expose exceptions from transport creation/send and stop cancels retries", () => {
    const bridge = new ObsBridge(env, () => { throw new Error(env.LIVELIFT_OBS_PASSWORD); });
    bridges.push(bridge);
    expect(() => bridge.start()).not.toThrow();
    expect(bridge.snapshot().error).toBe("connection_failed");
    const { bridge: second, socket, factory } = fixture();
    socket.send = () => { throw new Error(env.LIVELIFT_OBS_PASSWORD); };
    expect(() => socket.hello()).not.toThrow();
    expect(second.snapshot().error).toBe("connection_failed");
    second.stop();
    vi.advanceTimersByTime(120000);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(second.snapshot()).toMatchObject({ status: "disconnected", nextRetryAt: null });
  });
});
