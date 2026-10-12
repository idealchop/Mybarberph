import type { Metadata } from "next";
import { ServicesScreen } from "@/features/settings/ServicesScreen";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return <ServicesScreen />;
}
