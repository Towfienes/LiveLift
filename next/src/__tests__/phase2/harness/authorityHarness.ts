import type {
  AuthorityReceipt,
  CommandEnvelope,
  CommandResponse,
  RoomRead,
} from "@/contracts/authority";

export interface AuthorityClientConfig {
  baseUrl: string;
  roomId: string;
  actorId: string;
  actorName: string;
  role: "operator" | "viewer";
  token?: string;
}

export interface SendCommandResult {
  status: number;
  data: CommandResponse | null;
  error?: string;
}

export interface GetReceiptResult {
  status: number;
  data: AuthorityReceipt | null;
  error?: string;
}

export interface PollRoomResult {
  status: number;
  data: RoomRead | null;
  error?: string;
}

/**
 * Black-box HTTP client for Phase 2 Remote Room Authority.
 * Communicates strictly over the frozen wire contract defined in docs/phase2/contract.md.
 */
export class AuthorityClient {
  readonly config: AuthorityClientConfig;

  constructor(config: Partial<AuthorityClientConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? (process.env.LIVELIFT_TEST_SERVER_URL || "http://localhost:3130"),
      roomId: config.roomId ?? "room-default",
      actorId: config.actorId ?? "actor-operator-1",
      actorName: config.actorName ?? "Lead Operator",
      role: config.role ?? "operator",
      token: config.token,
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-LiveLift-Room": this.config.roomId,
      "X-LiveLift-Actor-Id": this.config.actorId,
      "X-LiveLift-Actor-Name": this.config.actorName,
      "X-LiveLift-Role": this.config.role,
    };
    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }
    return headers;
  }

  /** POST /api/v3/room/commands */
  async sendCommand(envelope: CommandEnvelope): Promise<SendCommandResult> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/v3/room/commands`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(envelope),
      });

      const body = await res.json().catch(() => null);
      return {
        status: res.status,
        data: res.ok ? (body as CommandResponse) : (body as CommandResponse | null),
        error: !res.ok ? (body?.message ?? res.statusText) : undefined,
      };
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** GET /api/v3/room/commands/<commandId> */
  async getReceipt(commandId: string): Promise<GetReceiptResult> {
    try {
      const res = await fetch(
        `${this.config.baseUrl}/api/v3/room/commands/${encodeURIComponent(commandId)}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );

      const body = await res.json().catch(() => null);
      return {
        status: res.status,
        data: res.ok ? (body as AuthorityReceipt) : null,
        error: !res.ok ? (body?.message ?? res.statusText) : undefined,
      };
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** GET /api/v3/room?afterRevision=<revision> */
  async pollRoom(afterRevision?: number): Promise<PollRoomResult> {
    try {
      const url = new URL(`${this.config.baseUrl}/api/v3/room`);
      if (afterRevision !== undefined) {
        url.searchParams.set("afterRevision", String(afterRevision));
      }

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(),
      });

      const body = await res.json().catch(() => null);
      return {
        status: res.status,
        data: res.ok ? (body as RoomRead) : null,
        error: !res.ok ? (body?.message ?? res.statusText) : undefined,
      };
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Poll until room revision >= targetRevision or timeout is reached */
  async waitForConvergence(targetRevision: number, timeoutMs = 2000): Promise<RoomRead> {
    const start = Date.now();
    let lastRead: RoomRead | null = null;

    while (Date.now() - start < timeoutMs) {
      const res = await this.pollRoom();
      if (res.data) {
        lastRead = res.data;
        if (res.data.revision >= targetRevision) {
          return res.data;
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    throw new Error(
      `Room convergence timed out after ${timeoutMs}ms. Expected revision >= ${targetRevision}, got ${lastRead?.revision ?? "none"}`
    );
  }
}

/** Check if backend authority server is currently available for integration testing */
export function isBackendAvailable(): boolean {
  return Boolean(process.env.LIVELIFT_TEST_SERVER_URL);
}
