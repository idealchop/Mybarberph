import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/firebase/session";
import { adminDb } from "@/lib/firebase/admin";
import { FirestoreBarbersRepository } from "@/data/firebase/repository";
import { PLANS, tierForPlan } from "@/lib/billing";
import { createPaymongoCheckout, hasPaymongo } from "@/lib/paymongo";
import type { BillingPlan } from "@/data";

export const runtime = "nodejs";

/**
 * Start checkout for monthly_950 or lifetime_10000.
 * With PayMongo keys → hosted checkout URL.
 * Without → marks billingStatus pending and returns { mode: "pending" } so UI can demo-activate.
 */
export async function POST(req: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { billingPlan?: BillingPlan };
    const planId = body.billingPlan;
    if (!planId || planId === "partner") {
      return NextResponse.json({ error: "Pick a paid plan." }, { status: 400 });
    }
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan || plan.priceCentavos == null) {
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }

    const repo = new FirestoreBarbersRepository(adminDb(), ctx.shopId);
    const origin = new URL(req.url).origin;

    if (!hasPaymongo()) {
      await repo.updateShopBilling({ billingPlan: planId, billingStatus: "pending" });
      return NextResponse.json({
        mode: "pending",
        message: "PayMongo is not connected yet. Plan is pending — use Demo activate, or set PAYMONGO_SECRET_KEY.",
        billingPlan: planId,
        tier: tierForPlan(planId),
      });
    }

    await repo.updateShopBilling({ billingPlan: planId, billingStatus: "pending" });
    const { checkoutUrl, sessionId } = await createPaymongoCheckout({
      amountCentavos: plan.priceCentavos,
      description: `Barbers.ph · ${plan.label} (${plan.priceLabel})`,
      successUrl: `${origin}/settings?billing=success&plan=${planId}`,
      cancelUrl: `${origin}/settings?billing=cancel`,
      metadata: { shopId: ctx.shopId, billingPlan: planId, uid: ctx.uid },
    });

    return NextResponse.json({ mode: "paymongo", checkoutUrl, sessionId, billingPlan: planId });
  } catch (err) {
    console.error("billing/checkout", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 500 });
  }
}
