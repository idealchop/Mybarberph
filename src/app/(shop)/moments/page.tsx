import type { Metadata } from "next";
import { CommunityScreen } from "@/features/community/CommunityScreen";

export const metadata: Metadata = { title: "Moments" };

export default function CommunityPage() {
  return <CommunityScreen />;
}
