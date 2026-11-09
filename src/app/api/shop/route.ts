import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { effectivePlan, ensureLiveRev, ensureShop, loadBookings, loadState, publicShop } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** Everything the signed-in owner's app needs: shop, saved state and bookings. `?rev=` skips the booking read when nothing changed. */
export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const shop = await ensureShop(me.uid);
  const rev = await ensureLiveRev(me.uid, shop.queueRev);
  const since = Number(new URL(req.url).searchParams.get("rev"));
  if (rev > 0 && since === rev) return json({ unchanged: true, rev });
  const [values, bookings] = await Promise.all([loadState(me.uid), loadBookings(me.uid)]);
  return json({ shopId: me.uid, shop: { ...publicShop(me.uid, shop), plan: effectivePlan(shop), planStatus: shop.planStatus ?? "active", planRenewsAt: shop.planRenewsAt ?? null }, values, bookings, rev });
}
