import type { Metadata } from "next";
import { SalesDataScreen } from "@/features/sales/SalesDataScreen";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage() {
  return <SalesDataScreen />;
}
