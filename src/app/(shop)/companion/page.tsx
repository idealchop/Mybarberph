import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanionScreen } from "@/features/companion/CompanionScreen";
import { companionEnabled } from "@/lib/companion-flag";

export const metadata: Metadata = { title: "Companion" };
export const dynamic = "force-dynamic";

export default function CompanionPage() {
  if (!companionEnabled()) notFound();
  return <CompanionScreen />;
}
