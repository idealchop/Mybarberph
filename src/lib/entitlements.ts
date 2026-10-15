import { normalizePlan, type PlanId } from "./plans";

/**
 * Plan limits switch. PLAN_LIMITS_ENABLED=1 enforces plan tiers (walk-in cap, QR, shops, Companion questions).
 * Off (default, test phase): every shop gets everything Lifetime has. The shop's real plan, pricing,
 * Plan & billing and PayMongo stay as they are; only the feature gates read this.
 * next.config copies it to NEXT_PUBLIC_PLAN_LIMITS_ENABLED for the browser.
 */
export const planLimitsEnabled = () => (process.env.PLAN_LIMITS_ENABLED ?? process.env.NEXT_PUBLIC_PLAN_LIMITS_ENABLED) === "1";

/** The plan whose features a shop gets. Use for gates, never for billing. */
export const entitledPlan = (plan: string | undefined | null): PlanId => (planLimitsEnabled() ? normalizePlan(plan) : "lifetime_unlimited");
