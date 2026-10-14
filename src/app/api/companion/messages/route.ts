import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { listMessages, loadMemory, quota } from "@/lib/server/companion/companion";
import { effectivePlan, ensureShop } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const shop = await ensureShop(me.uid);
  const plan = effectivePlan(shop);
  const [messages, mem, q] = await Promise.all([listMessages(me.uid), loadMemory(me.uid), quota(me.uid, plan)]);
  return json({ messages, goals: mem.goals, quota: q, plan });
}
