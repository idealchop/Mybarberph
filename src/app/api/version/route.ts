import { APP_VERSION, BUILD_ID } from "@/lib/app-version";

export const dynamic = "force-dynamic";

/** The build id of the running deploy; clients compare it with their own to offer "Update available". */
export function GET() {
  return Response.json({ build: BUILD_ID, version: APP_VERSION }, { headers: { "Cache-Control": "no-store" } });
}
