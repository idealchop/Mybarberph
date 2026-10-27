import { json, notFound } from "@/lib/server/auth";
import { barberHistory } from "@/lib/server/barber-sales";
import { chairLink, linkBarber } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** A barber's own finished cuts, day by day: ?from=YYYY-MM-DD&to=YYYY-MM-DD (Manila, inclusive, max 62 days). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await chairLink((await params).token);
  if (!link) return notFound("This link was replaced or turned off.");
  const me = await linkBarber(link.shopId, link.chairId);
  if (!me) return notFound();
  const sp = new URL(req.url).searchParams;
  return json(await barberHistory(link.shopId, { from: sp.get("from") || "", to: sp.get("to") || "", barberId: me.barberId, chairId: link.chairId, locationId: me.locationId }));
}
