import type { Metadata } from "next";
import { ProfitReportScreen } from "@/features/sales";

export const metadata: Metadata = { title: "Profit report" };

export default function ProfitReportPage() {
  return <ProfitReportScreen />;
}
