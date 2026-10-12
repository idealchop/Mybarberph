import type { Metadata } from "next";
import { BillingScreen } from "@/features/settings/BillingScreen";

export const metadata: Metadata = { title: "Plan & billing" };

export default function BillingPage() {
  return <BillingScreen />;
}
