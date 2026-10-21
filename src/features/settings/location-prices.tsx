"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { setLocationPrices, useShopLocations } from "@/lib/shop-locations";
import { draftFromBranches, planLocationSave } from "@/lib/location-prices";
import { useShopMenu } from "@/lib/shop-services";
export { draftToOverrides, withPrice } from "@/lib/location-prices";

/** The shop's services with default prices (Services is the source of truth). */
export function useDefaultServices() {
  const { haircut, treatments } = useShopMenu("master");
  return [{ id: "haircut", name: haircut.name || "Haircut", price: haircut.price ?? 0, icon: haircut.icon }, ...treatments.map((t) => ({ id: t.id, name: t.name, price: t.price ?? 0, icon: t.icon }))];
}

/** Draft prices per location for one service. `save(newDef)` writes edited rows, and pins untouched default rows to the old default. */
export function useLocationDraft(serviceId: string, savedDefault: number) {
  const { branches } = useShopLocations();
  const initial = draftFromBranches(branches, serviceId, savedDefault);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const current = { ...initial, ...(draft ?? {}) };
  return {
    branches,
    initial,
    draft: current,
    setDraft: (d: Record<string, string>) => setDraft(d),
    save: (newDef: number) => { setLocationPrices(serviceId, planLocationSave(branches, serviceId, savedDefault, newDef, current, initial), newDef); setDraft(null); },
  };
}

const clean = (v: string) => v.replace(/[^\d.]/g, "").slice(0, 8);

/** Edit service › Price per location: a price box per location (blank = uses default), checkboxes to set several at once. */
export function LocationPriceInputs({ defaultPrice, draft, setDraft, branches, initial }: {
  initial: Record<string, string>; defaultPrice: number; draft: Record<string, string>; setDraft: (d: Record<string, string>) => void; branches: { id: string; name: string; area?: string }[];
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [bulk, setBulk] = useState("");
  const shown = q.trim() ? branches.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase())) : branches;
  const allOn = shown.length > 0 && shown.every((b) => picked.includes(b.id));
  const apply = (v: string) => { setDraft({ ...draft, ...Object.fromEntries(picked.map((id) => [id, v])) }); setPicked([]); setBulk(""); };
  const toggleAll = () => setPicked(allOn ? picked.filter((id) => !shown.some((b) => b.id === id)) : [...new Set([...picked, ...shown.map((b) => b.id)])]);
  return (
    <section className="mt-7" aria-label="Price per location">
      <div className="flex items-end justify-between gap-3 px-1">
        <span className="min-w-0">
          <b className="block text-[16px] tracking-[-0.01em]">Price per location</b>
          <span className="mt-0.5 block text-[12.5px] font-medium text-muted">Each box shows what that location charges now. Only locations you change or select get a new price.</span>
        </span>
        <span className="flex-none rounded-pill bg-grey-100 px-2.5 py-1 text-[12px] font-bold text-muted">{(() => { const n = branches.filter((b) => (draft[b.id] ?? "").trim() !== (initial[b.id] ?? "")).length; return n ? `${n} changed` : "No changes"; })()}</span>
      </div>
      {branches.length >= 6 ? (
        <label className="mt-3 flex h-11 items-center gap-2 rounded-pill bg-grey-100 px-4">
          <Search size={16} className="flex-none text-muted" aria-hidden />
          <input aria-label="Search locations" placeholder="Search locations" value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-transparent text-[15px] font-medium outline-none" />
        </label>
      ) : null}
      {picked.length ? (
        <div className="sticky top-2 z-10 mt-3 rounded-[18px] bg-ink p-3.5 text-on-ink shadow-card" role="group" aria-label="Set price for selected locations">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[14px]">Set price for {picked.length} location{picked.length === 1 ? "" : "s"}</b>
            <button type="button" onClick={() => setPicked([])} className="text-[12.5px] font-semibold text-on-ink/70">Clear selection</button>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-[12px] bg-white/12 px-3">
              <span className="font-bold text-on-ink/70">₱</span>
              <input inputMode="decimal" aria-label="Price for the selected locations" placeholder={String(defaultPrice)} value={bulk} onChange={(e) => setBulk(clean(e.target.value))} className="w-full bg-transparent text-[16px] font-bold outline-none placeholder:text-on-ink/40" />
            </label>
            <button type="button" disabled={!bulk.trim()} onClick={() => apply(bulk.trim())} className="h-11 flex-none rounded-pill bg-white px-5 text-[14px] font-bold text-ink disabled:opacity-40">Apply</button>
          </div>
          <button type="button" onClick={() => apply("")} className="mt-2.5 text-[12.5px] font-semibold text-on-ink/80 underline underline-offset-[3px]">Use the default price (₱{defaultPrice}) for these</button>
        </div>
      ) : null}
      <div className="mt-3 overflow-hidden rounded-[18px] border border-grey-200 bg-surface">
        <label className="flex items-center gap-3 border-b border-grey-200 bg-grey-100/60 px-4 py-2.5 text-[13px] font-semibold text-muted">
          <input type="checkbox" checked={allOn} onChange={toggleAll} className="size-[18px] accent-[#0A0A0A]" />
          Select all{q.trim() ? " shown" : ""}
          <span className="ml-auto">{shown.length} location{shown.length === 1 ? "" : "s"}</span>
        </label>
        <ul className="divide-y divide-grey-200">
          {shown.map((b) => {
            const v = draft[b.id] ?? "";
            const edited = v.trim() !== (initial[b.id] ?? "");
            const custom = v.trim() !== "";
            const on = picked.includes(b.id);
            return (
              <li key={b.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${on ? "bg-grey-100" : ""}`}>
                <input type="checkbox" aria-label={`Select ${b.name}`} checked={on} onChange={() => setPicked(on ? picked.filter((id) => id !== b.id) : [...picked, b.id])} className="size-[18px] flex-none accent-[#0A0A0A]" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14.5px] font-semibold">{b.name}</b>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold">
                    <span className={edited ? "text-[#0B7A3E]" : "text-muted"}>{edited ? (custom ? `Was ₱${initial[b.id]}` : `Will use default ₱${defaultPrice}`) : "Current price"}</span>
                    {edited ? <span className="rounded-pill bg-[#FFF4D6] px-1.5 text-[11px] text-[#8A5A00]">Edited</span> : null}
                  </span>
                </span>
                <label className={`flex h-10 w-[104px] flex-none items-center gap-1 rounded-[12px] border px-2.5 ${edited ? "border-ink/40 bg-surface" : "border-grey-200 bg-surface"}`}>
                  <span className="text-[14px] font-semibold text-muted">₱</span>
                  <input inputMode="decimal" aria-label={`${b.name} price`} placeholder={String(defaultPrice)} value={v}
                    onChange={(e) => setDraft({ ...draft, [b.id]: clean(e.target.value) })} className="w-full bg-transparent text-[15px] font-bold outline-none placeholder:font-semibold placeholder:text-muted/70" />
                </label>
              </li>
            );
          })}
          {shown.length === 0 ? <li className="px-4 py-5 text-center text-[13px] font-semibold text-muted">No location matches “{q}”.</li> : null}
        </ul>
      </div>
    </section>
  );
}
