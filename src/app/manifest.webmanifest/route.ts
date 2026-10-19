import { ownerManifest } from "@/lib/pwa-manifest";

export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(ownerManifest()), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
