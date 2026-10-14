import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { weeklyTips } from "@/lib/server/companion/companion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Owner can re-run this week's tips (force) for their own shop. Used on Home and for QA. */
export async function POST(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  try {
    // Re-running a week that was already sent is a dev-only QA aid (cost + Partner tip limit).
    const r = await weeklyTips(me.uid, { force: Boolean(body.force) && process.env.BARBERS_ENV === "dev" });
    return json(r);
  } catch (e) {
    console.error("[companion/weekly]", e);
    return json({ error: "Couldn't generate tips right now." }, 502);
  }
}
