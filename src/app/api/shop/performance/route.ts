import { entitledPlan } from "@/lib/entitlements";
import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { chairPerformance, loadShopData } from "@/lib/server/companion/data";
import { effectivePlan, ensureShop, manilaDayStart } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** Chair performance for the owner: ?loc=<id|all>&range=today|7d|28d. Real bookings only. */
export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const sp = new URL(req.url).searchParams;
  const range = sp.get("range") === "7d" ? "7d" : sp.get("range") === "28d" ? "28d" : "today";
  const loc = sp.get("loc") || "all";
  const from = range === "today" ? manilaDayStart() : manilaDayStart() - (range === "7d" ? 6 : 27) * 86_400_000;
  const shop = await ensureShop(me.uid);
  const data = await loadShopData(me.uid, shop.name, entitledPlan(effectivePlan(shop)));
  return json({ range, loc, from, ...chairPerformance(data, from, loc) });
}
