"use client";
import Link from "next/link";
import { QrCode } from "@/components/common/QrCode";

import { useState } from "react";
import { PageBack } from "@/components/shell/PageBack";
import { Button, Input } from "@river-apps/ui";
import { reverseGeocodePin } from "@/lib/geocode";
import { removeChairsAt, useShopChairs, chairLocation } from "@/lib/shop-chairs";
import {
  HOME_LOCATION_ID, useShopLocations,
  type ShopBranch,
} from "@/lib/shop-locations";
import { copyMenuToLocation } from "@/lib/shop-services";
import { useCloud } from "@/lib/cloud";
import { bookingUrl } from "@/lib/chair-bookings";
import { useShopProfile, type ShopLocation } from "@/lib/shop-profile";
import { maxLocations, planForLocations, planInfo } from "@/lib/plans";
import { useTier } from "@/lib/tier";
import { LocationPicker } from "./LocationPicker";

/** Turn shops on, add a place, and keep each pin with that shop. */
export function ShopsScreen() {
  const { profile, ready: profileReady } = useShopProfile();
  const { enabled, ready, branches, enable, disable, addBranch, updateBranch, removeBranch } = useShopLocations();
  const { chairs } = useShopChairs({ all: true });
  const { access } = useTier();
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

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <header className="mt-1 px-1">
        <div className="flex items-center gap-1">
          <PageBack fallback="/settings" />
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Manage Locations</h1>
        </div>
        <p className="mt-0.5 pl-11 text-[14px] font-semibold text-muted">{enabled ? "Each shop has its own QR. Tap Edit Shop for its details, pin and services." : "Turn this on when you run more than one shop."}</p>
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
              <Button fullWidth disabled={busy || name.trim().length < 2} data-auth="action" onClick={() => void onAdd()}>{busy ? "Saving…" : "Add shop"}</Button>
            </div>
          </section>
          )}

          <button
            type="button"
            className="mt-6 w-full rounded-card bg-surface px-4 py-3 text-left shadow-card"
            onClick={() => { disable(); setNote("Multiple shops is off. This phone is back on the first shop."); }}
          >
            <b className="block text-[15px]">Turn off multiple shops</b>
            <small className="text-[13px] font-medium text-muted">The other shops stay saved. Home, Queue, and links go back to the first shop.</small>
          </button>
        </>
      ) : (
        <div className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
          <b className="block text-[16px]">One shop</b>
          <p className="mt-1 text-[13.5px] font-medium text-muted">Turn this on when you run more than one shop. The shop you have now becomes the first one.</p>
          <Button className="mt-4" fullWidth disabled={!profileReady} data-auth="action" onClick={() => { enable(profile); setNote("Multiple shops is on. This shop is the first one."); }}>Turn on</Button>
        </div>
      )}
    </div>
  );
}

/** This shop's booking QR, right on its card. Tap to open the printable QR page. */
function BranchQr({ branchId, name }: { branchId: string; name: string }) {
  const cloud = useCloud();
  const url = cloud.shopId && typeof window !== "undefined" ? bookingUrl(window.location.origin, cloud.shopId, branchId) : "";
  return (
    <a href={`/qr?loc=${encodeURIComponent(branchId)}`} className="flex-none rounded-[12px] bg-white p-1 ring-1 ring-line" aria-label={`Booking QR for ${name}. Open to print or share.`}>
      {url ? <QrCode value={url} size={92} label={`Booking QR for ${name}`} /> : <span className="block size-[92px]" />}
    </a>
  );
}
