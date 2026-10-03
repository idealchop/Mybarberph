import type { Metadata } from "next";
import { PartnerIncoming } from "@/features/partner/PartnerIncoming";

export const metadata: Metadata = { title: "Incoming" };
export default function Page() { return <PartnerIncoming />; }
