"use client";
import { chairBarberName } from "@/lib/shop-chairs";
import { BarberPortrait } from "@/features/settings/SeatList";
import { ShareBarberLink } from "@/features/settings/ServicesScreen";
import { FormSkeleton } from "@/components/common/Skeleton";
import Link from "next/link";
import { QrCode } from "@/components/common/QrCode";

import { useState } from "react";
import { PageBack } from "@/components/shell/PageBack";
import { Input } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { reverseGeocodePin } from "@/lib/geocode";
import { removeChairsAt, useShopChairs, chairLocation } from "@/lib/shop-chairs";
import {
  HOME_LOCATION_ID, useShopLocations,
  type ShopBranch,
} from "@/lib/shop-locations";
import { copyMenuToLocation } from "@/lib/shop-services";
import { useCloud } from "@/lib/cloud";
import { bookingUrl } from "@/lib/chair-bookings";
import { useOwnerLogo, useShopProfile, type ShopLocation } from "@/lib/shop-profile";
import { maxLocations, planForLocations, planInfo } from "@/lib/plans";
import { useTier } from "@/lib/tier";
import { LocationPicker } from "./LocationPicker";

/** Turn shops on, add a place, and keep each pin with that shop. */
export function ShopsScreen() {
  const cloudReady = useCloud().ready;
  const { profile, ready: profileReady } = useShopProfile();
  const { enabled, ready, branches, enable, disable, addBranch, updateBranch, removeBranch } = useShopLocations();
  const { chairs } = useShopChairs({ all: true });
  const { access } = useTier();
  const [confirmMulti, setConfirmMulti] = useState<"on" | "off" | null>(null);
  const limit = maxLocations(access);
  const atLimit = branches.length >= limit;
  const next = planForLocations(branches.length + 1);
  const [name, setName] = useState("");
  const [pin, setPin] = useState<ShopLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function onAdd() {
    setError("");
    if (!pin) {
      setError("Drop a pin so this shop has an address.");
      return;
    }
    setBusy(true);
    try {
      const geo = await reverseGeocodePin(pin.lat, pin.lng);
      const address = geo?.formatted || pin.formattedAddress;
      const area = geo?.area || address;
      const result = addBranch({ name, address, area, location: { ...pin, formattedAddress: address } });
      if (result.error || !result.branch) {
        setError(result.error || "Couldn’t add that shop.");
        return;
      }
      copyMenuToLocation(result.branch.id);
      setName("");
      setPin(null);
      setNote(`${result.branch.name} is ready. Its queue, barbers, and barber links stay on this shop.`);
    } catch {
      setError("Couldn’t look up that pin. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!cloudReady) return <FormSkeleton />;
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <header className="mt-1 px-1">
        <div className="flex items-center gap-1">
          <PageBack fallback="/settings" />
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Manage Locations</h1>
        </div>
        <p className="mt-0.5 pl-11 text-[14px] font-semibold text-muted">{enabled ? "Each shop has its own QR. Tap Edit Shop for its details, pin and barbers." : "Turn this on when you run more than one shop."}</p>
      </header>
      {note ? <p className="mt-3 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">{note}</p> : null}
      {error ? <p className="mt-3 text-[13.5px] font-semibold">{error}</p> : null}

      {!ready ? null : enabled ? (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {branches.map((branch) => (
              <li key={branch.id} className="rounded-card bg-surface px-3.5 py-3.5 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <b className="block text-[16px]">{branch.name}{branch.id === HOME_LOCATION_ID ? <span className="ml-1.5 text-[12px] font-semibold text-muted">Main</span> : null}</b>
                    <p className="mt-0.5 text-[13px] font-medium text-muted">{branch.area || branch.address || "No pin yet"}</p>
                    <Link href={`/settings/shops/edit?id=${encodeURIComponent(branch.id)}`} className="mt-3 inline-flex h-8 items-center rounded-pill px-3.5 text-[12.5px] font-bold ring-1 ring-ink">Edit Shop</Link>
                  </div>
                  <BranchQr branchId={branch.id} name={branch.name} />
                </div>
                <BranchBarbers locationId={branch.id} />
              </li>
            ))}
          </ul>

          {atLimit ? (
            <section className="mt-6 rounded-card bg-surface px-4 py-4 shadow-card">
              <b className="block text-[16px]">{planInfo(access).title} runs {limit} shop{limit === 1 ? "" : "s"}</b>
              <p className="mt-1 text-[13.5px] font-medium text-muted">To add another shop, upgrade to {next.title} ({next.price}).</p>
              <Button className="mt-4" fullWidth href="/settings/billing">See Lifetime plans</Button>
            </section>
          ) : (
          <section className="mt-6">
            <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.04em] text-muted">Add a shop</h2>
            <div className="mt-2 flex flex-col gap-3 rounded-card bg-surface px-3.5 py-3.5 shadow-card">
              <Input label="Shop name" placeholder="Concepcion Dos" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
              <LocationPicker value={pin} onChange={setPin} disabled={busy} />
              <Button fullWidth loading={busy} disabled={busy || name.trim().length < 2} data-auth="action" onClick={() => void onAdd()}>{busy ? "Saving…" : "Add shop"}</Button>
            </div>
          </section>
          )}

          <div className="mt-6 rounded-card bg-surface px-4 py-4 shadow-card">
            <b className="block text-[15px]">Multiple shops is on</b>
            <p className="mt-1 text-[13px] font-medium text-muted">You run {branches.length} location{branches.length === 1 ? "" : "s"} from this account.</p>
            <button type="button" data-auth="action" onClick={() => setConfirmMulti("off")} className="mt-3 h-10 w-full rounded-pill border-2 border-[#D92D20] text-[14px] font-bold text-[#D92D20]">Turn off multiple shops</button>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
          <b className="block text-[16px]">One shop</b>
          <p className="mt-1 text-[13.5px] font-medium text-muted">Turn this on when you run more than one shop. The shop you have now becomes the first one.</p>
          <Button className="mt-4" fullWidth disabled={!profileReady} data-auth="action" onClick={() => setConfirmMulti("on")}>Turn on multiple shops</Button>
        </div>
      )}
      {confirmMulti ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setConfirmMulti(null)}>
          <div role="dialog" aria-modal="true" aria-label={confirmMulti === "on" ? "Turn on multiple shops" : "Turn off multiple shops"} className="w-full max-w-[440px] rounded-t-[28px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-card sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
            <b className="block text-[19px] tracking-[-0.02em]">{confirmMulti === "on" ? "Turn on multiple shops?" : "Turn off multiple shops?"}</b>
            {confirmMulti === "on" ? (
              <ul className="mt-2 grid gap-1.5 text-[13.5px] font-medium text-ink-2">
                <li>• The shop you have now becomes your first location.</li>
                <li>• You can add more locations, each with its own address, barbers and booking QR.</li>
                <li>• Home, Queue and Sales get a location switcher.</li>
              </ul>
            ) : (
              <ul className="mt-2 grid gap-1.5 text-[13.5px] font-medium text-ink-2">
                <li>• Your other locations are hidden. Home, Queue, links and Sales go back to the first shop.</li>
                <li>• Nothing is deleted: locations, barbers, visits and sales stay saved and come back if you turn it on again.</li>
              </ul>
            )}
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmMulti(null)}>Cancel</Button>
              {confirmMulti === "on" ? (
                <Button className="flex-1" data-auth="action" disabled={!profileReady} onClick={() => { enable(profile); setConfirmMulti(null); setNote("Multiple shops is on. This shop is the first one."); }}>Turn on</Button>
              ) : (
                <button type="button" data-auth="action" onClick={() => { disable(); setConfirmMulti(null); setNote("Multiple shops is off. This phone is back on the first shop."); }} className="h-11 flex-1 rounded-pill bg-[#D92D20] px-4 text-[14px] font-bold text-white">Turn off</button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** This shop's booking QR, right on its card. Tap to open the printable QR page. */
function BranchQr({ branchId, name }: { branchId: string; name: string }) {
  const cloud = useCloud();
  const logo = useOwnerLogo();
  const url = cloud.shopId && typeof window !== "undefined" ? bookingUrl(window.location.origin, cloud.shopId, branchId) : "";
  return (
    <a href={`/qr?loc=${encodeURIComponent(branchId)}`} className="flex-none rounded-[12px] bg-white p-1 ring-1 ring-line" aria-label={`Booking QR for ${name}. Open to print or share.`}>
      {url ? <QrCode value={url} size={92} label={`Booking QR for ${name}`} logo={logo || "/icon-192.png"} /> : <span className="block size-[92px]" />}
    </a>
  );
}

/** Compact barber list on a location card: avatar + name, Share only (manage them in Edit Shop). */
function BranchBarbers({ locationId }: { locationId: string }) {
  const { chairs } = useShopChairs({ all: true });
  const mine = chairs.filter((c) => (c.locationId || HOME_LOCATION_ID) === locationId && c.active !== false);
  if (!mine.length) return <p className="mt-3 border-t border-line pt-2.5 text-[12.5px] font-semibold text-muted">No barbers yet. Add them in Edit Shop.</p>;
  return (
    <ul className="mt-3 grid gap-2 border-t border-line pt-2.5">
      {mine.map((c) => (
        <li key={c.id} className="flex items-center gap-2.5">
          <BarberPortrait chair={c} size={28} />
          <b className="min-w-0 flex-1 truncate text-[13.5px]">{chairBarberName(c)}</b>
          <ShareBarberLink compact id={c.id} name={chairBarberName(c)} />
        </li>
      ))}
    </ul>
  );
}
