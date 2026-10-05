"use client";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button, EmptyState } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";
import { useTier, type Feature } from "@/lib/tier";

const NAMES: Record<Feature, string> = {
  dashboard: "The growth dashboard", queue: "The walk-in queue", sales: "The sales record", customers: "The customers CRM",
  barbers: "Barbers & chairs setup", vouchers: "Vouchers & referrals", messages: "Message automations", kiosk: "The kiosk (POS 2)",
  settings: "Settings", partner_app: "The partner app",
};

/** Renders children on Paid; on Partner (free) shows the single "Upgrade to Paid" entry point (plan §3.4). */
export function Gate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { can } = useTier();
  if (can(feature)) return <>{children}</>;
  return (
    <div className="flex min-h-[70dvh] items-center justify-center py-10">
      <EmptyState
        className="max-w-[460px]"
        illustration={<span className="relative"><BarberIcon name="pole" size={84} /><span className="absolute -bottom-1 -right-2 inline-flex size-8 items-center justify-center rounded-full bg-ink text-on-ink"><Lock size={15} strokeWidth={2.2} /></span></span>}
        title={`${NAMES[feature]} is on Paid`}
        description="Your shop is on the free Partner plan: River Mobile customers, Scan to verify, verified visits and notifications. Upgrade unlocks queue, sales, kiosk, CRM and more. Billing will run through River Apps."
        action={<div className="flex flex-wrap justify-center gap-2.5">
          <Button size="md" href="/settings">Upgrade in Settings</Button>
          <Button size="md" variant="secondary" href="/partner">Open partner app</Button>
        </div>}
      />
    </div>
  );
}
