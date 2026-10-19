import type { Metadata } from "next";
import { ShopsScreen } from "@/features/settings";

export const metadata: Metadata = { title: "Manage Locations" };

export default function ShopsPage() {
  return <ShopsScreen />;
}
