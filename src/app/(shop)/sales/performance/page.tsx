import type { Metadata } from "next";
import { PerformanceScreen } from "@/features/performance/PerformanceScreen";

export const metadata: Metadata = { title: "Chair performance" };

export default function PerformancePage() {
  return <PerformanceScreen />;
}
