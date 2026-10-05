import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerRepository } from "@/data/server";
import { Settings } from "@/features/settings/Settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const shop = await (await getServerRepository()).getShop();
  return (
    <Suspense fallback={<div className="py-10 text-[14px] font-semibold text-muted">Loading settings…</div>}>
      <Settings shop={shop} />
    </Suspense>
  );
}
