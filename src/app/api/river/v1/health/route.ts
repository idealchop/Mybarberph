import { json } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/river/v1/health — liveness. Unauthenticated; says nothing about configuration. */
export function GET() {
  return json({ status: "ok", apiVersion: "v1" });
}
