"use client";

import { Home } from "lucide-react";
import { useState } from "react";
import { Input } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { Sk } from "@/components/common/Skeleton";
import { useHomeService } from "@/lib/home-service";
import type { HomeLocationSettings } from "@/lib/home-service-model";
import { chairBarberName, useShopChairs } from "@/lib/shop-chairs";
import { DAYS, DAY_LABEL, TIME_STEPS, timeLabel } from "@/lib/shop-hours";

/** Small "Home" switch for one service (offered as home service via River Mobile). */
export function HomeToggle({ serviceId, name }: { serviceId: string; name: string }) {
  const home = useHomeService();
  const on = home.offers(serviceId);
  return (
    <button type="button" data-auth="action" role="switch" aria-checked={on} aria-label={`${name} as home service`} onClick={() => home.toggleService(serviceId)}
      className={`inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-[12px] font-bold ${on ? "bg-ink text-on-ink" : "bg-grey-100 text-muted"}`}>
      <Home size={13} strokeWidth={2.2} aria-hidden /> Home
    </button>
  );
}

/** Per-location home-service settings: fee, radius, barbers, days and hours. */
export function HomeServiceCard({ locationId, place }: { locationId: string; place?: string }) {
  const home = useHomeService();
  const { chairs } = useShopChairs({ all: true });
  const saved = home.location(locationId);
  const [draft, setDraft] = useState<HomeLocationSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (!home.ready) return <Sk className="mt-2 h-40 w-full rounded-card" />;
  const d = draft ?? saved;
  const set = (patch: Partial<HomeLocationSettings>) => { setDraft({ ...d, ...patch }); setNote(""); };
  const barbers = chairs.filter((c) => (c.locationId || "home") === locationId && c.active !== false);
  const bid = (c: (typeof chairs)[number]) => c.barberId || c.id;
  return (
    <div className="mt-2 rounded-card bg-surface px-4 py-3.5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0"><b className="block truncate text-[15.5px]">{place || "Home service"}</b><small className="text-[12.5px] font-semibold text-muted">{d.enabled ? `On · ₱${d.fee} fee · up to ${d.radiusKm} km` : "Off"}</small></span>
        <button type="button" data-auth="action" role="switch" aria-checked={d.enabled} aria-label={`Home service at ${place || "this shop"}`} onClick={() => set({ enabled: !d.enabled })}
          className={`relative h-7 w-12 flex-none rounded-full transition-colors ${d.enabled ? "bg-ink" : "bg-grey-200"}`}>
          <span className={`absolute top-0.5 size-6 rounded-full bg-surface shadow transition-all ${d.enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      {d.enabled ? (<>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input label="Home fee (₱)" inputMode="numeric" value={String(d.fee)} onChange={(e) => set({ fee: Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
          <Input label="Max distance (km)" inputMode="decimal" value={String(d.radiusKm)} onChange={(e) => set({ radiusKm: Math.min(50, Math.max(0, Number(e.target.value) || 0)) })} />
        </div>
        <p className="mt-3 text-[12.5px] font-bold">Barbers who do home visits</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {barbers.length ? barbers.map((c) => {
            const on = d.barberIds.includes(bid(c));
            return <button key={c.id} type="button" aria-pressed={on} onClick={() => set({ barberIds: on ? d.barberIds.filter((x) => x !== bid(c)) : [...d.barberIds, bid(c)] })}
              className={`h-8 rounded-pill px-3 text-[12.5px] font-bold ${on ? "bg-ink text-on-ink" : "bg-grey-100"}`}>{chairBarberName(c)}</button>;
          }) : <span className="text-[12.5px] font-semibold text-muted">Add barbers to this location first.</span>}
        </div>
        <p className="mt-1 text-[11.5px] font-semibold text-muted">{d.barberIds.length ? "" : "None picked: any active barber here can take home visits."}</p>
        <p className="mt-3 text-[12.5px] font-bold">Days</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DAYS.map((day) => {
            const on = d.days.includes(day);
            return <button key={day} type="button" aria-pressed={on} onClick={() => set({ days: on ? d.days.filter((x) => x !== day) : [...d.days, day] })}
              className={`h-8 w-11 rounded-pill text-[12.5px] font-bold ${on ? "bg-ink text-on-ink" : "bg-grey-100"}`}>{DAY_LABEL[day]}</button>;
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["from", "to"] as const).map((k) => (
            <label key={k} className="text-[12.5px] font-bold">{k === "from" ? "From" : "Until"}
              <select value={d[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<HomeLocationSettings>)} className="mt-1 block h-11 w-full rounded-[12px] bg-grey-100 px-3 text-[14px] font-semibold">
                {TIME_STEPS.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
              </select>
            </label>
          ))}
        </div>
      </>) : null}
      {draft ? (
        <Button className="mt-3" size="sm" fullWidth data-auth="action" loading={busy} onClick={() => {
          setBusy(true);
          home.saveLocation(locationId, d);
          window.setTimeout(() => { setBusy(false); setDraft(null); setNote("Saved."); }, 500);
        }}>Save home service</Button>
      ) : note ? <p className="mt-2 text-[12.5px] font-semibold text-muted">{note}</p> : null}
    </div>
  );
}
