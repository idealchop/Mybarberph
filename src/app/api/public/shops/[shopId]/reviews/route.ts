import { badRequest, json, notFound } from "@/lib/server/auth";
import { logActivity } from "@/lib/server/activity";
import { cleanReview, listReviews, saveProfileReview } from "@/lib/server/reviews";

export const dynamic = "force-dynamic";

/** Public: the shop's star summary and latest reviews. */
export async function GET(_req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const r = await listReviews((await params).shopId);
  return r ? json(r) : notFound("Shop not found");
}

/** Public: leave (or replace) this device's review on the shop profile. */
export async function POST(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const shopId = (await params).shopId;
  const c = cleanReview(await req.json().catch(() => null));
  if (typeof c === "string") return badRequest(c);
  try { await saveProfileReview(shopId, c); } catch (e) { return badRequest((e as Error).message); }
  await logActivity(shopId, { type: "review", actor: { name: c.name || "Customer", role: "customer" }, text: `${c.name || "A customer"} left a review ${"★".repeat(c.rating)}${c.comment ? ` · “${c.comment.slice(0, 80)}”` : ""}` }, true);
  return json({ ok: true, ...(await listReviews(shopId)) });
}
