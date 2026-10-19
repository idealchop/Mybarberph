import type { Metadata } from "next";
import { AccountScreen } from "@/features/settings";

export const metadata: Metadata = { title: "Account" };

export default function AccountSettingsPage() {
  return <AccountScreen />;
}
