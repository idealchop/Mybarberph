import { badRequest, getCaller, json, notFound, unauthorized } from "@/lib/server/auth";
import { cleanFeedback, feedbackSummary, myFeedback, saveFeedback, type FeedbackWho } from "@/lib/server/feedback";
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

export async function GET(req: Request) {
  const w = await who(req, new URL(req.url).searchParams.get("token"));
  const summary = await feedbackSummary();
  return json({ summary, mine: w && w !== "bad-link" ? await myFeedback(w) : null });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { token?: string; rating?: number; comment?: string } | null;
  const f = cleanFeedback(b);
  if (typeof f === "string") return badRequest(f);
  const w = await who(req, b?.token);
  if (w === "bad-link") return notFound("This link was replaced or turned off.");
  if (!w) return unauthorized();
  return json({ ok: true, summary: await saveFeedback(w, f) });
}
