"use client";
import type { ReactNode } from "react";
import { ArrowRight, ChartColumn, LayoutGrid, List, Lock, MessageSquare, MonitorSmartphone, Scissors, Settings, Smartphone, TicketPercent, Users } from "lucide-react";
import { Badge, HeroBanner, IconTile, SampleDataTag, cn } from "@river-apps/ui";
import { BarberChair, BarberIcon } from "@/components/art";
import { Brand } from "@/components/shell/Brand";
import { ClientNav } from "@/components/shell/ClientNav";
import { DemoTierSwitch } from "@/components/shell/DemoTierSwitch";
import { useTier, type Feature } from "@/lib/tier";

const ic = { size: 20, strokeWidth: 1.75 } as const;
const DESKTOP: { feature: Feature; href: string; title: string; body: string; icon: ReactNode }[] = [
  { feature: "dashboard", href: "/dashboard", title: "Dashboard", body: "Growth, AI insights, vouchers", icon: <LayoutGrid {...ic} /> },
  { feature: "queue", href: "/queue", title: "Queue", body: "Live queue, waitlist, River Mobile scan", icon: <List {...ic} /> },
  { feature: "sales", href: "/sales", title: "Sales record", body: "Transactions, tips, CSV export", icon: <ChartColumn {...ic} /> },
  { feature: "customers", href: "/customers", title: "Customers", body: "Personal vs walk-in, history, queue QR", icon: <Users {...ic} /> },
  { feature: "barbers", href: "/barbers", title: "Barbers & chairs", body: "Photos, haircuts, services and prices", icon: <Scissors {...ic} /> },
  { feature: "vouchers", href: "/vouchers", title: "Vouchers & referrals", body: "Codes and the refer-a-friend program", icon: <TicketPercent {...ic} /> },
  { feature: "messages", href: "/messages", title: "Messages", body: "“On queue”, “Thank you” and custom SMS", icon: <MessageSquare {...ic} /> },
  { feature: "settings", href: "/settings", title: "Settings", body: "Shop, River Mobile options, plan", icon: <Settings {...ic} /> },
];

function Tile({ href, title, body, icon, locked }: { href: string; title: string; body: string; icon: ReactNode; locked?: boolean }) {
  return (
    <a href={href} className="group flex items-center gap-3 rounded-card bg-surface p-4 shadow-card transition-shadow hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
      <IconTile size={44} style={{ borderRadius: 14 }} className={cn(locked && "opacity-60")}>{icon}</IconTile>
      <span className="flex min-w-0 flex-1 flex-col leading-tight"><b className="text-[15px]">{title}</b><span className="mt-0.5 line-clamp-2 text-[12.5px] font-semibold text-muted">{body}</span></span>
      {locked ? <Badge variant="soft" className="gap-1"><Lock size={11} strokeWidth={2.4} />Paid</Badge> : <ArrowRight size={18} strokeWidth={1.75} className="text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />}
    </a>
  );
}

/** Demo launcher: every screen, grouped by device, with the tier switch. */
export function Launcher() {
  const { tier, can } = useTier();
  return (
    <ClientNav className="mx-auto min-h-dvh max-w-[1180px] px-5 pb-16 pt-6 sm:px-8">
      <header className="flex items-center justify-between gap-3"><Brand /><span className="flex items-center gap-3"><SampleDataTag /><DemoTierSwitch floating={false} /></span></header>

      <HeroBanner className="mt-6" size="lg" eyebrow="Kanto Kings Barbershop · Marikina" titleSize="lg" contentWidth={560}
        title="Barbers.ph front-end demo"
        description={tier === "paid" ? "You’re previewing the Paid plan: owner desktop, kiosk and partner app. Switch to Partner to see the free tier." : "You’re previewing the free Partner plan: River Mobile verification in the partner app. Paid screens show the upgrade entry point."}
        illustration={<BarberChair size={190} />} illustrationClassName="right-6 -bottom-2 hidden sm:block" />

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between"><h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Owner desktop</h2><span className="text-[13px] font-semibold text-muted">1440 px · sidebar</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{DESKTOP.map((d) => <Tile key={d.href} {...d} locked={!can(d.feature)} />)}</div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-baseline justify-between"><h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Kiosk (POS 2)</h2><span className="text-[13px] font-semibold text-muted">tablet · 1180 × 820</span></div>
          <Tile href="/kiosk" title="Walk-in kiosk" body="Barber → haircut → ticket → in chair → pay → feedback" icon={<MonitorSmartphone {...ic} />} locked={!can("kiosk")} />
        </div>
        <div>
          <div className="mb-3 flex items-baseline justify-between"><h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Partner app</h2><span className="text-[13px] font-semibold text-muted">phone · 390 × 844 · free</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Tile href="/partner" title="Home" body="Incoming customers, verified visits" icon={<Smartphone {...ic} />} />
            <Tile href="/partner/scan" title="Scan to verify" body="Mock camera, Partner API verify" icon={<BarberIcon name="qr" size={28} />} />
          </div>
        </div>
      </section>
      <p className="mt-10 text-center text-[12.5px] font-medium text-muted">All data is sample data held in memory. Refreshing the page resets it.</p>
    </ClientNav>
  );
}
