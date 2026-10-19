import { barberManifest } from "@/lib/pwa-manifest";
import { chairLink, linkBarber } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** Manifest for one barber link. Only the barber's display name is exposed (the link already shows it). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await chairLink(token);
  const me = link ? await linkBarber(link.shopId, link.chairId) : undefined;
  if (!me) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(JSON.stringify(barberManifest(token, me.barberName)), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "private, max-age=300" } });
}
