"use client";
import { FormSkeleton } from "@/components/common/skeleton";
import { Card, Input } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageBack } from "@/components/shell/page-back";
import { reverseGeocodePin } from "@/lib/geocode";
import { chairLocation, removeChairsAt, useShopChairs } from "@/lib/shop-chairs";
import { useChairRequests } from "@/lib/chair-bookings";
import { HOME_LOCATION_ID, useShopLocations, type ShopBranch } from "@/lib/shop-locations";
import type { ShopLocation } from "@/lib/shop-profile";
import { LocationPicker } from "./location-picker";
import { ServicesScreen } from "./services-screen";

/** Manage Shop: one location's name, address, pin, profile and its services & chairs. */
export function ManageShopScreen() {
  const id = useSearchParams().get("id") ?? HOME_LOCATION_ID;
  const shops = useShopLocations();
  const branch = shops.branches.find((b) => b.id === id);
  if (!shops.ready) return <FormSkeleton />;
  if (!branch) {
    return (
      <div className="mx-auto max-w-[402px] px-4 pt-6">
        <div className="flex items-center gap-1"><PageBack fallback="/settings/shops" /><h1 className="text-[26px] font-extrabold">Manage Shop</h1></div>
        <p className="mt-3 text-[14px] font-semibold text-muted">This shop isn’t in your locations.</p>
      </div>
    );
  }
  return <Editor key={branch.id} branch={branch} />;
}

function Editor({ branch }: { branch: ShopBranch }) {
  const router = useRouter();
  const { updateBranch, removeBranch } = useShopLocations();
  const { chairs } = useShopChairs({ all: true });
  const { rows } = useChairRequests();
  const [name, setName] = useState(branch.name);
  const [phone, setPhone] = useState(branch.phone ?? "");
  const [about, setAbout] = useState(branch.about ?? "");
  const [address, setAddress] = useState(branch.address ?? "");
  const [pin, setPin] = useState<ShopLocation | null>(branch.location);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const pinMoved = (pin?.lat ?? 0) !== (branch.location?.lat ?? 0) || (pin?.lng ?? 0) !== (branch.location?.lng ?? 0);
  const dirty = name.trim() !== branch.name || phone !== (branch.phone ?? "") || about !== (branch.about ?? "") || address !== (branch.address ?? "") || pinMoved;

  async function save() {
    setBusy(true); setNote("");
    try {
      let area = branch.area, addr = address.trim(), loc = pin;
      if (pin && pinMoved) {
        const geo = await reverseGeocodePin(pin.lat, pin.lng);
        if (geo?.area) area = geo.area;
        const f = pin.formattedAddress || geo?.formatted || "";
        if (f) { loc = { ...pin, formattedAddress: f }; if (addr === (branch.address ?? "")) addr = f; }
      }
      updateBranch(branch.id, { name: name.trim() || branch.name, phone: phone.trim(), about: about.trim(), address: addr, area, location: loc });
      setAddress(addr);
      setNote("Saved.");
    } finally { setBusy(false); }
  }

  function remove() {
    const busyHere = rows.some((r) => r.status === "in_chair" && (r.locationId || HOME_LOCATION_ID) === branch.id);
    if (busyHere) { setNote(`Finish the cuts at ${branch.name} before removing it.`); setConfirm(false); return; }
    if (chairs.some((c) => chairLocation(c) === branch.id)) removeChairsAt(branch.id);
    const err = removeBranch(branch.id);
    if (err) { setNote(err); setConfirm(false); return; }
    router.push("/settings/shops");
  }

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-28 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <div className="flex items-center gap-1">
        <PageBack fallback="/settings/shops" />
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">Manage Shop</h1>
          <p className="truncate text-[13.5px] font-semibold text-muted">{branch.name}</p>
        </div>
      </div>
      {note ? <p className="mt-3 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold" role="status">{note}</p> : null}

      <div className="mt-4">
        <ServicesScreen locationId={branch.id} embedded />
      </div>

      <Card className="mt-6 grid gap-3 px-4 py-4">
        <b className="text-[16px]">Shop details</b>
        <Input label="Shop name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} disabled={busy} />
        <Input label="Address" value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} disabled={busy} placeholder="Street, barangay, city" />
        <Input label="Shop phone" inputMode="tel" value={phone} maxLength={20} placeholder="09XX XXX XXXX" onChange={(e) => setPhone(e.target.value)} disabled={busy} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">About this shop <span className="font-semibold text-muted">(optional)</span></span>
          <textarea value={about} maxLength={300} rows={3} onChange={(e) => setAbout(e.target.value)} disabled={busy} className="rounded-[14px] bg-grey-100 px-3 py-2.5 text-[15px] font-medium outline-none" />
        </label>
        <LocationPicker value={pin} onChange={setPin} disabled={busy} />
        <p className="text-[12.5px] font-semibold text-muted">Brand name, logo, hours and facades are in <a href="/settings/edit" className="font-bold underline underline-offset-[3px]">Shop profile</a>.</p>
      </Card>

      {branch.id === HOME_LOCATION_ID ? null : (
        <Card className="mt-6 px-4 py-4">
          <b className="block text-[15px]">Remove this shop</b>
          <p className="mt-1 text-[13px] font-medium text-muted">Its chairs and barber links are removed. Past visits stay in History and Sales.</p>
          {confirm ? (
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setConfirm(false)}>Keep it</Button>
              <button type="button" data-auth="action" onClick={remove} className="h-10 flex-1 rounded-pill bg-[#D92D20] px-4 text-[14px] font-bold text-white">Yes, remove {branch.name}</button>
            </div>
          ) : (
            <button type="button" data-auth="action" onClick={() => setConfirm(true)} className="mt-3 h-10 w-full rounded-pill border-2 border-[#D92D20] text-[14px] font-bold text-[#D92D20]">Remove shop</button>
          )}
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[402px] lg:max-w-[720px]">
          <Button data-auth="action" fullWidth loading={busy} disabled={busy || !dirty || name.trim().length < 2} onClick={() => void save()}>{busy ? "Saving…" : "Save Shop"}</Button>
        </div>
      </div>
    </div>
  );
}
