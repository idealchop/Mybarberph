import type { Metadata } from "next";
import { Launcher } from "@/features/launcher/Launcher";

export const metadata: Metadata = { title: "Demo screens" };

export default function DemoPage() {
  return <Launcher />;
}
