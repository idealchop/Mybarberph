import { companionEnabled } from "@/lib/companion-flag";
import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { getConversation, listConversations, listMessages, loadMemory, quota } from "@/lib/server/companion/companion";
import { effectivePlan, ensureShop } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/**
 * Conversations list + one conversation's messages.
 * ?c=<id> opens that conversation; without it, the most recently used one is restored.
 */
export async function GET(req: Request) {
  if (!companionEnabled()) return json({ error: "Not found" }, 404);
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const shop = await ensureShop(me.uid);
  const plan = effectivePlan(shop);
  const wanted = new URL(req.url).searchParams.get("c");
  const [conversations, mem, q] = await Promise.all([listConversations(me.uid), loadMemory(me.uid), quota(me.uid, plan)]);
  let active = wanted === "new" ? null : wanted ? await getConversation(me.uid, wanted) : (conversations.find((c) => !c.pinned) ?? null);
  if (wanted && wanted !== "new" && !active) active = null;
  const messages = active ? await listMessages(me.uid, active.id) : [];
  return json({ conversations, conversationId: active?.id ?? null, messages, goals: mem.goals, quota: q, plan });
}
