"use client";
import { Pencil } from "lucide-react";
import { BarberIcon } from "@/components/art";
import { type PriceOverrides } from "@/lib/location-prices";
export { draftToOverrides } from "@/lib/location-prices";
import { useShopMenu } from "@/lib/shop-services";

const pesos = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

/** The shop's services with default prices (Services is the source of truth). */
export function useDefaultServices() {
  const { haircut, treatments } = useShopMenu("master");
  return [{ id: "haircut", name: haircut.name || "Haircut", price: haircut.price ?? 0, icon: haircut.icon }, ...treatments.map((t) => ({ id: t.id, name: t.name, price: t.price ?? 0, icon: t.icon }))];
}

/** "Service prices" for one location: read-only until Edit; the parent's Save writes it. */
export function ServicePrices({ overrides, draft, setDraft, editing, setEditing, disabled }: {
  overrides?: PriceOverrides; draft?: Record<string, string>; setDraft?: (d: Record<string, string>) => void;
  editing?: boolean; setEditing?: (v: boolean) => void; disabled?: boolean;
}) {
  const services = useDefaultServices();
  const canEdit = Boolean(setDraft && setEditing);
  return (
    <section className="rounded-card bg-surface px-4 py-4 shadow-card" aria-label="Service prices">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="text-[16px]">Service prices</b>
          <p className="mt-0.5 text-[12.5px] font-semibold text-muted">Set a different price for this location. Leave blank to use the default.</p>
        </div>
        {canEdit && !editing ? (
          <button type="button" data-auth="action" onClick={() => setEditing!(true)} disabled={disabled} aria-label="Edit service prices"
            className="inline-flex h-9 flex-none items-center gap-1.5 rounded-pill bg-grey-100 px-3 text-[13px] font-bold"><Pencil size={15} strokeWidth={2} />Edit</button>
        ) : null}
      </div>
      <ul className="mt-3 grid gap-2">
        {services.map((s) => {
          const own = overrides?.[s.id];
          return (
            <li key={s.id} className="flex items-center gap-3 rounded-[14px] bg-grey-100 px-3 py-2.5">
              <BarberIcon name={s.icon || "clipper"} size={30} />
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[14.5px]">{s.name}</b>
                <span className="text-[12px] font-semibold text-muted">Default {pesos(s.price)}</span>
              </div>
              {editing && canEdit ? (
                <label className="flex h-10 w-[112px] flex-none items-center gap-1 rounded-[12px] bg-surface px-2.5">
                  <span className="text-[14px] font-bold text-muted">₱</span>
                  <input inputMode="decimal" aria-label={`${s.name} price at this location`} placeholder={String(s.price)} disabled={disabled}
                    value={draft?.[s.id] ?? ""} onChange={(e) => setDraft!({ ...(draft ?? {}), [s.id]: e.target.value.replace(/[^\d.]/g, "").slice(0, 8) })}
                    className="w-full bg-transparent text-[15px] font-bold outline-none" />
                </label>
              ) : own != null ? (
                <span className="flex-none text-right"><b className="block text-[15px]">{pesos(own)}</b><span className="text-[11.5px] font-bold text-[#0B7A3E]">This location</span></span>
              ) : (
                <span className="flex-none text-[14px] font-semibold text-muted">{pesos(s.price)}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
