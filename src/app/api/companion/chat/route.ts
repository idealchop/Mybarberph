import { getCaller, json, unauthorized, badRequest } from "@/lib/server/auth";
import { chat } from "@/lib/server/companion/companion";
import { companionEnabled } from "@/lib/companion-flag";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!companionEnabled()) return json({ error: "Not found" }, 404);
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text) return badRequest("Type a message.");
  if (text.length > 2000) return badRequest("Keep messages under 2,000 characters.");
  try {
    const r = await chat(me.uid, text, typeof body.locationId === "string" ? body.locationId : undefined);
    if (r.limited) {
      return json({
        limited: true, quota: r.quota,
        upgrade: "You've used your 10 Companion questions for this month on Partner. Upgrade to Pro or Lifetime for unlimited chat, weekly tips and goals.",
      }, 402);
    }
    return json({ limited: false, quota: r.quota, message: r.message, user: r.user });
  } catch (e) {
    console.error("[companion/chat]", e);
    return json({ error: "Companion is busy right now. Try again in a moment." }, 502);
  }
}
