"use client";

import { ChevronRight, CreditCard, History, LogOut, MapPin, Package, Pencil, Scissors } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Badge, Button, Card, ListItem, Topbar, cn } from "@river-apps/ui";
import { BarberChair } from "@/components/art";
import { PageBack } from "@/components/shell/PageBack";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { ALL_LOCATIONS, useShopLocations } from "@/lib/shop-locations";
import { locationCountLabel, shopHandle, useShopProfile } from "@/lib/shop-profile";
import { signOut, useSession } from "@/lib/session";
import { useTier } from "@/lib/tier";

const PAID_PER_MO = "₱499/mo";

/** Settings hub, same shape as Laundry.ph: profile, credits, setup, features, log out. */
export function SettingsScreen() {
  const { profile } = useShopProfile();
  const shops = useShopLocations();
  const { tier } = useTier();
  const router = useRouter();
  const [partnerOn, setPartnerOn] = useState(false);
  const { user } = useSession();
  const { requireAuth } = useAuthGate();
  const paid = tier === "paid";
  const place = shops.viewingAll
    ? "All locations"
    : (shops.enabled && shops.branch ? (shops.branch.area || shops.branch.name) : (profile.area || profile.location?.formattedAddress || profile.address.split(",")[0]?.trim()));
  const locationCount = shops.enabled ? Math.max(1, shops.branches.length) : profile.locations;

  const links = [
    { href: "/history", icon: History, title: "History", subtitle: "Past visits and bookings" },
    ...(paid ? [] : [{ href: "/qr", icon: Scissors, title: "Shop listing", subtitle: "How customers find this shop" }]),
    { href: "/settings/services", icon: Package, title: "Services", subtitle: "Haircut, other services and chairs" },
    { href: "/settings/billing", icon: CreditCard, title: "Plan & billing", subtitle: `Partner · Pro ${PAID_PER_MO} · Lifetime` },
  ];

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" leading={<PageBack fallback="/home" />} title="Settings" subtitle="Your shop on Barbers.ph" />

      <section className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
        <div className="flex items-center gap-3.5">
          <Avatar name={profile.name} src={profile.logoUrl || undefined} preset="sky" size={72} decorative={false} className="flex-none shadow-tile ring-1 ring-line" />
          <div className="min-w-0 flex-1">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="min-w-0 text-[18px] font-extrabold leading-[1.2] tracking-[-0.02em] sm:text-[20px]">{profile.name || (user ? "Name your shop" : "Your shop")}</h2>
                <button
                  type="button"
                  aria-expanded={partnerOn}
                  aria-label="River partner"
                  onClick={() => setPartnerOn((on) => !on)}
                  className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-ink text-white"
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" aria-hidden><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8Z" fill="currentColor" /></svg>
                </button>
              </div>
              {partnerOn ? <p className="mt-0.5 text-[12.5px] font-bold">River partner</p> : null}
            </div>
            {profile.name ? <p className="mt-0.5 text-[13.5px] font-semibold text-muted">{shopHandle(profile.name)}</p> : null}
            <p className="mt-1.5 text-[12.5px] font-semibold text-muted">
              {user ? locationCountLabel(locationCount) : "Sign in to set up your shop"}
            </p>
          </div>
        </div>
        {user ? (
          <Button className="mt-3" href="/settings/edit" size="xs" leadingIcon={<Pencil size={14} strokeWidth={1.75} />}>{profile.name ? "Update shop" : "Set up shop"}</Button>
        ) : (
          <Button className="mt-3" size="xs" onClick={() => requireAuth()}>Sign in</Button>
        )}
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[13.5px] font-medium leading-snug text-ink/80">
            {profile.about || (paid ? "Walk-ins, the queue and the shop QR." : "Online bookings from River Mobile and the queue.")}
          </p>
          {place ? (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted">
              <MapPin size={14} strokeWidth={1.75} aria-hidden />{place}
            </p>
          ) : null}
        </div>
      </section>


      {shops.ready ? <LocationCard shops={shops} /> : null}

      <div className="mt-6 grid grid-cols-1 gap-4">
        <Card padding="none" className="px-3.5 py-1.5">
          <b className="block px-1 pt-3 text-[16px]">Setup</b>
          <ul className="mt-1">
            {links.map((it) => {
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link href={it.href} className="block rounded-tile">
                    <ListItem
                      variant="row"
                      className="py-2"
                      leading={<span className="inline-flex size-10 items-center justify-center rounded-tile bg-grey-100"><Icon size={18} strokeWidth={1.75} /></span>}
                      title={it.title}
                      subtitle={it.subtitle}
                      trailing={<ChevronRight size={20} strokeWidth={1.75} className="text-subtle" />}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card padding="none" className="overflow-visible px-2 py-1.5">
          <b className="block px-2.5 pt-3 text-[16px]">Features</b>
          <Link href="/settings/shops" className="flex min-h-[60px] items-center gap-3 rounded-tile px-1.5 py-2">
            <span className="inline-flex size-10 items-center justify-center rounded-tile bg-grey-100"><MapPin size={18} strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px]">Multiple shops</b>
              <small className="block truncate text-[13px] font-medium text-muted">{shops.enabled ? "On. Each shop has its own day." : "Off until you turn it on."}</small>
            </span>
            <Badge variant="soft" size="sm">{shops.enabled ? "On" : "Off"}</Badge>
          </Link>
          {paid ? (
            <div className="relative mx-1.5 mb-1 mt-11 rounded-card bg-grey-100 px-4 pb-4 pt-[78px] lg:hidden">
              <div className="absolute inset-x-0 -top-9 flex justify-center"><BarberChair size={150} /></div>
              <b className="block text-[14.5px]">Shop QR code</b>
              <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">Customers scan to book</small>
              <Button size="sm" fullWidth href="/qr">Get QR code</Button>
            </div>
          ) : null}
          {paid ? (
            <Link href="/queue/new" className="flex min-h-[60px] items-center gap-3 rounded-tile px-1.5 py-2">
              <span className="inline-flex size-10 items-center justify-center rounded-tile bg-grey-100"><Scissors size={18} strokeWidth={1.75} /></span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px]">Walk-in</b>
                <small className="block truncate text-[13px] font-medium text-muted">Add someone at the chair</small>
              </span>
              <Badge variant="soft" size="sm">Included</Badge>
            </Link>
          ) : (
            <Link href="/queue/new" className="flex min-h-[60px] items-center gap-3 rounded-tile px-1.5 py-2">
              <span className="inline-flex size-10 items-center justify-center rounded-tile bg-grey-100"><Scissors size={18} strokeWidth={1.75} /></span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px]">Walk-in</b>
                <small className="block truncate text-[13px] font-medium text-muted">Walk-ins: 10/day on Partner</small>
              </span>
              <Badge variant="soft" size="sm">10/day</Badge>
            </Link>
          )}
        </Card>

        {user ? <button
          type="button"
          onClick={() => { void signOut().then(() => router.push("/home")); }}
          className="flex min-h-14 items-center gap-3 rounded-card bg-surface px-4 py-3 text-left shadow-card"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-tile bg-grey-100"><LogOut size={18} strokeWidth={1.75} /></span>
          <span>
            <b className="block text-[15px]">Log out</b>
            <small className="text-[13px] font-medium text-muted">{user.email || user.phone || "Signed in"}</small>
          </span>
        </button> : null}
        <p className="-mt-1 px-1 text-[12px] font-medium text-muted">
          <Link href="/terms" className="hover:underline">Terms</Link>
          <span aria-hidden> · </span>
          <Link href="/privacy" className="hover:underline">Privacy</Link>
        </p>
      </div>
    </div>
  );
}

function LocationCard({ shops }: { shops: ReturnType<typeof useShopLocations> }) {
  const choices = [
    ...shops.branches.map((branch) => ({ id: branch.id, name: branch.name, detail: branch.area || branch.address || "This shop" })),
    { id: ALL_LOCATIONS, name: "All locations", detail: "Every shop on one screen" },
  ];
  return (
    <section className="mt-3 rounded-card bg-surface px-4 py-4 shadow-card">
      <p className="text-[13px] font-semibold text-muted">Location</p>
      {shops.enabled ? (
        <ul className="mt-3 flex flex-col gap-2">
          {choices.map((item) => {
            const open = item.id === ALL_LOCATIONS ? shops.viewingAll : !shops.viewingAll && shops.viewId === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => shops.setView(item.id)}
                  aria-pressed={open}
                  className={cn("flex min-h-12 w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-left", open ? "bg-ink text-white" : "bg-grey-50")}
                >
                  <span className="min-w-0">
                    <b className="block truncate text-[15px]">{item.name}</b>
                    <small className={cn("block truncate text-[12.5px] font-semibold", open ? "text-white/70" : "text-muted")}>{item.detail}</small>
                  </span>
                  <span className={cn("flex-none text-[12px] font-bold", open ? "text-white" : "text-muted")}>{open ? "Open" : "Use"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-[14.5px] font-semibold">Disabled. This phone stays on one shop.</p>
      )}
      <Button className="mt-4" href="/settings/shops" size="md" fullWidth variant="secondary">Manage shops</Button>
    </section>
  );
}
