"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, Sidebar } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { AuthGateProvider } from "@/components/auth/AuthGateProvider";
import { BarberChair } from "@/components/art";
import { useQueueRequests } from "@/lib/chair-bookings";
import { useTier } from "@/lib/tier";
import { Brand } from "./Brand";
import { ClientNav } from "./ClientNav";
import { activeKeyFor, appNav } from "./nav";
import { ShopTabBar } from "./ShopTabBar";

function ShopQrPromo() {
  return (
    <div className="relative rounded-card bg-grey-100 px-4 pb-4 pt-[78px]">
      <div className="absolute inset-x-0 -top-9 flex justify-center"><BarberChair size={150} /></div>
      <b className="block text-[14.5px]">Shop QR code</b>
      <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">Customers scan to book</small>
      <Button size="sm" fullWidth href="/qr">Get QR code</Button>
    </div>
  );
}

function PartnerPlanCard() {
  return (
    <div className="rounded-card bg-grey-100 p-4">
      <b className="block text-[14.5px]">You’re on Partner</b>
      <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">
        Paid adds walk-ins and the shop QR.
      </small>
      <Button size="sm" variant="secondary" fullWidth href="/settings">See plans</Button>
    </div>
  );
}

const FOCUS = ["/queue/new", "/settings/edit", "/companion"];

/** Home, Queue, and Moments. Paid shops get the QR card. Account is the avatar on Home. */
export function ShopShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { tier } = useTier();
  const paid = tier === "paid";
  const waiting = useQueueRequests().rows.filter((r) => r.channel === "online" && r.status === "requested").length;
  const focus = FOCUS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const active = activeKeyFor(pathname);
  const items = appNav(active, 26).map((item) => item.key === "queue" && waiting > 0 ? { ...item, badge: waiting } : item);
  const tabs = appNav(active, 32).map((item) => item.key === "queue" && waiting > 0 ? { ...item, badge: waiting } : item);


  return (
    <AuthGateProvider>
    <ClientNav>
      <AppShell
        sidebar={
          <Sidebar
            className="sticky top-0 h-dvh"
            brand={<Link href="/home" aria-label="Barbers.ph home"><Brand /></Link>}
            items={items}
            activeKey={active}
            footer={paid ? <ShopQrPromo /> : <PartnerPlanCard />}
          />
        }
        mobileTabBar={focus ? undefined : <ShopTabBar items={tabs} activeKey={active ?? ""} />}
        mainClassName={focus ? "pb-0" : undefined}
      >
        {children}
      </AppShell>
    </ClientNav>
    </AuthGateProvider>
  );
}
