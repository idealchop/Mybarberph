import type { BillingPlan, Tier } from "@/data";

export type PlanDef = {
  id: BillingPlan;
  label: string;
  priceLabel: string;
  priceCentavos: number | null;
  interval: "free" | "month" | "lifetime";
  description: string;
  features: string[];
};

export const PLANS: PlanDef[] = [
  {
    id: "partner",
    label: "Partner",
    priceLabel: "Free",
    priceCentavos: null,
    interval: "free",
    description: "Receive and verify River Mobile customers on your phone.",
    features: [
      "River Mobile bookings & queue tickets",
      "Scan to verify",
      "Verified visit history",
      "Owner notifications",
    ],
  },
  {
    id: "monthly_950",
    label: "Full shop",
    priceLabel: "₱950 / month",
    priceCentavos: 95_000,
    interval: "month",
    description: "Everything unlocked — queue, kiosk, sales, CRM, SMS, dashboard.",
    features: [
      "Everything in Partner",
      "Walk-in queue & waitlist",
      "Kiosk (POS 2) with payments & tips",
      "Sales record",
      "Customers, vouchers & SMS",
      "Growth dashboard",
    ],
  },
  {
    id: "lifetime_10000",
    label: "Lifetime",
    priceLabel: "₱10,000 once",
    priceCentavos: 1_000_000,
    interval: "lifetime",
    description: "One payment. All features forever for this shop.",
    features: [
      "Everything in Full shop",
      "No monthly renewal",
      "Same Paid feature set",
    ],
  },
];

export function tierForPlan(plan: BillingPlan): Tier {
  return plan === "partner" ? "partner" : "paid";
}

export function planLabel(plan: BillingPlan | undefined): string {
  return PLANS.find((p) => p.id === plan)?.label ?? "Partner";
}
