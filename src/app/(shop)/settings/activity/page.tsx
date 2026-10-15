import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityScreen } from "@/features/activity/ActivityScreen";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return <Suspense fallback={null}><ActivityScreen /></Suspense>;
}
