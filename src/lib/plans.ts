/**
 * Barbers.ph plans (River Apps standard pricing, approved Oct 14 2026).
 * The shop's plan lives on shops/{shopId}.plan and is only changed by the server (PayMongo webhook).
 * Partner is the entry tier: never label it "free".
 */
export type PlanId = "partner" | "pro_499" | "lifetime_5" | "lifetime_unlimited";

export interface Plan {
  id: PlanId;
  title: string;
  /** Price shown to the owner. */
  price: string;
  /** Former price, shown struck through. */
  wasPrice?: string;
  amountCentavos: number;
  recurring: boolean;
  /** Shops (locations) allowed; Infinity = unlimited. */
  maxLocations: number;
  detail: string;
}

export const PLANS: Plan[] = [
  { id: "partner", title: "Partner", price: "Partner", amountCentavos: 0, recurring: false, maxLocations: 1, detail: "Online bookings from River Mobile, the queue and Moments, for 1 shop. Walk-ins: 10/day." },
  { id: "pro_499", title: "Pro", price: "₱499/month", wasPrice: "₱950", amountCentavos: 49_900, recurring: true, maxLocations: 1, detail: "All features: unlimited walk-ins, the shop QR, chairs and barber links, and sales. 1 shop." },
  { id: "lifetime_5", title: "Lifetime · 1–5 shops", price: "₱10,000 one-time", wasPrice: "₱18,000", amountCentavos: 1_000_000, recurring: false, maxLocations: 5, detail: "All features, paid once. Up to 5 shops." },
  { id: "lifetime_unlimited", title: "Lifetime · 5+ shops", price: "₱20,000 one-time", wasPrice: "₱35,000", amountCentavos: 2_000_000, recurring: false, maxLocations: Infinity, detail: "All features, paid once. Unlimited shops." },
];

/** Older plan ids still on some shop records. */
const LEGACY: Record<string, PlanId> = { monthly_950: "pro_499", lifetime_10000: "lifetime_5" };

export function normalizePlan(plan: string | undefined | null): PlanId {
  const p = (plan && (LEGACY[plan] ?? plan)) as PlanId;
  return PLANS.some((x) => x.id === p) ? p : "partner";
}

export const planInfo = (plan: string | undefined | null): Plan => PLANS.find((p) => p.id === normalizePlan(plan)) as Plan;
export const isRecurring = (plan: string | undefined | null) => planInfo(plan).recurring;
export const maxLocations = (plan: string | undefined | null) => planInfo(plan).maxLocations;
export const tierForPlan = (plan: string | undefined | null) => (normalizePlan(plan) === "partner" ? "partner" : "paid") as "paid" | "partner";

/** Partner shops can seat this many walk-ins per Manila day, per shop. Paid plans: unlimited. */
export const PARTNER_WALKINS_PER_DAY = 10;
export const walkInLimit = (plan: string | undefined | null) => (normalizePlan(plan) === "partner" ? PARTNER_WALKINS_PER_DAY : Infinity);
export const WALKIN_LIMIT_MESSAGE = "You've seated 10 walk-ins today, the Partner limit. Upgrade to Pro or Lifetime for unlimited walk-ins.";

/** The cheapest plan that allows `count` shops. */
export function planForLocations(count: number): Plan {
  return PLANS.find((p) => p.id !== "partner" && p.maxLocations >= count) ?? (PLANS[PLANS.length - 1] as Plan);
}
