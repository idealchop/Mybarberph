import type { Metadata } from "next";
import { WalkInScreen } from "@/features/walkin/WalkInScreen";

export const metadata: Metadata = { title: "Walk-in" };

export default function WalkInPage() {
  return <WalkInScreen />;
}
