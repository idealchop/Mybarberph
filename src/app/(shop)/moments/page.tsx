import type { Metadata } from "next";
import { CommunityScreen } from "@/features/community";

export const metadata: Metadata = { title: "Moments" };

export default function CommunityPage() {
  return <CommunityScreen />;
}
