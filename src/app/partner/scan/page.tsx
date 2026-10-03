import type { Metadata } from "next";
import { PartnerScan } from "@/features/partner/PartnerScan";

export const metadata: Metadata = { title: "Scan to verify" };
export default function Page() { return <PartnerScan />; }
