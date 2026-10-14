/** Barbers.ph plans. The shop's plan lives on shops/{shopId}.plan and is only changed by the server. */
export type PlanId = "partner" | "monthly_950" | "lifetime_10000";

export const PLANS: { id: PlanId; title: string; price: string; amountCentavos: number; detail: string }[] = [
  { id: "partner", title: "Partner", price: "Free", amountCentavos: 0, detail: "Online bookings from River Mobile, the queue and community." },
  { id: "monthly_950", title: "Paid", price: "₱950/month", amountCentavos: 95_000, detail: "Everything in Partner, plus walk-ins, the shop QR and sales." },
  { id: "lifetime_10000", title: "Lifetime", price: "₱10,000 one-time", amountCentavos: 1_000_000, detail: "Pay once. Same features as Paid, no monthly renewal." },
];

export const tierForPlan = (plan: string | undefined) => (plan === "monthly_950" || plan === "lifetime_10000" ? "paid" : "partner") as "paid" | "partner";
