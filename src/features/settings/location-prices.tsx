"use client";
import { Button } from "@/components/common/button";
import { useState } from "react";
import { setLocationPrices, useShopLocations } from "@/lib/shop-locations";
import { draftFromBranches, planLocationSave } from "@/lib/location-prices";
import { useShopMenu } from "@/lib/shop-services";
export { draftToOverrides, withPrice } from "@/lib/location-prices";

/** The shop's services with default prices (Services is the source of truth). */
export function useDefaultServices() {
  const { haircut, treatments } = useShopMenu("master");
  return [{ id: "haircut", name: haircut.name || "Haircut", price: haircut.price ?? 0, icon: haircut.icon }, ...treatments.map((t) => ({ id: t.id, name: t.name, price: t.price ?? 0, icon: t.icon }))];
}

/**
 * Draft prices per location for one service. Nothing persists until `save()`.
 * Apply to all fills every box and becomes the service's base price (used by new locations).
 * `save()` writes only changed boxes (+ pins untouched default-following rows if the base moved) and returns the base price.
 */
export function useLocationDraft(serviceId: string, savedDefault: number) {
  const { branches } = useShopLocations();
  const initial = draftFromBranches(branches, serviceId, savedDefault);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  const current = { ...initial, ...(draft ?? {}) };
  return {
    branches,
    initial,
    draft: current,
    setDraft: (d: Record<string, string>) => setDraft(d),
    applyAll: (v: number) => { setApplied(v); setDraft(Object.fromEntries(branches.map((b) => [b.id, String(v)]))); },
    save: () => {
      const base = applied ?? savedDefault;
      setLocationPrices(serviceId, planLocationSave(branches, serviceId, savedDefault, base, current, initial), base);
      setDraft(null); setApplied(null);
      return base;
    },
  };
}

const clean = (v: string) => v.replace(/[^\d.]/g, "").slice(0, 8);

/** Edit service › Price per location: one price box per location, plus Apply to all. */
export function LocationPriceInputs({ draft, setDraft, branches, initial, onApplyAll, basePrice }: {
  draft: Record<string, string>; setDraft: (d: Record<string, string>) => void; branches: { id: string; name: string }[];
  initial: Record<string, string>; onApplyAll: (v: number) => void; basePrice: number;
}) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState("");
  const apply = () => { const v = Number(all); if (!all.trim() || !(v >= 0)) return; onApplyAll(Math.round(v * 100) / 100); setOpen(false); setAll(""); };
  return (
    <section className="mt-6" aria-label="Price per location">
      <div className="flex items-center justify-between gap-3 px-1">
        <b className="text-[16px] tracking-[-0.01em]">Price per location</b>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="h-9 rounded-pill bg-grey-100 px-4 text-[13.5px] font-bold">Apply to all</button>
      </div>
      {open ? (
        <div className="mt-3 flex items-center gap-2 rounded-[16px] border border-grey-200 bg-surface p-2.5" role="group" aria-label="Apply to all locations">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-[12px] bg-grey-100 px-3">
            <span className="font-semibold text-muted">₱</span>
            <input autoFocus inputMode="decimal" aria-label="Price for all locations" placeholder="Price for all" value={all} onChange={(e) => setAll(clean(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") apply(); }} className="w-full bg-transparent text-[16px] font-bold outline-none" />
          </label>
          <Button size="md" pill className="flex-none" disabled={!all.trim()} onClick={apply}>Apply</Button>
        </div>
      ) : null}
      <ul className="mt-3 divide-y divide-grey-200 overflow-hidden rounded-[18px] border border-grey-200 bg-surface">
        {branches.map((b) => {
          const v = draft[b.id] ?? "";
          const edited = v.trim() !== (initial[b.id] ?? "");
          return (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14.5px] font-semibold">{b.name}</b>
                {edited ? <span className="mt-0.5 inline-block rounded-pill bg-[#FFF4D6] px-1.5 text-[11px] font-semibold text-[#8A5A00]">Edited</span> : null}
              </span>
              <label className={`flex h-11 w-[112px] flex-none items-center gap-1 rounded-[12px] border px-3 ${edited ? "border-ink/40" : "border-grey-200"}`}>
                <span className="text-[14px] font-semibold text-muted">₱</span>
                <input inputMode="decimal" aria-label={`${b.name} price`} placeholder={String(basePrice)} value={v}
                  onChange={(e) => setDraft({ ...draft, [b.id]: clean(e.target.value) })} className="w-full bg-transparent text-[15px] font-bold outline-none" />
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
