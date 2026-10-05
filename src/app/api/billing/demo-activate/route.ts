import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/firebase/session";
import { adminDb } from "@/lib/firebase/admin";
import { FirestoreBarbersRepository } from "@/data/firebase/repository";
import { tierForPlan } from "@/lib/billing";
import type { BillingPlan } from "@/data";

export const runtime = "nodejs";

/**
 * Dev/demo: activate a selected plan without PayMongo (seed upgrade path).
 * Also used after ?billing=success when webhooks are not wired yet.
 */
export async function POST(req: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { billingPlan?: BillingPlan };
    const plan = body.billingPlan ?? "monthly_950";
    if (plan !== "partner" && plan !== "monthly_950" && plan !== "lifetime_10000") {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }
    const repo = new FirestoreBarbersRepository(adminDb(), ctx.shopId);
    const shop = await repo.updateShopBilling({ billingPlan: plan, billingStatus: "active" });
    return NextResponse.json({ ok: true, shop, tier: tierForPlan(plan) });
  } catch (err) {
    console.error("billing/demo-activate", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Activate failed" }, { status: 500 });
  }
}
