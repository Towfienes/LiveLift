import { createHash, timingSafeEqual } from "node:crypto";
import { isAbsolute } from "node:path";
import { z } from "zod";
import type { RoomRead } from "@/contracts/authority";
import { idSchema } from "./validation";

export class AuthorityError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const capabilitySchema = z.object({
  token: z.string().min(1).regex(/^\S+$/),
  roomId: idSchema,
  actorId: idSchema,
  name: z.string().refine((name) => name.trim() !== ""),
  role: z.enum(["operator", "viewer"]),
}).strict();
export type Access = RoomRead["access"];
export type AuthorityConfig = {
  roomId: string;
  dbPath: string;
  capabilities: z.infer<typeof capabilitySchema>[];
};

export function loadConfig(): AuthorityConfig {
  try {
    const roomId = idSchema.parse(process.env.LIVELIFT_ROOM_ID);
    const dbPath = z.string().min(1).parse(process.env.LIVELIFT_DB_PATH);
    if (!isAbsolute(dbPath)) throw new Error("An absolute database file path is required");
    const capabilities = z.array(capabilitySchema).min(1).parse(JSON.parse(process.env.LIVELIFT_CAPABILITIES ?? ""));
    if (capabilities.some((c) => c.roomId !== roomId) || new Set(capabilities.map((c) => c.token)).size !== capabilities.length) {
      throw new Error("Capabilities must be unique and scoped to the configured room");
    }
    return { roomId, dbPath, capabilities };
  } catch {
    throw new AuthorityError(503, "authority_unavailable", "Room authority configuration is unavailable.");
  }
}

export function authenticate(request: Request, config: AuthorityConfig): Access {
  const bearer = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "");
  if (bearer) {
    const hash = (token: string) => createHash("sha256").update(token).digest();
    const supplied = hash(bearer[1]);
    const capability = config.capabilities.find((c) => timingSafeEqual(supplied, hash(c.token)));
    if (capability) {
      const { actorId, name, role } = capability;
      return { actorId, name, role };
    }
  }
  throw new AuthorityError(401, "unauthorized", "A valid room capability is required.");
}
