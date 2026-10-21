"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { BarberIcon } from "@/components/art";
import { Button } from "@/components/common/button";
import { withPrice, type PriceOverrides } from "@/lib/location-prices";
import { useShopLocations } from "@/lib/shop-locations";
import { useShopMenu } from "@/lib/shop-services";
export { draftToOverrides, withPrice } from "@/lib/location-prices";

const pesos = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

/** The shop's services with default prices (Services is the source of truth). */
export function useDefaultServices() {
  const { haircut, treatments } = useShopMenu("master");
  return [{ id: "haircut", name: haircut.name || "Haircut", price: haircut.price ?? 0, icon: haircut.icon }, ...treatments.map((t) => ({ id: t.id, name: t.name, price: t.price ?? 0, icon: t.icon }))];
}

/** "Service prices" for one location (Jimboy, 2026-10-21): each row has its own pencil; Save writes only that row. */
export function ServicePrices({ branchId, overrides }: { branchId: string; overrides?: PriceOverrides }) {
  const services = useDefaultServices();
  const { updateBranch } = useShopLocations();
  const [editId, setEditId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const saved = overrides ?? {};

  async function save(id: string, def: number) {
    const v = value.trim();
    if (v !== "" && !(Number(v) >= 0 && Number(v) <= 100_000)) { setError("Enter a price from ₱0 to ₱100,000, or leave it blank for the default."); return; }
    await new Promise((r) => setTimeout(r, 250));
    updateBranch(branchId, { priceOverrides: withPrice(saved, id, v, def) });
    setEditId(null); setError("");
  }

  return (
    <section className="rounded-card bg-surface px-4 py-4 shadow-card" aria-label="Service prices">
      <b className="text-[16px]">Service prices</b>
      <p className="mt-0.5 text-[12.5px] font-semibold text-muted">Tap the pencil to set a price for this location. Leave it blank to use the default.</p>
      <ul className="mt-3 grid gap-2">
        {services.map((s) => {
          const own = saved[s.id];
          const editing = editId === s.id;
          return (
            <li key={s.id} className="rounded-[14px] bg-grey-100 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <BarberIcon name={s.icon || "clipper"} size={30} />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[14.5px]">{s.name}</b>
                  <span className="text-[12px] font-semibold text-muted">Default {pesos(s.price)}</span>
                </div>
                {editing ? null : (
                  <>
                    {own != null ? (
                      <span className="flex-none text-right"><b className="block text-[15px] tabular-nums">{pesos(own)}</b><span className="text-[11.5px] font-bold text-[#0B7A3E]">This location</span></span>
                    ) : (
                      <span className="flex-none text-[14px] font-semibold text-muted tabular-nums">{pesos(s.price)}</span>
                    )}
                    <button type="button" data-auth="action" aria-label={`Edit ${s.name} price`} onClick={() => { setEditId(s.id); setValue(own != null ? String(own) : ""); setError(""); }}
                      className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-surface"><Pencil size={15} strokeWidth={2} /></button>
                  </>
                )}
              </div>
              {editing ? (
                <div className="mt-2.5">
                  <label className="flex h-11 items-center gap-1 rounded-[12px] bg-surface px-3">
                    <span className="text-[15px] font-bold text-muted">₱</span>
                    <input autoFocus inputMode="decimal" aria-label={`${s.name} price at this location`} placeholder={`${s.price} (default)`}
                      value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))}
                      className="w-full bg-transparent text-[16px] font-bold outline-none" />
                  </label>
                  {error ? <p className="mt-1.5 text-[12.5px] font-semibold text-[#D92D20]" role="alert">{error}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => { setEditId(null); setError(""); }}>Cancel</Button>
                    <Button data-auth="action" size="sm" className="flex-1" onClick={() => save(s.id, s.price)}>Save</Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
