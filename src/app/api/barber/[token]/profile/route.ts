import { json, notFound } from "@/lib/server/auth";
import { barberProfile } from "@/lib/server/barber-sales";
import { chairLink, linkBarber } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** The barber's own read-only profile on their link: ?range=today|7d|all. Only their own share + tips; rank as a position. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await chairLink((await params).token);
  if (!link) return notFound("This link was replaced or turned off.");
  const me = await linkBarber(link.shopId, link.chairId);
  if (!me) return notFound();
  return json(await barberProfile(link.shopId, { range: new URL(req.url).searchParams.get("range"), barberId: me.barberId, chairId: link.chairId, locationId: me.locationId }));
}
