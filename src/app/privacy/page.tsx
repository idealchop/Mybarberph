import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Barbers.ph by River Apps collects, uses and protects shop owner, barber and customer information.",
};
export default function PrivacyPage() { return <LegalPage doc={PRIVACY} />; }
