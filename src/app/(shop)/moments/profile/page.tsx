import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileScreen } from "@/features/community";

export const metadata: Metadata = { title: "Profile" };

export default function CommunityProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileScreen />
    </Suspense>
  );
}
