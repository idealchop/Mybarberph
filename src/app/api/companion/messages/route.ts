import { entitledPlan } from "@/lib/entitlements";
import { companionEnabled } from "@/lib/companion-flag";
import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { listMessages, loadMemory, quota } from "@/lib/server/companion/companion";
import { effectivePlan, ensureShop } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** The shop's single Companion thread: newest page, or older with ?before=<createdAt ms>. */
export async function GET(req: Request) {
  if (!companionEnabled()) return json({ error: "Not found" }, 404);
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const sp = new URL(req.url).searchParams;
  const before = Number(sp.get("before")) || undefined;
  const limit = Number(sp.get("limit")) || 30;
  if (before) return json(await listMessages(me.uid, { before, limit }));
  const shop = await ensureShop(me.uid);
  const plan = entitledPlan(effectivePlan(shop));
  const [page, mem, q] = await Promise.all([listMessages(me.uid, { limit }), loadMemory(me.uid), quota(me.uid, plan)]);
  return json({ ...page, goals: mem.goals, quota: q, plan });
}
