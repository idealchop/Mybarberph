import type { Metadata } from "next";
import { CommunityScreen } from "@/features/community/CommunityScreen";

export const metadata: Metadata = { title: "Community" };

export default function CommunityPage() {
  return <CommunityScreen />;
}
