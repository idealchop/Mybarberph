"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { AppShell, Button, MobileTabBar, Sidebar, type NavItem } from "@river-apps/ui";
import { BarberChair } from "@/components/art";
import { useTier } from "@/lib/tier";
import { Brand } from "./Brand";
import { ClientNav } from "./ClientNav";
import { DemoTierSwitch } from "./DemoTierSwitch";
import { HELP_ITEM, SHOP_NAV } from "./nav";

function RiverMobilePromo({ newToday }: { newToday: number }) {
  return (
    <div className="relative rounded-[22px] bg-grey-100 px-4 pb-4 pt-[60px]">
      <div className="absolute inset-x-1 -top-[34px] flex justify-center"><BarberChair size={112} /></div>
      <b className="block text-[14.5px]">River Mobile bookings</b>
      <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">Connected · {newToday} new today</small>
      <Button size="sm" fullWidth href="/partner/incoming">View bookings</Button>
    </div>
  );
}

export interface ShellCounts { queue: number; messages: number; riverNew: number }

/** Paid desktop frame: kit AppShell + Sidebar (lg and up) + MobileTabBar (phones). */
export function ShopShell({ children, counts }: { children: ReactNode; counts: ShellCounts }) {
  const pathname = usePathname();
  const { can } = useTier();
  const active = SHOP_NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"))?.key;

  const items: NavItem[] = SHOP_NAV.map((n) => ({
    key: n.key, label: n.label, href: n.href,
    icon: can(n.key) ? n.icon : (
      <span className="relative inline-flex">{n.icon}<Lock size={11} strokeWidth={2.4} aria-label="Paid feature" className="absolute -bottom-1 -right-1.5 rounded-full bg-surface p-px" /></span>
    ),
    badge: n.badgeKey && can(n.key) ? counts[n.badgeKey] : undefined,
  }));
  const tabs: NavItem[] = SHOP_NAV.filter((n) => ["dashboard", "queue", "sales", "customers", "settings"].includes(n.key))
    .map((n) => ({ key: n.key, label: n.short ?? n.label, href: n.href, icon: n.icon, badge: n.badgeKey && can(n.key) ? counts[n.badgeKey] : undefined }));

  return (
    <ClientNav>
      <AppShell
        sidebar={<Sidebar className="sticky top-0 h-dvh" brand={<Brand />} items={items} activeKey={active}
          footer={<RiverMobilePromo newToday={counts.riverNew} />} secondaryItems={[HELP_ITEM]} />}
        mobileTabBar={<MobileTabBar items={tabs} activeKey={active ?? "dashboard"} />}
        mainClassName="px-4 pt-5 sm:px-[30px] sm:pt-6 lg:pb-6"
      >
        {children}
      </AppShell>
      <DemoTierSwitch />
    </ClientNav>
  );
}
