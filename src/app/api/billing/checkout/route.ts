import { badRequest, getCaller, json, unauthorized } from "@/lib/server/auth";
import { createPaymongoCheckout, hasPaymongo } from "@/lib/server/paymongo";
import { ensureShop } from "@/lib/server/shops";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";

/** Starts PayMongo checkout. The plan only changes when the paid webhook arrives. */
export async function POST(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = PLANS.find((p) => p.id === body.plan && p.amountCentavos > 0);
  if (!plan) return badRequest("Pick a paid plan.");
  if (!hasPaymongo()) return json({ error: "Online payments are not configured yet (PAYMONGO_SECRET_KEY).", code: "not_configured" }, 503);
  await ensureShop(me.uid);
  const origin = new URL(req.url).origin;
  try {
    const { checkoutUrl } = await createPaymongoCheckout({
      amountCentavos: plan.amountCentavos,
      description: `Barbers.ph ${plan.title} (${plan.price})`,
      successUrl: `${origin}/settings/billing?status=success`,
      cancelUrl: `${origin}/settings/billing?status=cancel`,
      metadata: { shopId: me.uid, plan: plan.id },
    });
    return json({ checkoutUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
