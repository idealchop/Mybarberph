import { json, notFound } from "@/lib/server/auth";
import { barberSales } from "@/lib/server/barber-sales";
import { chairLink, linkBarber } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** A barber's own totals on their chair link: ?range=week|month. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await chairLink((await params).token);
  if (!link) return notFound("This link has expired.");
  const me = await linkBarber(link.shopId, link.chairId);
  if (!me) return notFound();
  const range = new URL(req.url).searchParams.get("range") === "month" ? "month" : "week";
  const r = await barberSales(link.shopId, { range, barberId: me.barberId });
  return json({ ...r, mine: r.barbers[0] ?? { ...r.total, barberId: me.barberId, barberName: me.barberName } });
}
