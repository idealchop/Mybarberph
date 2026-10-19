import type { Metadata } from "next";
import { SalesDataScreen } from "@/features/sales";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage() {
  return <SalesDataScreen />;
}
