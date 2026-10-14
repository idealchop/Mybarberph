import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingScreen } from "@/features/settings/BillingScreen";

export const metadata: Metadata = { title: "Plan & billing" };

export default function BillingPage() {
  return <Suspense fallback={null}><BillingScreen /></Suspense>;
}
