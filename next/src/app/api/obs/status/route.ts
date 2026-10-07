import { getObsBridge } from "@/lib/integrations/obs/runtime";
import { authorized, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return authorized(request, () => json(getObsBridge().snapshot()));
}
