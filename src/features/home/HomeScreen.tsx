"use client";

import { CoinIcon } from "@river-apps/icons";
import { Plus, ScanLine } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, HeroBanner, ProgressRing, SearchInput, SectionHeader, StatCard, Topbar } from "@river-apps/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarberChair } from "@/components/art";
import { PageBack } from "@/components/shell/PageBack";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { useSession } from "@/lib/session";
import { peso } from "@/lib/format";
import { salesReport } from "@/lib/sales-report";
import { SalesChartCard } from "@/features/sales/SalesChart";
import { markInChair, setRequestStatus, todayFigures, useScopedRequests, type ChairRequest } from "@/lib/chair-bookings";
import { branchName, HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useGreeting, useShopProfile } from "@/lib/shop-profile";
import { useTier } from "@/lib/tier";

const linkCls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]";
const PILL = "relative h-8 gap-1 rounded-pill px-2.5 text-[12px] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']";

function shortPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("63") ? `0${digits.slice(2)}` : digits;
  return local.length > 7 ? `${local.slice(0, 4)}•••${local.slice(-3)}` : phone;
}

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
          setNote(chair ? "" : "Every chair is taken, or none have been added in Services yet.");
        }}>Accept</Button>
      </div>
      {note ? <p className="mt-2 text-[13px] font-semibold">{note}</p> : null}
    </article>
  );
}

function Bookings({ rows, loading, max, placeFor }: { rows: ChairRequest[]; loading: boolean; max: number; placeFor?: (row: ChairRequest) => string }) {
  const shown = rows.slice(0, max);
  const more = rows.length - shown.length;
  if (loading) return <p className="rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">Loading bookings…</p>;
  return (
    <div className="flex flex-col gap-3">
      {shown.length === 0 ? (
        <p className="rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
          No bookings yet. When customers scan the shop QR, they’ll show up here.
        </p>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3">
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
  const inChair = rows.filter((row) => row.status === "in_chair").length;
  const unpaid = rows.filter((row) => !row.paid && row.status !== "declined").reduce((sum, row) => sum + row.price, 0);
  const todaySales = salesReport(rows, unpaid, "today");
  const aside = !ready ? "" : fresh.length ? `${fresh.length} new` : "Live";
  const { user } = useSession();
  const { requireAuth } = useAuthGate();
  const owner = user ? (user.name.split(" ")[0] || user.name) : "";
  const shopName = profile.name || (user ? "your shop" : "Barbers.ph");
  const contact = user ? shortPhone(user.phone || profile.phone) || user.email || "" : "";
  const needsSetup = Boolean(user) && ready && !profile.name;
  const dayLabel = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" });
  const dayTotal = figures.cuts + toAccept;
  const pct = dayTotal ? Math.round((figures.cuts / dayTotal) * 100) : 0;

  return (
    <>
      <div className="mx-auto w-full max-w-[402px] pb-4 lg:hidden">
        <header className="px-4 pt-1">
          <div className="flex h-16 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center">
              <PageBack fallback="/home" />
              {user ? (
                <Link href="/settings" aria-label="My Account" className="flex min-h-11 items-center gap-2 rounded-[14px] py-1 pl-1 pr-1.5">
                  <Avatar name={owner || "Me"} src={user.photoUrl} preset="sky" size={36} />
                  <span className="flex min-w-0 flex-col leading-[1.2]">
                    <span className="max-w-[150px] truncate text-[13px] font-medium">{user.name}</span>
                    {contact ? <span className="max-w-[150px] truncate text-[11px] font-medium text-muted">{contact}</span> : null}
                  </span>
                </Link>
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
            <Link href="/sales" aria-label="Sales" className="inline-flex size-11 flex-none items-center justify-center">
              <CoinIcon size={36} />
            </Link>
          </div>
        </header>
        <section className="relative isolate mx-4 mt-3 flex h-[150px] items-center overflow-hidden rounded-banner bg-ink px-4 text-on-ink">
          <div className="relative z-10 min-w-0 flex-1">
            <p className="truncate text-[12px] leading-4">
              <span className="font-medium text-on-ink-muted">{greeting}, </span>
              <span className="font-semibold text-on-ink/90">{shopName}</span>
            </p>
            <h2 className="mt-1 text-[18px] font-extrabold leading-[1.15] tracking-[-0.025em]">
              {todayTitle}
            </h2>
            <p className="mt-0.5 text-[12.5px] font-medium text-on-ink-muted">{figures.cuts} cuts · {inChair} in chair</p>
            <div className="mt-2 flex flex-nowrap items-center gap-1.5">
              {paid ? <Button href="/queue/new" variant="white" size="sm" className={PILL} leadingIcon={<Plus size={14} strokeWidth={2} />}>Walk-in</Button> : null}
              <Button href="/scan" variant={paid ? "ghost-inverse" : "white"} size="sm" className={PILL} leadingIcon={<ScanLine size={14} strokeWidth={1.9} />}>Scan QR</Button>
            </div>
          </div>
          <div aria-hidden className="relative z-0 w-[88px] flex-none"><BarberChair size={88} /></div>
        </section>
        <div className="mx-4 mt-3 grid grid-cols-3 gap-3">
          <StatCard className="pb-3" label="To accept" value={String(toAccept)} />
          <Link href="/queue/seats" aria-label="In chair" className="block min-w-0 rounded-card">
            <StatCard className="pb-3" label="In chair" value={String(inChair)} />
          </Link>
          <StatCard className="pb-3" label="Unpaid" value={peso(unpaid)} />
        </div>
        {needsSetup ? <SetupCard className="mx-4 mt-3" /> : null}
        <SalesChartCard className="mx-4 mt-3" series={todaySales.series} kind="hour" sales={todaySales.sales} />
        {shops.viewingAll ? <ShopDays rows={byShop} /> : null}
        <SectionHeader className="px-5 pb-1 pt-4" title="Bookings to accept" aside={aside} />
        <div className="mx-4"><Bookings rows={fresh} loading={!ready} max={4} placeFor={placeFor} /></div>
        {paid ? null : (
          <Card padding="none" className="mx-4 mt-2.5 flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="min-w-0">
              <b className="block text-[14px]">You’re on Partner</b>
              <small className="text-[12.5px] font-semibold text-muted">Pro adds walk-ins and the shop QR · ₱499/mo</small>
            </span>
            <Button href="/settings/billing" variant="secondary" size="sm" className="flex-none">Plans</Button>
          </Card>
        )}
      </div>

      <div className="mx-auto hidden w-full max-w-[1120px] px-4 pb-6 pt-4 lg:block lg:px-[30px] lg:pt-6">
        <DesktopBar name={shopName} owner={owner} greeting={greeting} dayLabel={dayLabel} photoUrl={user?.photoUrl} onSignIn={user ? undefined : () => requireAuth()} />
        {needsSetup ? <SetupCard className="mt-5" /> : null}
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_286px]">
          <HeroBanner
            size="lg"
            eyebrow={`Today · ${dayLabel}`}
            title={`${todayTitle} · ${figures.cuts} cuts`}
            titleSize="lg"
            description={`${inChair} in chair`}
            contentWidth={460}
            actions={
              <div className="flex flex-nowrap items-center gap-2.5">
                {paid ? <Button href="/queue/new" variant="white" size="md" leadingIcon={<Plus size={18} strokeWidth={1.9} />}>Walk-in</Button> : null}
                <Button href="/scan" variant={paid ? "ghost-inverse" : "white"} size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan QR</Button>
              </div>
            }
            illustration={<BarberChair size={220} />}
            illustrationClassName="right-[34px] bottom-3"
          />
          <StatCard
            className="px-5 pb-4 pt-[18px]"
            layout="title"
            label="Today’s chairs"
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
          <StatCard className="pb-3" label="To accept" value={String(toAccept)} />
          <Link href="/queue/seats" aria-label="In chair" className="block min-w-0 rounded-card">
            <StatCard className="pb-3" label="In chair" value={String(inChair)} />
          </Link>
          <StatCard className="pb-3" label="Unpaid" value={peso(unpaid)} />
        </div>
        <SalesChartCard className="mt-5" series={todaySales.series} kind="hour" sales={todaySales.sales} />
        {shops.viewingAll ? <ShopDays rows={byShop} className="mt-5" /> : null}
        <Card padding="none" className="mt-5 px-[18px] pb-4 pt-4">
          <CardHeader className="mb-3" title="Bookings to accept" subtitle={aside} action={<Link href="/queue?channel=online" className={linkCls}>All bookings</Link>} />
          <Bookings rows={fresh} loading={!ready} max={4} placeFor={placeFor} />
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
          <p className="mt-0.5 text-[13px] font-semibold text-muted">Today: {peso(item.sales)} · {item.cuts} cuts · {item.inChair} in chair</p>
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

function DesktopBar({ name, owner, greeting, dayLabel, photoUrl, onSignIn }: { name: string; owner: string; greeting: string; dayLabel: string; photoUrl?: string; onSignIn?: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  return (
    <Topbar
      className="px-1"
      leading={<PageBack fallback="/home" />}
      title={owner ? `${greeting}, ${owner}` : greeting}
      subtitle={`${dayLabel} · ${name}`}
      actions={
        <>
          <form className="hidden xl:flex" onSubmit={(e) => { e.preventDefault(); router.push(search.trim() ? `/scan?code=${encodeURIComponent(search.trim())}` : "/scan"); }}>
            <SearchInput className="w-[300px]" placeholder="Find ticket, e.g. BK-7K2Q9M" label="Find a ticket" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <Link href="/sales" aria-label="Sales" className="inline-flex size-11 items-center justify-center">
            <CoinIcon size={40} />
          </Link>
          {onSignIn ? (
            <Button size="sm" onClick={onSignIn}>Sign in</Button>
          ) : (
            <Link href="/settings" aria-label="Settings" className="rounded-full">
              <Avatar name={owner || "Me"} src={photoUrl} preset="sky" size={44} decorative={false} />
            </Link>
          )}
        </>
      }
    />
  );
}
