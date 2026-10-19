/**
 * Protected Monday tips runner. Called by Cloud Scheduler (or manually with the same secret).
 * Auth: Authorization: Bearer <COMPANION_CRON_SECRET>, or x-companion-cron header.
 * Body optional: { shopId?: string, force?: boolean }. Without shopId, runs for every named shop.
 */
import { json, badRequest, unauthorized } from "@/lib/server/auth";
import { allShopIds, weeklyTips } from "@/lib/server/companion/companion";
import { companionEnabled } from "@/lib/companion-flag";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.COMPANION_CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const h = req.headers.get("x-companion-cron") || "";
  return auth === `Bearer ${secret}` || h === secret;
}

export async function POST(req: Request) {
  if (!companionEnabled()) return json({ error: "Not found", code: "not_found" }, 404);
  if (!authorized(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const force = Boolean(body.force);
  const shopId = typeof body.shopId === "string" ? body.shopId : null;
  if (shopId) {
    try { return json({ results: [{ shopId, ...(await weeklyTips(shopId, { force })) }] }); }
    catch (e) { return json({ results: [{ shopId, error: (e as Error).message }] }, 502); }
  }
  const ids = await allShopIds();
  if (!ids.length) return badRequest("No shops.");
  const results = [];
  for (const id of ids) {
    try { results.push({ shopId: id, ...(await weeklyTips(id, { force })) }); }
    catch (e) { results.push({ shopId: id, error: (e as Error).message }); }
  }
  return json({ results });
}
