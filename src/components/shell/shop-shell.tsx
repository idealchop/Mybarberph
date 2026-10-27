"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Sidebar } from "@river-apps/ui";
import { APP_SCROLL_ID } from "@/lib/app-scroll";
import { Button } from "@/components/common/button";
import { AuthGateProvider } from "@/components/auth/auth-gate-provider";
import { BarberChair } from "@/components/art";
import { onlineOpenToday, useQueueRequests } from "@/lib/chair-bookings";
import { useTier } from "@/lib/tier";
import { Brand } from "./brand";
import { ClientNav } from "./client-nav";
import { activeKeyFor, appNav } from "./nav";
import { ShopTabBar } from "./shop-tab-bar";

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
  const waiting = onlineOpenToday(useQueueRequests().rows).length;
  const focus = FOCUS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const active = activeKeyFor(pathname);
  const items = appNav(active, 26).map((item) => item.key === "queue" && waiting > 0 ? { ...item, badge: waiting } : item);
  const tabs = appNav(active, 32).map((item) => item.key === "queue" && waiting > 0 ? { ...item, badge: waiting } : item);


  return (
    <AuthGateProvider>
    <ClientNav>
      {focus ? (
        // Full-screen flows (no tab bar) keep normal page scrolling.
        <div className="flex min-h-dvh bg-canvas text-ink">
          <div className="hidden lg:flex"><Sidebar className="sticky top-0 h-dvh" brand={<Link href="/home" aria-label="Barbers.ph home"><Brand /></Link>} items={items} activeKey={active} footer={paid ? <ShopQrPromo /> : <PartnerPlanCard />} /></div>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      ) : (
        // v1.0.18 app shell: exactly the visible viewport. The content is the ONLY scroller; the tab bar is a plain
        // flex child under it (no position:fixed, no JS offsets), so iOS can't leave it floating mid-screen.
        <div className="app-shell flex bg-canvas text-ink">
          <div className="hidden lg:flex"><Sidebar className="h-full overflow-y-auto" brand={<Link href="/home" aria-label="Barbers.ph home"><Brand /></Link>} items={items} activeKey={active} footer={paid ? <ShopQrPromo /> : <PartnerPlanCard />} /></div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <AppScroller pathname={pathname}>{children}</AppScroller>
            <ShopTabBar items={tabs} activeKey={active ?? ""} />
          </div>
        </div>
      )}
    </ClientNav>
    </AuthGateProvider>
  );
}

/** The one scroll container. New page: top; back/forward: where you were. */
function AppScroller({ pathname, children }: { pathname: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const saved = useRef(new Map<string, number>());
  const back = useRef(false);
  const last = useRef(pathname);
  useEffect(() => {
    const pop = () => { back.current = true; };
    window.addEventListener("popstate", pop);
    // Fallback height for browsers without dvh: the real visible height.
    const setH = () => document.documentElement.style.setProperty("--app-h", `${window.innerHeight}px`);
    setH();
    window.addEventListener("resize", setH);
    return () => { window.removeEventListener("popstate", pop); window.removeEventListener("resize", setH); };
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || last.current === pathname) return;
    saved.current.set(last.current, el.scrollTop);
    last.current = pathname;
    el.scrollTop = back.current ? saved.current.get(pathname) ?? 0 : 0;
    back.current = false;
  }, [pathname]);
  return (
    <main id={APP_SCROLL_ID} ref={ref} className="app-scroll min-h-0 min-w-0 flex-1 pb-6 lg:pb-0">
      {children}
    </main>
  );
}
