import type { Metadata } from "next";
import { InstallScreen } from "@/features/settings";

export const metadata: Metadata = { title: "Install app" };

export default function InstallAppPage() {
  return <InstallScreen />;
}
