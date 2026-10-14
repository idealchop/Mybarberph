import { json, notFound } from "@/lib/server/auth";
import { chairLink, loadBookings, loadState, publicShop, shopRef, type ShopDoc } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** A barber's private chair link: no account, scoped to that one shop. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await chairLink((await params).token);
  if (!link) return notFound("This link has expired or was replaced.");
  const snap = await shopRef(link.shopId).get();
  if (!snap.exists) return notFound();
  const [values, bookings] = await Promise.all([
    loadState(link.shopId, ["barbers.shop-profile", "barbers.shop-menu", "barbers.shop-chairs", "barbers.shop-locations"]),
    loadBookings(link.shopId, 150),
  ]);
  const shop = snap.data() as ShopDoc;
  return json({ shopId: link.shopId, chairId: link.chairId, shop: { ...publicShop(link.shopId, shop), plan: shop.plan }, values, bookings });
}
