import { RuntimeSnapshot } from "@/contracts";

export type RealtimeConnectionState =
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "stale";

export interface RealtimeEvent<T = unknown> {
  id: string;
  revision: number;
  type: string;
  payload: T;
  emittedAt: string;
}

export type RealtimeListener = (event: RealtimeEvent) => void;

export class RealtimeClient {
  private state: RealtimeConnectionState = "connected";
  private listeners: Set<RealtimeListener> = new Set();
  private currentRevision = 1;

  public getConnectionState(): RealtimeConnectionState {
    return this.state;
  }

  public setConnectionState(state: RealtimeConnectionState) {
    this.state = state;
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emitEvent(type: string, payload: unknown) {
    this.currentRevision += 1;
    const event: RealtimeEvent = {
      id: `evt_${Date.now()}`,
      revision: this.currentRevision,
      type,
      payload,
      emittedAt: new Date().toISOString(),
    };

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public async resync(sessionId: string): Promise<{ snapshot: RuntimeSnapshot | null; revision: number }> {
    // In production, queries backend /resync endpoint
    const { simulator } = await import("@/lib/simulator/simulatorEngine");
    const snapshot = simulator.getSnapshot(sessionId);
    return {
      snapshot,
      revision: snapshot?.session.revision || 1,
    };
  }
}

export const realtimeClient = new RealtimeClient();
