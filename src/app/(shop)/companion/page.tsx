import type { Metadata } from "next";
import { CompanionScreen } from "@/features/companion/CompanionScreen";

export const metadata: Metadata = { title: "Companion" };

export default function CompanionPage() {
  return <CompanionScreen />;
}
