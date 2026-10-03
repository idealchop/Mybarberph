import type { Metadata } from "next";
import { PartnerShop } from "@/features/partner/PartnerShop";

export const metadata: Metadata = { title: "Shop" };
export default function Page() { return <PartnerShop />; }
