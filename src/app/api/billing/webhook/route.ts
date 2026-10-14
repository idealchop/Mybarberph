import { createHmac, timingSafeEqual } from "node:crypto";
import { json } from "@/lib/server/auth";
import { PLANS } from "@/lib/plans";
import { shopRef } from "@/lib/server/shops";

export const runtime = "nodejs";

/** PayMongo webhook (checkout_session.payment.paid). Signed with PAYMONGO_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const secret = (process.env.PAYMONGO_WEBHOOK_SECRET || "").trim();
  if (!secret) return json({ error: "Webhook not configured" }, 503);
  const raw = await req.text();
  const header = req.headers.get("paymongo-signature") || "";
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const expected = createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  const given = parts.li || parts.te || "";
  const ok = given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return json({ error: "Bad signature" }, 401);
  const event = JSON.parse(raw) as { data?: { attributes?: { type?: string; data?: { attributes?: { metadata?: Record<string, string> } } } } };
  const type = event.data?.attributes?.type;
  const meta = event.data?.attributes?.data?.attributes?.metadata ?? {};
  const plan = PLANS.find((p) => p.id === meta.plan && p.amountCentavos > 0);
  if (type === "checkout_session.payment.paid" && meta.shopId && plan) {
    const renews = plan.recurring ? Date.now() + 31 * 86_400_000 : null;
    await shopRef(meta.shopId).set({ plan: plan.id, planStatus: "active", planRenewsAt: renews, updatedAt: Date.now() }, { merge: true });
  }
  return json({ ok: true });
}
