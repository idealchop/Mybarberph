"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, House, Smartphone, Store } from "lucide-react";
import { MobileTabBar, SampleDataTag, type NavItem } from "@river-apps/ui";
import { ClientNav } from "@/components/shell/ClientNav";
import { DemoTierSwitch } from "@/components/shell/DemoTierSwitch";
import type { Barber, IncomingBooking, PartnerNotification, Shop, VerifiedVisit } from "@/data";

interface PartnerState {
  incoming: IncomingBooking[]; visits: VerifiedVisit[]; notifications: PartnerNotification[]; barbers: Barber[]; shop: Shop;
}
interface PartnerCtx extends PartnerState {
  setBookingStatus: (id: string, status: IncomingBooking["status"]) => void;
  addVisit: (b: IncomingBooking) => void;
  markAllRead: () => void;
}
const Ctx = createContext<PartnerCtx | null>(null);
export function usePartner() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePartner must be used inside <PartnerShell>");
  return v;
}

const ic = { size: 22, strokeWidth: 1.75 } as const;

/** Demo-only device chrome (same as the kit demo PhoneFrame): status bar with 9:41 and a home indicator. */
function StatusBar() {
  return (
    <div className="relative z-50 flex h-[50px] flex-none items-center justify-between pl-9 pr-[26px] pt-1">
      <span className="w-[60px] text-[16px] font-bold">9:41</span>
      <SampleDataTag />
      <span className="flex items-center gap-1.5 text-ink" aria-hidden>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.2-1.3A10.2 10.2 0 0 0 8 .8 10.2 10.2 0 0 0 .8 3.7L2 5c1.6-1.5 3.7-2.4 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.3-1.3A6.6 6.6 0 0 0 8 4.4c-1.8 0-3.4.7-4.7 1.8l1.3 1.3c.9-.8 2.1-1.3 3.4-1.3zM8 9.6l2-2a2.9 2.9 0 0 0-4 0z" /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="currentColor"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".35" /><rect x="2" y="2" width="20" height="9" rx="2" /><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" opacity=".4" /></svg>
      </span>
    </div>
  );
}

/** Phone layout: full screen on phones; a centred 390×844 device on wider screens. */
export function PartnerShell({ initial, children }: { initial: PartnerState; children: ReactNode }) {
  const [state, setState] = useState(initial);
  const pathname = usePathname();
  const unread = state.notifications.filter((n) => n.unread).length;
  const active = pathname.startsWith("/partner/incoming") ? "incoming" : pathname.startsWith("/partner/history") ? "history" : pathname.startsWith("/partner/shop") ? "shop" : "home";
  const tabs: NavItem[] = [
    { key: "home", label: "Home", href: "/partner", icon: <House {...ic} /> },
    { key: "incoming", label: "Incoming", href: "/partner/incoming", icon: <Smartphone {...ic} />, badge: unread || undefined },
    { key: "history", label: "History", href: "/partner/history", icon: <History {...ic} /> },
    { key: "shop", label: "Shop", href: "/partner/shop", icon: <Store {...ic} /> },
  ];
  const ctx: PartnerCtx = {
    ...state,
    setBookingStatus: (id, status) => setState((s) => ({ ...s, incoming: s.incoming.map((b) => b.id === id ? { ...b, status } : b) })),
    addVisit: (b) => setState((s) => s.visits.some((v) => v.referenceId === b.referenceId) ? s : {
      ...s,
      incoming: s.incoming.map((x) => x.id === b.id ? { ...x, status: "verified" } : x),
      visits: [{ id: `vv-${b.id}`, customerName: b.customerName, referenceId: b.referenceId, serviceLabel: b.serviceLabel, barberName: s.barbers.find((x) => x.id === b.barberId)?.nickname, at: "2026-10-04T18:40:00+08:00", atLabel: "Today 6:40 PM", status: "verified" }, ...s.visits],
      notifications: [{ id: `n-${b.id}`, title: "Visit verified", body: `${b.customerName} · ${b.serviceLabel}`, atLabel: "Just now", unread: false }, ...s.notifications],
    }),
    markAllRead: () => setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, unread: false })) })),
  };

  return (
    <Ctx.Provider value={ctx}>
      <ClientNav className="min-h-dvh bg-[#E7E7EC] sm:flex sm:flex-col sm:items-center sm:justify-center sm:py-8">
        <div className="relative mx-auto flex h-dvh w-full flex-col overflow-hidden bg-canvas sm:h-[844px] sm:w-[390px] sm:rounded-[48px] sm:shadow-[0_40px_80px_-30px_rgba(16,16,24,.45),0_0_0_10px_#0A0A0A]">
          <StatusBar />
          <main className="relative flex-1 overflow-y-auto overscroll-contain pb-[120px] [scrollbar-width:none]">{children}</main>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[120px] bg-gradient-to-b from-canvas/0 to-canvas to-70%" />
          <MobileTabBar items={tabs} activeKey={active} position="absolute" label="Partner app" />
          <div aria-hidden className="absolute bottom-2 left-1/2 z-50 h-[5px] w-[134px] -translate-x-1/2 rounded-[3px] bg-ink" />
        </div>
        <p className="mt-5 hidden text-center text-[12.5px] font-semibold text-muted sm:block">Barbers.ph Partner app · phone preview · <Link href="/dashboard" className="font-bold text-ink underline decoration-grey-300 underline-offset-[3px]">Owner dashboard</Link> · <Link href="/demo" className="font-bold text-ink underline decoration-grey-300 underline-offset-[3px]">Demo screens</Link></p>
      </ClientNav>
      <DemoTierSwitch />
    </Ctx.Provider>
  );
}
