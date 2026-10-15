import type { Metadata } from "next";
import { SeatsScreen } from "@/features/queue/SeatsScreen";

export const metadata: Metadata = { title: "My Barbers" };

export default function SeatsPage() {
  return <SeatsScreen />;
}
