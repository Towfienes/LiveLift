import { AuthorityError } from "@/lib/server/config";
import { authorized, json } from "@/lib/server/http";
import { envelopeSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return authorized(request, async (authority, access) => {
    let input: unknown;
    try { input = await request.json(); }
    catch { throw new AuthorityError(400, "malformed_envelope", "Command body must be JSON."); }
    const parsed = envelopeSchema.safeParse(input);
    if (!parsed.success) throw new AuthorityError(400, "malformed_envelope", "Invalid command envelope.");
    const result = authority.command(parsed.data, access);
    return json(result.body, result.status);
  });
}
