"use client";
import { HomeSkeleton } from "@/components/common/Skeleton";
import { Sk } from "@/components/common/Skeleton";
import { useRemit } from "@/features/sales/useRemit";
import { EmptyBookings } from "@/components/common/EmptyBookings";

import { CoinIcon } from "@river-apps/icons";
import { ChevronDown, Loader2, Plus, ScanLine } from "lucide-react";
import { Badge, Card, CardHeader, HeroBanner, ProgressRing, SectionHeader, StatCard } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { useSession } from "@/lib/session";
import { peso } from "@/lib/format";
import { salesReport } from "@/lib/sales-report";
import { SalesChartCard } from "@/features/sales/SalesChart";
import { elapsedLabel, markInChair, setRequestStatus, todayFigures, useScopedRequests, type ChairRequest } from "@/lib/chair-bookings";
import { ALL_LOCATIONS, branchName, HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useGreeting, useShopProfile } from "@/lib/shop-profile";
import { useTier } from "@/lib/tier";
import { CompanionCard } from "@/features/companion/CompanionCard";

const linkCls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]";
const PILL = "relative h-8 gap-1 rounded-pill px-2.5 text-[12px] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']";


function BookingCard({ row, place }: { row: ChairRequest; place?: string }) {
  const who = row.customerLabel || row.contact || "Customer";
  const [note, setNote] = useState("");
  return (
    <article className="min-w-0 rounded-card bg-surface px-3.5 pb-3.5 pt-3 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="block truncate text-[15.5px]">{who}</b>
          <p className="mt-0.5 truncate text-[13px] font-medium text-muted">{row.serviceName} · {row.slotLabel}{place ? ` · ${place}` : ""}</p>
        </div>
        <span className="inline-flex h-[22px] items-center rounded-pill bg-ink px-2 text-[11.5px] font-bold text-on-ink">New</span>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-muted">{row.price ? `${row.ref} · ${peso(row.price)}` : row.ref}</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" data-auth="action" onClick={() => setRequestStatus(row.id, "declined")}>Decline</Button>
        <Button data-auth="action" size="sm" className="flex-1" onClick={() => {
          const chair = markInChair(row.id);
          setNote(chair ? "" : "Every barber is busy, or none have been added in Services yet.");
        }}>Accept</Button>
      </div>
      {note ? <p className="mt-2 text-[13px] font-semibold">{note}</p> : null}
    </article>
  );
}

function Bookings({ rows, loading, max, placeFor, locationId }: { rows: ChairRequest[]; loading: boolean; max: number; placeFor?: (row: ChairRequest) => string; locationId?: string }) {
  const shown = rows.slice(0, max);
  const more = rows.length - shown.length;
  if (loading) return <p className="rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">Loading bookings…</p>;
  return (
    <div className="flex flex-col gap-3">
      {shown.length === 0 ? (
        <EmptyBookings locationId={locationId} />
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((row) => <BookingCard key={row.id} row={row} place={placeFor?.(row)} />)}
        </div>
      )}
      {more > 0 ? <Link href="/queue?channel=online" className={`${linkCls} self-center py-2`}>See {more} more</Link> : null}
    </div>
  );
}

/** Home matches Laundry.ph: greeting, today hero, three stats, bookings to accept. */
export function HomeScreen() {
  const { tier } = useTier();
  const paid = tier === "paid";
  const greeting = useGreeting();
  const { profile } = useShopProfile();
  const shops = useShopLocations();
  const { rows, ready } = useScopedRequests();
  const figures = todayFigures(rows);
  const todayTitle = shops.viewingAll ? `All shops: ${peso(figures.sales)}` : `Today: ${peso(figures.sales)}`;
  const placeFor = shops.viewingAll ? (row: ChairRequest) => branchName(shops.branches, row.locationId) : undefined;
  const byShop = shops.branches.map((branch) => {
    const mine = rows.filter((row) => (row.locationId || HOME_LOCATION_ID) === branch.id);
    const fig = todayFigures(mine);
    return { branch, sales: fig.sales, cuts: fig.cuts, inChair: mine.filter((row) => row.status === "in_chair").length };
  });
  const fresh = rows.filter((row) => row.channel === "online" && row.status === "requested");
  const toAccept = rows.filter((row) => row.status === "requested" || row.status === "accepted").length;
  const busy = rows.filter((row) => row.status === "in_chair").length;
  const oldest = rows.filter((row) => row.status === "in_chair" && row.startedAt).reduce((m, row) => Math.min(m, row.startedAt!), Infinity);
  const now = useTick(busy > 0);
  const today0 = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) + "T00:00:00+08:00").getTime();
  const todays = rows.filter((row) => row.createdAt >= today0 && row.status !== "declined");
  const customers = todays.length;
  const online = todays.filter((row) => row.channel === "online").length;
  const remit = useRemit(shops.viewingAll || !shops.enabled ? "all" : shops.scopeId ?? "all");
  const toClaim = remit.data?.total ?? 0;
  const unpaid = rows.filter((row) => !row.paid && row.status !== "declined").reduce((sum, row) => sum + row.price, 0);
  const todaySales = salesReport(rows, unpaid, "today");
  const aside = !ready ? "" : fresh.length ? `${fresh.length} new` : "Live";
  const { user } = useSession();
  const { requireAuth } = useAuthGate();
  const shopName = profile.name || (user ? "your shop" : "Barbers.ph");
  const needsSetup = Boolean(user) && ready && !profile.name;
  const dayLabel = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" });
  const dayTotal = figures.cuts + toAccept;
  const pct = dayTotal ? Math.round((figures.cuts / dayTotal) * 100) : 0;

  const brand = (
                <div className="flex min-h-11 min-w-0 items-center gap-2 py-1 pl-1 pr-1.5">
                  <Link href="/settings" aria-label="My Account" className="flex-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={profile.logoUrl || "/icons3d/house.png"} alt="" width={36} height={36} className={`size-9 rounded-[11px] ${profile.logoUrl ? "object-cover ring-1 ring-line" : "bg-grey-50 object-contain p-0.5"}`} />
                  </Link>
                  <span className="flex min-w-0 flex-col leading-[1.2]">
                    <Link href="/settings" className="max-w-[170px] truncate text-[14px] font-extrabold tracking-[-0.01em]">{shopName}</Link>
                    {shops.enabled && shops.branches.length > 1 ? (
                      <label className="relative inline-flex max-w-[170px] items-center gap-0.5 text-[11.5px] font-semibold text-muted">
                        <span className="truncate">{shops.viewingAll ? "All locations" : shops.branch?.name ?? "Main"}</span>
                        {remit.loading ? <Loader2 size={12} strokeWidth={2.4} className="flex-none animate-spin" aria-label="Loading" /> : <ChevronDown size={13} strokeWidth={2.2} className="flex-none" aria-hidden />}
                        <select aria-label="Switch location" value={shops.viewId} onChange={(e) => shops.setView(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
                          {shops.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                          <option value={ALL_LOCATIONS}>All locations</option>
                        </select>
                      </label>
                    ) : <span className="max-w-[170px] truncate text-[11.5px] font-semibold text-muted">{profile.area || profile.address.split(",")[0] || "Your shop"}</span>}
                  </span>
                </div>
  );
  if (!ready) return <HomeSkeleton />;
  return (
    <>
      <div className="mx-auto w-full max-w-[402px] pb-4 lg:hidden">
        <header className="px-4 pt-1">
          <div className="flex h-16 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center">
              {user ? (
                brand
              ) : (
                <button type="button" onClick={() => requireAuth()} className="flex min-h-11 items-center gap-2 rounded-[14px] py-1 pl-1 pr-1.5 text-left">
                  <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-grey-100 text-[15px] font-bold">?</span>
                  <span className="flex min-w-0 flex-col leading-[1.2]">
                    <span className="text-[13px] font-bold">Sign in</span>
                    <span className="text-[11px] font-medium text-muted">Save your shop</span>
                  </span>
                </button>
              )}
            </div>
            <Link href="/sales" aria-label="Sales" className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full border border-line py-1 pl-1 pr-3">
              <CoinIcon size={26} />
              <span className="text-[13px] font-bold leading-none text-ink">Sales</span>
            </Link>
          </div>
        </header>
        <section className={`relative isolate mx-4 mt-3 flex h-[150px] items-center overflow-hidden rounded-banner px-4 text-on-ink ${busy ? "live-hero" : "bg-ink"}`}>
          <div className="relative z-10 min-w-0 flex-1">
            <p className="truncate text-[12px] leading-4">
              <span className="font-medium text-on-ink-muted">{greeting}, </span>
              <span className="font-semibold text-on-ink/90">{shopName}</span>
            </p>
            <h2 className="mt-1 text-[18px] font-extrabold leading-[1.15] tracking-[-0.025em]">
              {todayTitle}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-medium text-on-ink-muted">{busy ? <span className="live-dot" aria-hidden /> : null}<span>{figures.cuts} cuts · {busy ? `${busy} barber${busy === 1 ? "" : "s"} busy` : "barbers free"}</span>{busy && Number.isFinite(oldest) ? <b className="font-bold text-on-ink tabular-nums">· {elapsedLabel(oldest, now)}</b> : null}</p>
            <div className="mt-2 flex flex-nowrap items-center gap-1.5">
              <Button href="/queue/new" variant="white" size="sm" className={PILL} leadingIcon={<Plus size={14} strokeWidth={2} />}>Walk-in</Button>
              <Button href="/scan" variant="ghost-inverse" size="sm" className={PILL} leadingIcon={<ScanLine size={14} strokeWidth={1.9} />}>Scan QR</Button>
            </div>
          </div>
          <div aria-hidden className="pointer-events-none relative z-0 -mr-2 w-[116px] flex-none">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative pre-sized local WebP; next/image adds nothing here */}
            <img src="/barber-hero.webp" alt="" width={116} height={111} className="h-auto w-[116px]" /></div>
        </section>
        <div className="mx-4 mt-3 grid grid-cols-3 gap-3">
          <Link href="/queue" aria-label="Customers today" className="block min-w-0 rounded-card"><StatCard className="pb-3" label="Customers" value={String(customers)} /></Link>
          <Link href="/queue?channel=online" aria-label="Online bookings today" className="block min-w-0 rounded-card"><StatCard className="pb-3" label="Online" value={String(online)} /></Link>
          <Link href="/sales?view=performance" aria-label="Cash to claim from barbers" className="block min-w-0 rounded-card"><StatCard className="pb-3" label="To Claim" value={remit.loading ? <Sk className="mt-1 h-7 w-24" /> : peso(toClaim)} /></Link>
        </div>
        {needsSetup ? <SetupCard className="mx-4 mt-3" /> : null}
        <CompanionCard className="mx-4 mt-3" />
        <SalesChartCard className="mx-4 mt-3" series={todaySales.series} kind="hour" sales={todaySales.sales} />
        {shops.viewingAll ? <ShopDays rows={byShop} /> : null}
        <SectionHeader className="px-5 pb-1 pt-4" title="Bookings to accept" aside={aside} />
        <div className="mx-4"><Bookings rows={fresh} loading={!ready} max={4} placeFor={placeFor} locationId={shops.viewingAll ? undefined : shops.scopeId ?? undefined} /></div>
        {paid ? null : (
          <Card padding="none" className="mx-4 mt-2.5 flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="min-w-0">
              <b className="block text-[14px]">You’re on Partner</b>
              <small className="text-[12.5px] font-semibold text-muted">Walk-ins: 10/day · Pro adds unlimited walk-ins and the shop QR · ₱499/mo</small>
            </span>
            <Button href="/settings/billing" variant="secondary" size="sm" className="flex-none">Plans</Button>
          </Card>
        )}
      </div>

      <div className="mx-auto hidden w-full max-w-[1120px] px-4 pb-6 pt-4 lg:block lg:px-[30px] lg:pt-6">
        <DesktopBar brand={user ? brand : null} onSignIn={user ? undefined : () => requireAuth()} />
        {needsSetup ? <SetupCard className="mt-5" /> : null}
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_286px]">
          <HeroBanner
            size="lg"
            eyebrow={`Today · ${dayLabel}`}
            title={`${todayTitle} · ${figures.cuts} cuts`}
            titleSize="lg"
            description={busy ? `${busy} barber${busy === 1 ? "" : "s"} with a customer` : "All barbers free"}
            contentWidth={460}
            actions={
              <div className="flex flex-nowrap items-center gap-2.5">
                <Button href="/queue/new" variant="white" size="md" leadingIcon={<Plus size={18} strokeWidth={1.9} />}>Walk-in</Button>
                <Button href="/scan" variant="ghost-inverse" size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan QR</Button>
              </div>
            }
            // eslint-disable-next-line @next/next/no-img-element -- decorative pre-sized local WebP
            illustration={<img src="/barber-hero.webp" alt="" width={230} height={220} className="h-auto w-[230px]" />}
            illustrationClassName="right-[30px] top-1/2 -translate-y-1/2"
          />
          <StatCard
            className="px-5 pb-4 pt-[18px]"
            layout="title"
            label="Today’s barbers"
            footer={
              <>
                <span className="flex flex-col leading-[1.2]">
                  <b className="text-[17px] font-extrabold">{figures.cuts} done</b>
                  <small className="text-[12px] font-semibold text-muted">{peso(figures.sales)} in sales</small>
                </span>
                <Badge variant="soft">{toAccept} waiting</Badge>
              </>
            }
          >
            <div className="my-1.5 flex justify-center">
              <ProgressRing value={pct} size={124} thickness={11.5} label={`${pct}%`} labelSize={23} ariaLabel={`${pct}% of today’s customers served`} />
            </div>
          </StatCard>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-5">
          <Link href="/queue" aria-label="Customers today" className="block min-w-0 rounded-card"><StatCard className="pb-3" label="Customers" value={String(customers)} /></Link>
          <Link href="/queue?channel=online" aria-label="Online bookings today" className="block min-w-0 rounded-card"><StatCard className="pb-3" label="Online" value={String(online)} /></Link>
          <Link href="/sales?view=performance" aria-label="Cash to claim from barbers" className="block min-w-0 rounded-card"><StatCard className="pb-3" label="To Claim" value={remit.loading ? <Sk className="mt-1 h-7 w-24" /> : peso(toClaim)} /></Link>
        </div>
        <CompanionCard className="mt-5" />
        <SalesChartCard className="mt-5" series={todaySales.series} kind="hour" sales={todaySales.sales} />
        {shops.viewingAll ? <ShopDays rows={byShop} className="mt-5" /> : null}
        <Card padding="none" className="mt-5 px-[18px] pb-4 pt-4">
          <CardHeader className="mb-3" title="Bookings to accept" subtitle={aside} action={<Link href="/queue?channel=online" className={linkCls}>All bookings</Link>} />
          <Bookings rows={fresh} loading={!ready} max={4} placeFor={placeFor} locationId={shops.viewingAll ? undefined : shops.scopeId ?? undefined} />
        </Card>
      </div>
    </>
  );
}

function ShopDays({ rows, className }: { rows: { branch: { id: string; name: string }; sales: number; cuts: number; inChair: number }[]; className?: string }) {
  return (
    <ul className={`mx-4 flex flex-col gap-3 ${className ?? "mt-3"}`}>
      {rows.map((item) => (
        <li key={item.branch.id} className="rounded-card bg-surface px-3.5 py-3 shadow-card">
          <b className="block text-[15px]">{item.branch.name}</b>
          <p className="mt-0.5 text-[13px] font-semibold text-muted">Today: {peso(item.sales)} · {item.cuts} cuts · {item.inChair} busy</p>
        </li>
      ))}
    </ul>
  );
}

function SetupCard({ className }: { className?: string }) {
  return (
    <Card padding="none" className={`flex items-center justify-between gap-3 px-4 py-3.5 ${className ?? ""}`}>
      <span className="min-w-0">
        <b className="block text-[14.5px]">Set up your shop</b>
        <small className="text-[12.5px] font-semibold text-muted">Add the name, map pin, chairs and prices so customers can book.</small>
      </span>
      <Button href="/settings/edit" size="sm" className="flex-none">Set up</Button>
    </Card>
  );
}

function DesktopBar({ brand, onSignIn }: { brand: React.ReactNode; onSignIn?: () => void }) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 px-1">
      <div className="min-w-0">{brand}</div>
      <div className="flex flex-none items-center gap-3">
        <Link href="/sales" aria-label="Sales" className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full border border-line py-1 pl-1 pr-3">
          <CoinIcon size={26} />
          <span className="text-[13px] font-bold leading-none text-ink">Sales</span>
        </Link>
        {onSignIn ? <Button size="sm" onClick={onSignIn}>Sign in</Button> : null}
      </div>
    </div>
  );
}

/** Ticks every second only while a cut is live. */
function useTick(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [on]);
  return now;
}
