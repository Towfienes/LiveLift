import type { ObsSocket } from "./bridge";

/** Deterministic test-only OBS V5 peer; never imported by the runtime. */
export class MockObsSocket implements ObsSocket {
  onmessage: WebSocket["onmessage"] = null;
  onerror: WebSocket["onerror"] = null;
  onclose: WebSocket["onclose"] = null;
  sent: { op: number; d: Record<string, unknown> }[] = [];
  closed = false;

  send(data: string): void { this.sent.push(JSON.parse(data)); }
  close(): void { this.closed = true; }
  raw(data: unknown): void { this.onmessage?.call(this as unknown as WebSocket, { data } as MessageEvent); }
  receive(op: number, d: object): void { this.raw(JSON.stringify({ op, d })); }
  hello(auth = true): void { this.receive(0, { rpcVersion: 1, authentication: auth ? { salt: "fixture-salt", challenge: "fixture-challenge" } : undefined }); }
  identify(): void { this.hello(); this.receive(2, { negotiatedRpcVersion: 1 }); }
  disconnect(code = 1006, reason = ""): void { this.onclose?.call(this as unknown as WebSocket, { code, reason } as CloseEvent); }
  event(eventType: string, eventData: unknown): void { this.receive(5, { eventType, eventIntent: 70, eventData }); }
  request(type: string) { return this.sent.filter((frame) => frame.op === 6 && frame.d.requestType === type).at(-1)!.d; }
  reply(type: string, responseData: unknown, code = 100, request = this.request(type)): void {
    this.receive(7, { ...request, responseData, requestStatus: { result: code === 100, code } });
  }
}
