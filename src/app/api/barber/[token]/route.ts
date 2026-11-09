import { json, notFound } from "@/lib/server/auth";
import { chairLink, effectivePlan, ensureLiveRev, linkBarber, loadBarberBookings, loadState, publicShop, shopRef, type ShopDoc } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** A barber's private chair link: no account, scoped to that one shop and to this barber's own bookings. `?rev=` skips the booking read when nothing changed. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await chairLink((await params).token);
  if (!link) return notFound("This link was replaced or turned off.");
  const snap = await shopRef(link.shopId).get();
  if (!snap.exists) return notFound();
  const me = await linkBarber(link.shopId, link.chairId);
  if (!me) return notFound("This link was replaced or turned off.");
  const shop = snap.data() as ShopDoc;
  const rev = await ensureLiveRev(link.shopId, shop.queueRev);
  const since = Number(new URL(req.url).searchParams.get("rev"));
  if (rev > 0 && since === rev) return json({ unchanged: true, rev });
  const [values, bookings] = await Promise.all([
    loadState(link.shopId, ["barbers.shop-profile", "barbers.shop-menu", "barbers.shop-chairs", "barbers.shop-locations"]),
    loadBarberBookings(link.shopId, me),
  ]);
  return json({ shopId: link.shopId, chairId: link.chairId, shop: { ...publicShop(link.shopId, shop), plan: effectivePlan(shop) }, values, bookings, rev });
}
