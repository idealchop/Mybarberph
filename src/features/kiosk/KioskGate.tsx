"use client";
import type { ReactNode } from "react";
import { Gate } from "@/components/common/LockedFeature";
import { ClientNav } from "@/components/shell/ClientNav";
import { DemoTierSwitch } from "@/components/shell/DemoTierSwitch";
import { useTier } from "@/lib/tier";

/** The kiosk is a Paid feature; on Partner it shows the single upgrade entry point. */
export function KioskGate({ children }: { children: ReactNode }) {
  const { can } = useTier();
  if (can("kiosk")) return <ClientNav>{children}</ClientNav>;
  return <ClientNav className="px-6"><Gate feature="kiosk">{children}</Gate><DemoTierSwitch /></ClientNav>;
}
