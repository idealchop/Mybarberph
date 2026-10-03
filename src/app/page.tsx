import type { Metadata } from "next";
import { Launcher } from "@/features/launcher/Launcher";

export const metadata: Metadata = { title: "Barbers.ph demo" };

export default function Home() {
  return <Launcher />;
}
