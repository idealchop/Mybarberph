import { json, notFound } from "@/lib/server/auth";
import { barberPerformance } from "@/lib/server/barber-sales";
import { chairLink, linkBarber } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** A barber's own performance on their link: ?range=week|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await chairLink((await params).token);
  if (!link) return notFound("This link has expired.");
  const me = await linkBarber(link.shopId, link.chairId);
  if (!me) return notFound();
  const sp = new URL(req.url).searchParams;
  return json(await barberPerformance(link.shopId, { range: sp.get("range"), from: sp.get("from"), to: sp.get("to"), barberId: me.barberId, chairId: link.chairId, locationId: me.locationId }));
}
