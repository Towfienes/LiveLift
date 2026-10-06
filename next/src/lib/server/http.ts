import { RoomAuthority } from "./authority";
import { authenticate, AuthorityError, loadConfig, type Access, type AuthorityConfig } from "./config";

let authority: RoomAuthority | undefined;
let config: AuthorityConfig | undefined;

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization" } });
}

export async function authorized(
  request: Request,
  operation: (authority: RoomAuthority, access: Access) => Response | Promise<Response>,
): Promise<Response> {
  try {
    config ??= loadConfig();
    const access = authenticate(request, config);
    authority ??= new RoomAuthority(config.roomId, config.dbPath);
    return await operation(authority, access);
  } catch (error) {
    if (error instanceof AuthorityError) return json({ error: { code: error.code, message: error.message } }, error.status);
    return json({ error: { code: "authority_unavailable", message: "Room storage or authority is unavailable. Command outcome may be unknown; reconcile through receipt lookup." } }, 503);
  }
}
