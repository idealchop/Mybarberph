import type { Metadata } from "next";
import { getRepository } from "@/data";
import { Settings } from "@/features/settings/Settings";

export const metadata: Metadata = { title: "Settings" };

/** Settings is available on both tiers (Partner sees River Mobile options; Paid-only sections are locked). */
export default async function SettingsPage() {
  const shop = await getRepository().getShop();
  return <Settings shop={shop} />;
}
