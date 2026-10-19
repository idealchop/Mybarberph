import type { Metadata } from "next";
import { WalkInScreen } from "@/features/walkin";

export const metadata: Metadata = { title: "Walk-in" };

export default function WalkInPage() {
  return <WalkInScreen />;
}
