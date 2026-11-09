import { badRequest, getCaller, json, notFound, unauthorized } from "@/lib/server/auth";
import { cleanFeedback, myFeedback, saveFeedback, type FeedbackWho } from "@/lib/server/feedback";
import { chairLink, linkBarber } from "@/lib/server/shops";

/** Owners rate with their sign-in; a barber link rates with its token. Returns null when neither is valid. */
async function who(req: Request, token: string | null | undefined): Promise<FeedbackWho | null | "bad-link"> {
  if (token) {
    const link = await chairLink(String(token).slice(0, 200));
    const me = link ? await linkBarber(link.shopId, link.chairId) : undefined;
    return link && me ? { role: "barber", shopId: link.shopId, token: String(token) } : "bad-link";
  }
  const me = await getCaller(req);
  return me ? { role: "owner", shopId: me.uid } : null;
}

/** Own review only (≤1 doc). No summary — Install page does not show average/count (Shops PH v2). */
export async function GET(req: Request) {
  const w = await who(req, new URL(req.url).searchParams.get("token"));
  if (!w || w === "bad-link") return json({ mine: null });
  return json({ mine: await myFeedback(w) });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { token?: string; rating?: number; comment?: string } | null;
  const f = cleanFeedback(b);
  if (typeof f === "string") return badRequest(f);
  const w = await who(req, b?.token);
  if (w === "bad-link") return notFound("This link was replaced or turned off.");
  if (!w) return unauthorized();
  // Summary still updated server-side for ops; the Install UI never reads it.
  return json({ ok: true, summary: await saveFeedback(w, f) });
}
