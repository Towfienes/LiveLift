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
  token?: string | null;
  extraHeaders?: Record<string, string>;
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
 * Configured with real Bearer capabilities matching backend test configuration.
 */
export class AuthorityClient {
  readonly config: AuthorityClientConfig;

  constructor(config: Partial<AuthorityClientConfig> = {}) {
    const role = config.role ?? "operator";
    const defaultToken =
      role === "operator"
        ? (process.env.LIVELIFT_OPERATOR_TOKEN || "test-operator-token")
        : (process.env.LIVELIFT_VIEWER_TOKEN || "test-viewer-token");

    this.config = {
      baseUrl: config.baseUrl ?? (process.env.LIVELIFT_TEST_SERVER_URL || "http://localhost:3130"),
      roomId: config.roomId ?? "room-default",
      actorId: config.actorId ?? (role === "operator" ? "actor-op-1" : "actor-vw-1"),
      actorName: config.actorName ?? (role === "operator" ? "Lead Operator" : "Guest Viewer"),
      role,
      token: config.token === undefined ? defaultToken : config.token,
      extraHeaders: config.extraHeaders,
    };
  }

  private getHeaders(overrideHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-LiveLift-Room": this.config.roomId,
    };
    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }
    if (this.config.extraHeaders) {
      Object.assign(headers, this.config.extraHeaders);
    }
    if (overrideHeaders) {
      Object.assign(headers, overrideHeaders);
    }
    return headers;
  }

  /** POST /api/v3/room/commands */
  async sendCommand(envelope: CommandEnvelope, extraHeaders?: Record<string, string>): Promise<SendCommandResult> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/v3/room/commands`, {
        method: "POST",
        headers: this.getHeaders(extraHeaders),
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
  async getReceipt(commandId: string, extraHeaders?: Record<string, string>): Promise<GetReceiptResult> {
    try {
      const res = await fetch(
        `${this.config.baseUrl}/api/v3/room/commands/${encodeURIComponent(commandId)}`,
        {
          method: "GET",
          headers: this.getHeaders(extraHeaders),
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
  async pollRoom(afterRevision?: number, extraHeaders?: Record<string, string>): Promise<PollRoomResult> {
    try {
      const url = new URL(`${this.config.baseUrl}/api/v3/room`);
      if (afterRevision !== undefined) {
        url.searchParams.set("afterRevision", String(afterRevision));
      }

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(extraHeaders),
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
