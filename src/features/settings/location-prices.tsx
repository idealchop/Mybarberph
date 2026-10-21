"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { setLocationPrices, useShopLocations } from "@/lib/shop-locations";
import { changedLocationPrices, draftFromBranches } from "@/lib/location-prices";
import { useShopMenu } from "@/lib/shop-services";
export { draftToOverrides, withPrice } from "@/lib/location-prices";

/** The shop's services with default prices (Services is the source of truth). */
export function useDefaultServices() {
  const { haircut, treatments } = useShopMenu("master");
  return [{ id: "haircut", name: haircut.name || "Haircut", price: haircut.price ?? 0, icon: haircut.icon }, ...treatments.map((t) => ({ id: t.id, name: t.name, price: t.price ?? 0, icon: t.icon }))];
}

/** Draft prices per location for one service; `save(def)` writes only the boxes that changed. */
export function useLocationDraft(serviceId: string) {
  const { branches } = useShopLocations();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const current = draft ?? draftFromBranches(branches, serviceId);
  return {
    branches,
    draft: current,
    setDraft: (d: Record<string, string>) => setDraft(d),
    changed: changedLocationPrices(branches, serviceId, current).length,
    save: (def: number) => { setLocationPrices(serviceId, changedLocationPrices(branches, serviceId, current), def); setDraft(null); },
  };
}

const clean = (v: string) => v.replace(/[^\d.]/g, "").slice(0, 8);

/** Edit service › Price per location: a price box per location (blank = uses default), checkboxes to set several at once. */
export function LocationPriceInputs({ defaultPrice, draft, setDraft, branches }: {
  defaultPrice: number; draft: Record<string, string>; setDraft: (d: Record<string, string>) => void; branches: { id: string; name: string; area?: string }[];
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [bulk, setBulk] = useState("");
  const shown = q.trim() ? branches.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase())) : branches;
  const allOn = shown.length > 0 && shown.every((b) => picked.includes(b.id));
  const apply = (v: string) => { setDraft({ ...draft, ...Object.fromEntries(picked.map((id) => [id, v])) }); setPicked([]); setBulk(""); };
  return (
    <section className="mt-6" aria-label="Price per location">
      <b className="block px-1 text-[15px]">Price per location</b>
      <p className="mt-0.5 px-1 text-[12.5px] font-semibold text-muted">Leave a box blank to use the default price (₱{defaultPrice.toLocaleString("en-PH")}).</p>
      {branches.length >= 6 ? (
        <label className="mt-3 flex h-11 items-center gap-2 rounded-pill bg-grey-100 px-4">
          <Search size={16} className="flex-none text-muted" aria-hidden />
          <input aria-label="Search locations" placeholder="Search locations" value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-transparent text-[15px] font-medium outline-none" />
        </label>
      ) : null}
      <label className="mt-3 flex items-center gap-2.5 px-1 text-[13.5px] font-bold">
        <input type="checkbox" checked={allOn} onChange={() => setPicked(allOn ? picked.filter((id) => !shown.some((b) => b.id === id)) : [...new Set([...picked, ...shown.map((b) => b.id)])])} className="size-5 accent-[#0A0A0A]" />
        Select all{q.trim() ? " shown" : ""}
      </label>
      {picked.length ? (
        <div className="sticky top-2 z-10 mt-2 rounded-[16px] bg-ink px-3 py-3 text-on-ink shadow-card" role="group" aria-label="Set price for selected locations">
          <b className="block text-[13.5px]">Set price for {picked.length} location{picked.length === 1 ? "" : "s"}</b>
          <div className="mt-2 flex items-center gap-2">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-1 rounded-[12px] bg-white/12 px-3">
              <span className="font-bold text-on-ink/70">₱</span>
              <input inputMode="decimal" aria-label="Price for the selected locations" placeholder={String(defaultPrice)} value={bulk} onChange={(e) => setBulk(clean(e.target.value))} className="w-full bg-transparent text-[15px] font-bold outline-none placeholder:text-on-ink/50" />
            </label>
            <button type="button" disabled={!bulk.trim()} onClick={() => apply(bulk.trim())} className="h-10 flex-none rounded-pill bg-white px-4 text-[13.5px] font-bold text-ink disabled:opacity-50">Apply</button>
          </div>
          <button type="button" onClick={() => apply("")} className="mt-2 text-[12.5px] font-bold text-on-ink/80 underline underline-offset-[3px]">Use default for these</button>
        </div>
      ) : null}
      <ul className="mt-2 grid gap-2">
        {shown.map((b) => {
          const v = draft[b.id] ?? "";
          const custom = v.trim() !== "" && Number(v) !== defaultPrice;
          const on = picked.includes(b.id);
          return (
            <li key={b.id} className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 ${on ? "bg-grey-200" : "bg-grey-100"}`}>
              <input type="checkbox" aria-label={`Select ${b.name}`} checked={on} onChange={() => setPicked(on ? picked.filter((id) => id !== b.id) : [...picked, b.id])} className="size-5 flex-none accent-[#0A0A0A]" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14.5px]">{b.name}</b>
                <span className={`text-[12px] font-bold ${custom ? "text-[#0B7A3E]" : "text-muted"}`}>{custom ? "Custom" : "Uses default"}</span>
              </span>
              <label className="flex h-10 w-[104px] flex-none items-center gap-1 rounded-[12px] bg-surface px-2.5">
                <span className="text-[14px] font-bold text-muted">₱</span>
                <input inputMode="decimal" aria-label={`${b.name} price`} placeholder={String(defaultPrice)} value={v}
                  onChange={(e) => setDraft({ ...draft, [b.id]: clean(e.target.value) })} className="w-full bg-transparent text-[15px] font-bold outline-none" />
              </label>
            </li>
          );
        })}
        {shown.length === 0 ? <li className="rounded-[14px] bg-grey-100 px-3 py-4 text-center text-[13px] font-semibold text-muted">No location matches “{q}”.</li> : null}
      </ul>
    </section>
  );
}
