export const dynamic = "force-dynamic";

/** The build id of the running deploy; clients compare it with their own to offer "Update available". */
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID || "dev" }, { headers: { "Cache-Control": "no-store" } });
}
