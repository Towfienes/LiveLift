import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { readObsConfig } from "./config";
import type { ObsError, ObsObservation, ObsSnapshot, ObsStatus } from "./types";

// Native Node 22 WebSocket; no browser transport or additional dependency.
export type ObsSocket = Pick<WebSocket, "send" | "close" | "onmessage" | "onerror" | "onclose">;
type RequestType = "GetSceneList" | "GetStreamStatus";
type Pending = { type: RequestType; sceneVersion: number; listVersion: number; streamVersion: number; timer: ReturnType<typeof setTimeout> };
const envelope = z.object({ op: z.number().int(), d: z.record(z.unknown()) });
const name = z.string().min(1).max(4096);
const sceneList = z.array(z.object({ sceneName: name })).max(10000);
const scenesResponse = z.object({ currentProgramSceneName: name.nullable(), scenes: sceneList });
const streamResponse = z.object({ outputActive: z.boolean() });
const response = z.object({ requestId: z.string(), requestType: z.string(), requestStatus: z.object({ result: z.boolean(), code: z.number().int() }), responseData: z.unknown().optional() });
const event = z.object({ eventType: z.string(), eventIntent: z.number().int(), eventData: z.unknown().optional() });
const TIMEOUT_MS = 5000;
const REFRESH_MS = 30000;
const MAX_RECONNECTS = 5;

function later(callback: () => void, ms: number) {
  const timer = setTimeout(callback, ms);
  timer.unref?.();
  return timer;
}

/** Read-only obs-websocket V5 / RPC 1 adapter. Never emits LiveLift commands. */
export class ObsBridge {
  #config: ReturnType<typeof readObsConfig>;
  #factory: (url: string) => ObsSocket;
  #socket: ObsSocket | null = null;
  #started = false;
  #identified = false;
  #identifySent = false;
  #pending = new Map<string, Pending>();
  #deadline: ReturnType<typeof setTimeout> | undefined;
  #retry: ReturnType<typeof setTimeout> | undefined;
  #refresh: ReturnType<typeof setTimeout> | undefined;
  #sceneVersion = 0;
  #listVersion = 0;
  #streamVersion = 0;
  #collectionChanging = false;
  #state: ObsSnapshot;

  constructor(env: Readonly<Record<string, string | undefined>> = process.env, factory: (url: string) => ObsSocket = (url) => new WebSocket(url, "obswebsocket.json")) {
    this.#config = readObsConfig(env);
    this.#factory = factory;
    this.#state = {
      provider: "obs", provenance: "provider_observed",
      status: this.#config.kind === "configured" ? "disconnected" : this.#config.kind === "not_configured" ? "not_configured" : "unavailable",
      statusChangedAt: new Date().toISOString(), currentProgramScene: null, scenes: null, streamActive: null, streamSupported: null,
      error: this.#config.kind === "invalid_config" ? "invalid_config" : null, reconnectAttempts: 0, nextRetryAt: null,
    };
  }

  snapshot(): ObsSnapshot { return structuredClone(this.#state); }

  start(): void {
    if (this.#started || this.#config.kind !== "configured") return;
    this.#started = true;
    this.#state.reconnectAttempts = 0;
    this.#connect();
  }

  stop(): void {
    this.#started = false;
    clearTimeout(this.#retry);
    this.#retry = undefined;
    this.#cleanup();
    this.#state.nextRetryAt = null;
    if (this.#config.kind === "configured") this.#status("disconnected", null);
  }

  #status(status: ObsStatus, error: ObsError | null): void {
    this.#state.status = status;
    this.#state.error = error;
    this.#state.statusChangedAt = new Date().toISOString();
  }

  #clearObservations(): void {
    this.#state.currentProgramScene = null;
    this.#state.scenes = null;
    this.#state.streamActive = null;
    this.#state.streamSupported = null;
  }

  #cleanup(): void {
    clearTimeout(this.#deadline);
    clearTimeout(this.#refresh);
    this.#deadline = this.#refresh = undefined;
    for (const pending of this.#pending.values()) clearTimeout(pending.timer);
    this.#pending.clear();
    const socket = this.#socket;
    this.#socket = null;
    this.#identified = this.#identifySent = this.#collectionChanging = false;
    this.#clearObservations();
    if (socket) {
      // Retain a no-op error handler for native sockets closed during connection setup.
      socket.onmessage = socket.onclose = null;
      socket.onerror = () => {};
      try { socket.close(); } catch { /* Provider exceptions never escape or get logged. */ }
    }
  }

  #fail(error: ObsError, terminal = false): void {
    this.#cleanup();
    this.#state.nextRetryAt = null;
    if (!this.#started || terminal || this.#state.reconnectAttempts >= MAX_RECONNECTS) {
      this.#status("unavailable", error);
      return;
    }
    const delay = Math.min(1000 * 2 ** this.#state.reconnectAttempts, 30000);
    this.#state.reconnectAttempts++;
    this.#state.nextRetryAt = new Date(Date.now() + delay).toISOString();
    this.#status("disconnected", error);
    this.#retry = later(() => { this.#retry = undefined; this.#connect(); }, delay);
  }

  #connect(): void {
    if (!this.#started || this.#config.kind !== "configured") return;
    this.#state.nextRetryAt = null;
    this.#status("connecting", null);
    try {
      const socket = this.#factory(this.#config.url);
      this.#socket = socket;
      this.#deadline = later(() => this.#fail("timeout"), TIMEOUT_MS);
      socket.onmessage = (message) => {
        if (this.#socket !== socket) return;
        try { this.#message(message.data); }
        catch { this.#fail("malformed_message", true); }
      };
      socket.onerror = () => { if (this.#socket === socket) this.#fail("connection_failed"); };
      socket.onclose = (close) => {
        if (this.#socket !== socket) return;
        const auth = close.code === 4009;
        const protocol = close.code >= 4002 && close.code <= 4012;
        this.#fail(auth ? "authentication_failed" : protocol ? "unsupported_protocol" : "connection_failed", auth || protocol);
      };
    } catch { this.#fail("connection_failed"); }
  }

  #send(op: number, d: object): void {
    try { this.#socket?.send(JSON.stringify({ op, d })); }
    catch { this.#fail("connection_failed"); }
  }

  #request(type: RequestType): void {
    if (!this.#identified || (type === "GetSceneList" && this.#collectionChanging)) return;
    if ([...this.#pending.values()].some((pending) => pending.type === type)) return;
    const requestId = randomUUID();
    this.#pending.set(requestId, {
      type, sceneVersion: this.#sceneVersion, listVersion: this.#listVersion, streamVersion: this.#streamVersion,
      timer: later(() => this.#fail("timeout"), TIMEOUT_MS),
    });
    this.#send(6, { requestType: type, requestId });
  }

  #poll(): void {
    this.#request("GetSceneList");
    if (this.#state.streamSupported !== false) this.#request("GetStreamStatus");
    if (this.#identified) this.#refresh = later(() => this.#poll(), REFRESH_MS);
  }

  #observed<T>(value: T): ObsObservation<T> {
    return { value, receivedAt: new Date().toISOString(), providerTimestamp: null };
  }

  #safeName(value: string): string {
    return this.#config.kind === "configured" ? value.replaceAll(this.#config.password, "[redacted]") : value;
  }

  #message(raw: unknown): void {
    // Bound parsing and collection size. Never retain raw messages or provider error comments.
    if (typeof raw !== "string" || raw.length > 1024 * 1024) throw new Error();
    const { op, d } = envelope.parse(JSON.parse(raw));
    if (op === 0) {
      if (this.#identifySent || this.#identified) throw new Error();
      const hello = z.object({ rpcVersion: z.number().int().min(1), authentication: z.object({ salt: z.string().min(1).max(4096), challenge: z.string().min(1).max(4096) }).optional() }).parse(d);
      if (!hello.authentication) { this.#fail("authentication_required", true); return; }
      if (this.#config.kind !== "configured") return;
      const hash = (value: string) => createHash("sha256").update(value).digest("base64");
      const authentication = hash(hash(this.#config.password + hello.authentication.salt) + hello.authentication.challenge);
      this.#identifySent = true;
      // Config, Scenes, Outputs only: 2 | 4 | 64.
      this.#send(1, { rpcVersion: 1, authentication, eventSubscriptions: 70 });
      return;
    }
    if (op === 2) {
      if (!this.#identifySent || this.#identified || d.negotiatedRpcVersion !== 1) { this.#fail("unsupported_protocol", true); return; }
      clearTimeout(this.#deadline);
      this.#deadline = undefined;
      this.#identified = true;
      this.#status("connected", null);
      this.#poll();
      return;
    }
    if (!this.#identified) throw new Error();
    if (op === 7) { this.#response(d); return; }
    if (op === 5) { this.#event(d); return; }
    throw new Error();
  }

  #response(data: unknown): void {
    const reply = response.parse(data);
    const pending = this.#pending.get(reply.requestId);
    if (!pending) return; // A late response from a superseded collection/read.
    if (pending.type !== reply.requestType) throw new Error();
    clearTimeout(pending.timer);
    this.#pending.delete(reply.requestId);
    if (!reply.requestStatus.result) {
      if (pending.type === "GetStreamStatus" && reply.requestStatus.code === 204) {
        if (pending.streamVersion === this.#streamVersion) {
          this.#state.streamSupported = false;
          this.#state.streamActive = null;
        }
      } else this.#fail("request_failed");
      return;
    }
    if (reply.requestStatus.code !== 100) throw new Error();
    if (pending.type === "GetSceneList") {
      const scenes = scenesResponse.parse(reply.responseData);
      // An event received after the read was sent is newer than that read's snapshot.
      if (!this.#collectionChanging && pending.sceneVersion === this.#sceneVersion) this.#state.currentProgramScene = scenes.currentProgramSceneName === null ? null : this.#observed(this.#safeName(scenes.currentProgramSceneName));
      if (!this.#collectionChanging && pending.listVersion === this.#listVersion) this.#state.scenes = this.#observed(scenes.scenes.map((scene) => this.#safeName(scene.sceneName)));
    } else {
      const stream = streamResponse.parse(reply.responseData);
      if (pending.streamVersion === this.#streamVersion) {
        this.#state.streamSupported = true;
        this.#state.streamActive = this.#observed(stream.outputActive);
      }
    }
  }

  #event(data: unknown): void {
    const received = event.parse(data);
    if (received.eventType === "CurrentProgramSceneChanged") {
      const scene = z.object({ sceneName: name }).parse(received.eventData);
      this.#sceneVersion++;
      if (!this.#collectionChanging) this.#state.currentProgramScene = this.#observed(this.#safeName(scene.sceneName));
    } else if (received.eventType === "SceneListChanged") {
      const list = z.object({ scenes: sceneList }).parse(received.eventData);
      this.#listVersion++;
      if (!this.#collectionChanging) this.#state.scenes = this.#observed(list.scenes.map((scene) => this.#safeName(scene.sceneName)));
    } else if (received.eventType === "StreamStateChanged") {
      const stream = streamResponse.parse(received.eventData);
      this.#streamVersion++;
      this.#state.streamSupported = true;
      this.#state.streamActive = this.#observed(stream.outputActive);
    } else if (["CurrentSceneCollectionChanging", "CurrentSceneCollectionChanged", "SceneCreated", "SceneRemoved", "SceneNameChanged"].includes(received.eventType)) {
      // Invalidate in-flight reads and wait for the new collection before requesting scenes.
      this.#sceneVersion++;
      this.#listVersion++;
      this.#state.currentProgramScene = this.#state.scenes = null;
      for (const [id, pending] of this.#pending) if (pending.type === "GetSceneList") { clearTimeout(pending.timer); this.#pending.delete(id); }
      this.#collectionChanging = received.eventType === "CurrentSceneCollectionChanging" || (this.#collectionChanging && received.eventType !== "CurrentSceneCollectionChanged");
      this.#request("GetSceneList");
    }
    // Other subscribed events are ignored; they confer no platform or authority truth.
  }
}
