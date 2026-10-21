"use client";
import { useState } from "react";
import { Pencil, Search } from "lucide-react";
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

/** One price row: shows the price (muted default or a Custom tag) with a pencil; the pencil opens an inline input. */
export function PriceEditRow({ title, sub, icon, own, def, onSave }: {
  title: string; sub?: string; icon?: string; own?: number; def: number; onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  async function save() {
    const v = value.trim();
    if (v !== "" && !(Number(v) >= 0 && Number(v) <= 100_000)) { setError("Enter a price from ₱0 to ₱100,000, or leave it blank for the default."); return; }
    await new Promise((r) => setTimeout(r, 250));
    onSave(v); setEditing(false); setError("");
  }
  return (
    <li className="rounded-[14px] bg-grey-100 px-3 py-2.5">
      <div className="flex items-center gap-3">
        {icon ? <BarberIcon name={icon as never} size={30} /> : null}
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[14.5px]">{title}</b>
          {sub ? <span className="block truncate text-[12px] font-semibold text-muted">{sub}</span> : null}
        </div>
        {editing ? null : (
          <>
            {own != null ? (
              <span className="flex-none text-right"><b className="block text-[15px] tabular-nums">{pesos(own)}</b><span className="text-[11.5px] font-bold text-[#0B7A3E]">Custom</span></span>
            ) : (
              <span className="flex-none text-right"><span className="block text-[14px] font-semibold text-muted tabular-nums">{pesos(def)}</span><span className="text-[11.5px] font-semibold text-muted">Default</span></span>
            )}
            <button type="button" data-auth="action" aria-label={`Edit ${title} price`} onClick={() => { setEditing(true); setValue(own != null ? String(own) : ""); setError(""); }}
              className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-surface"><Pencil size={15} strokeWidth={2} /></button>
          </>
        )}
      </div>
      {editing ? (
        <div className="mt-2.5">
          <label className="flex h-11 items-center gap-1 rounded-[12px] bg-surface px-3">
            <span className="text-[15px] font-bold text-muted">₱</span>
            <input autoFocus inputMode="decimal" aria-label={`${title} price`} placeholder={`${def} (default)`}
              value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))}
              className="w-full bg-transparent text-[16px] font-bold outline-none" />
          </label>
          {error ? <p className="mt-1.5 text-[12.5px] font-semibold text-[#D92D20]" role="alert">{error}</p> : null}
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => { setEditing(false); setError(""); }}>Cancel</Button>
            <Button data-auth="action" size="sm" className="flex-1" onClick={save}>Save</Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Services › Edit: one service's price at every location (same storage as Manage shop › Service prices). */
export function LocationPriceList({ serviceId, defaultPrice }: { serviceId: string; defaultPrice: number }) {
  const { branches, updateBranch } = useShopLocations();
  const [q, setQ] = useState("");
  const shown = q.trim() ? branches.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase())) : branches;
  return (
    <section className="mt-7" aria-label="Price per location">
      <b className="block px-1 text-[15px]">Price per location</b>
      <p className="mt-0.5 px-1 text-[12.5px] font-semibold text-muted">Saved right away. Leave blank to use the default price.</p>
      {branches.length >= 6 ? (
        <label className="mt-3 flex h-11 items-center gap-2 rounded-pill bg-grey-100 px-4">
          <Search size={16} className="flex-none text-muted" aria-hidden />
          <input aria-label="Search locations" placeholder="Search locations" value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-transparent text-[15px] font-medium outline-none" />
        </label>
      ) : null}
      <ul className="mt-3 grid gap-2">
        {shown.map((b) => (
          <PriceEditRow key={b.id} title={b.name} sub={b.area || undefined} own={b.priceOverrides?.[serviceId]} def={defaultPrice}
            onSave={(v) => updateBranch(b.id, { priceOverrides: withPrice(b.priceOverrides ?? {}, serviceId, v, defaultPrice) })} />
        ))}
        {shown.length === 0 ? <li className="rounded-[14px] bg-grey-100 px-3 py-4 text-center text-[13px] font-semibold text-muted">No location matches “{q}”.</li> : null}
      </ul>
    </section>
  );
}

/** "Service prices" for one location (Manage shop): each row has its own pencil; Save writes only that row. */
export function ServicePrices({ branchId, overrides }: { branchId: string; overrides?: PriceOverrides }) {
  const services = useDefaultServices();
  const { updateBranch } = useShopLocations();
  const saved = overrides ?? {};
  return (
    <section className="rounded-card bg-surface px-4 py-4 shadow-card" aria-label="Service prices">
      <b className="text-[16px]">Service prices</b>
      <p className="mt-0.5 text-[12.5px] font-semibold text-muted">Tap the pencil to set a price for this location. Leave it blank to use the default.</p>
      <ul className="mt-3 grid gap-2">
        {services.map((s) => (
          <PriceEditRow key={s.id} title={s.name} sub={`Default ${pesos(s.price)}`} icon={s.icon || "clipper"} own={saved[s.id]} def={s.price}
            onSave={(v) => updateBranch(branchId, { priceOverrides: withPrice(saved, s.id, v, s.price) })} />
        ))}
      </ul>
    </section>
  );
}
