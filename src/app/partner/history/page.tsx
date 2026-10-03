import type { Metadata } from "next";
import { PartnerHistory } from "@/features/partner/PartnerHistory";

export const metadata: Metadata = { title: "History" };
export default function Page() { return <PartnerHistory />; }
