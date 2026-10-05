import {
  RuntimeSnapshot,
  SessionIdentity,
  SessionIdentitySchema,
  RuntimeSnapshotSchema,
} from "@/contracts";
import { simulator } from "@/lib/simulator/simulatorEngine";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiClient = {
  getBaseUrl() {
    return API_BASE_URL;
  },

  async getSession(id: string, forceReal = false): Promise<SessionIdentity | null> {
    // If we're not forcing real network call, check if the session is simulated or in simulator
    const simSession = simulator.getSession(id);
    if (!forceReal && simSession) {
      return simSession;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/sessions/${id}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        throw new ApiError(res.status, `Failed to fetch session: ${res.statusText}`);
      }

      const json = await res.json();
      return SessionIdentitySchema.parse(json);
    } catch (err) {
      if (forceReal) {
        // Crucial invariant: never silently fallback REAL to simulated
        throw err;
      }
      // If network fails and it wasn't forceReal, return simulator fallback only if session exists in simulator
      if (simSession) return simSession;
      throw err;
    }
  },

  async getSnapshot(sessionId: string, isReal = false): Promise<RuntimeSnapshot | null> {
    if (!isReal) {
      return simulator.getSnapshot(sessionId);
    }

    // Invariant: Network failure in REAL remains a degraded/failure condition (no silent fallback)
    const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/snapshot`, {
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new ApiError(res.status, `Failed to fetch snapshot: ${res.statusText}`);
    }

    const json = await res.json();
    return RuntimeSnapshotSchema.parse(json);
  },

  async listSessions(isReal = false): Promise<SessionIdentity[]> {
    if (!isReal) {
      return simulator.listSessions();
    }

    const res = await fetch(`${API_BASE_URL}/api/sessions`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new ApiError(res.status, `Failed to list sessions: ${res.statusText}`);
    }

    const json = await res.json();
    return json.map((item: unknown) => SessionIdentitySchema.parse(item));
  },
};
