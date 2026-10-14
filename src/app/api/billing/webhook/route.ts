import { createHmac, timingSafeEqual } from "node:crypto";
import { json } from "@/lib/server/auth";
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
  if (type === "checkout_session.payment.paid" && meta.shopId && (meta.plan === "monthly_950" || meta.plan === "lifetime_10000")) {
    const renews = meta.plan === "monthly_950" ? Date.now() + 31 * 86_400_000 : null;
    await shopRef(meta.shopId).set({ plan: meta.plan, planStatus: "active", planRenewsAt: renews, updatedAt: Date.now() }, { merge: true });
  }
  return json({ ok: true });
}
