"use client";
import { Mail, MapPin, Pencil, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import { FullScreen } from "@/components/shell/full-screen";
import { BarberPortrait } from "@/features/settings/seat-list";
import { manilaDay, useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { sharePct, splitIncome, tipOf } from "@/lib/income-split";
import { chairBarberName, removeChair, saveChair, useShopChairs } from "@/lib/shop-chairs";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { Back, ChairEditor, ShareBarberLink } from "./services-screen";

/**
 * Full-screen barber profile (Jimboy, 2026-10-21), opened by tapping a barber's name. Details, income split,
 * this week's numbers, the link, and Edit details (name, photo, contact, share %, location).
 */
export function BarberProfile({ chairId, onClose }: { chairId: string; onClose: () => void }) {
  const { chairs } = useShopChairs({ all: true });
  const shops = useShopLocations();
  const { rows } = useChairRequests();
  const chair = chairs.find((c) => c.id === chairId);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const myId = chair ? chair.barberId || chair.id : "";
  const holder = chair ? rows.find((r) => r.status === "in_chair" && r.chairLabel === chair.label && (r.locationId || HOME_LOCATION_ID) === (chair.locationId || HOME_LOCATION_ID)) : undefined;
  const week = useMemo(() => {
    if (!chair) return { cuts: 0, sales: 0, tips: 0, today: 0 };
    const since = Date.now() - 7 * 86_400_000;
    const today = manilaDay(Date.now());
    const mine = rows.filter((r) => r.status === "done" && (r.completedAt ?? 0) >= since && (r.barberId ? r.barberId === myId : r.seatLabel === chair.label));
    return { cuts: mine.length, sales: mine.reduce((s, r) => s + (r.price || 0), 0), tips: mine.reduce((s, r) => s + tipOf(r), 0), today: mine.filter((r) => manilaDay(r.completedAt ?? 0) === today).length };
  }, [rows, chair, myId]);
  if (!chair) return <FullScreen><Back title="Barber profile" onBack={onClose} /><p className="mt-4 text-[14px] font-semibold text-muted">This barber was removed.</p></FullScreen>;
  const name = chairBarberName(chair);
  const pct = sharePct(chair);
  const split = splitIncome(week.sales, pct);
  const place = shops.branches.find((b) => b.id === (chair.locationId || HOME_LOCATION_ID))?.name;

  if (editing) {
    return (
      <ChairEditor chair={chair} fresh={false} inService={Boolean(holder)} onBack={() => setEditing(false)}
        onSave={(next) => { const e = saveChair(next); if (!e) { setEditing(false); setNote("Saved."); } return e; }}
        onRemove={() => {
          if (holder) return `${name} is with a customer. Finish that cut before removing.`;
          const e = removeChair(chair.id);
          if (!e) onClose();
          return e;
        }} />
    );
  }
  return (
    <FullScreen>
      <Back title="Barber profile" onBack={onClose} />
      {note ? <p className="mt-3 rounded-[16px] bg-grey-100 px-4 py-2.5 text-[13.5px] font-semibold" role="status">{note}</p> : null}
      <section className="mt-4 flex flex-col items-center rounded-card bg-surface px-4 pb-4 pt-5 text-center shadow-card">
        <BarberPortrait chair={chair} size={88} />
        <h2 className="mt-3 text-[22px] font-extrabold tracking-[-0.02em]">{name}</h2>
        <p className="mt-0.5 flex items-center gap-1 text-[13.5px] font-semibold text-muted">
          {shops.enabled && place ? <><MapPin size={14} aria-hidden />{place} · </> : null}
          {chair.active === false ? "Inactive" : holder ? "In service now" : "Available"}
        </p>
        <div className="mt-3 flex gap-2">
          <ShareBarberLink id={chair.id} name={name} />
          <button type="button" data-auth="action" onClick={() => setEditing(true)} className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-grey-100 px-3.5 text-[13px] font-bold"><Pencil size={14} strokeWidth={2.2} />Edit details</button>
        </div>
      </section>

      <section aria-label="Income split" className="mt-3 rounded-card bg-ink px-4 py-4 text-on-ink">
        <div className="flex items-baseline justify-between"><b className="text-[15px]">Income split</b><span className="text-[13px] font-bold">{pct}% barber · {100 - pct}% shop</span></div>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/15" aria-hidden><span className="h-full bg-[#22c55e]" style={{ width: `${pct}%` }} /></div>
        <p className="mt-2 text-[12.5px] font-semibold text-on-ink-muted">Last 7 days: {peso(week.sales)} sales · barber {peso(split.barber)} · shop {peso(split.shop)}{week.tips ? ` · tips ${peso(week.tips)} (all barber)` : ""}</p>
      </section>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[["Today", String(week.today)], ["7-day cuts", String(week.cuts)], ["7-day sales", peso(week.sales)]].map(([k, v]) => (
          <div key={k} className="rounded-[16px] bg-surface px-3 py-2.5 shadow-card"><p className="text-[12px] font-semibold text-muted">{k}</p><b className="text-[16px] tabular-nums">{v}</b></div>
        ))}
      </div>

      <section className="mt-3 rounded-card bg-surface px-4 py-2 shadow-card" aria-label="Contact">
        <p className="flex items-center gap-2 border-b border-line py-2.5 text-[14px] font-semibold"><Phone size={16} className="text-muted" aria-hidden />{chair.phone || <span className="text-muted">No mobile number</span>}</p>
        <p className="flex items-center gap-2 py-2.5 text-[14px] font-semibold"><Mail size={16} className="text-muted" aria-hidden />{chair.email || <span className="text-muted">No email</span>}</p>
      </section>
    </FullScreen>
  );
}
