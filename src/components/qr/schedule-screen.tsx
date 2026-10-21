"use client";

import { PayQr } from "./pay-qr";
import { payOptions, type PayChoice } from "./pay-options";
import { Avatar } from "@river-apps/ui";
import { Check, ChevronLeft, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarberIcon, type BarberIconName } from "@/components/art";
import { Button } from "@/components/common/button";
import { Sk } from "@/components/common/skeleton";
import { peso } from "@/lib/format";
import { DAYS, timeLabel, type WeekHours } from "@/lib/shop-hours";
import type { PublicShop } from "./use-public-shop";

const ICONS: BarberIconName[] = ["scissors", "clipper", "pole", "razor", "towel", "ticket", "gift", "qr"];
const icon = (v?: string | null): BarberIconName => (ICONS.includes(v as BarberIconName) ? (v as BarberIconName) : "scissors");

type Barber = { id: string; name: string; photoUrl: string | null };
export type ScheduleRequest = { serviceIds: string[]; barberId?: string; scheduledAt: number; pay: PayChoice; total: number };

/** Manila calendar date (YYYY-MM-DD) `offset` days from today. */
function manilaDay(offset: number) {
  const d = new Date(Date.now() + 8 * 3_600_000 + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
}
const at = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00+08:00`).getTime();
const dayKey = (ymd: string) => DAYS[(new Date(`${ymd}T12:00:00+08:00`).getUTCDay() + 6) % 7]!;
const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
const toHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** 30-minute slots inside that day's opening hours (09:00–20:00 when the shop hasn't set hours). */
function slotsFor(ymd: string, hours?: WeekHours | null): string[] {
  const h = hours?.[dayKey(ymd)];
  if (hours && !h?.open) return [];
  const from = toMin(h?.from || "09:00"), to = toMin(h?.to || "20:00");
  const out: string[] = [];
  for (let m = Math.ceil(from / 30) * 30; m + 30 <= (to <= from ? to + 1440 : to) && m < 1440; m += 30) out.push(toHm(m));
  const soon = Date.now() + 15 * 60_000;
  return out.filter((t) => at(ymd, t) > soon);
}

/** Customer picks services, a barber, a day and a time, then sends a scheduled online booking. */
export function ScheduleScreen({ shop, locationId, onBack, onSend, sending, error }: {
  shop: PublicShop; locationId: string; onBack: () => void; onSend: (r: ScheduleRequest) => void; sending: boolean; error: string;
}) {
  const menu = (locationId && shop.servicesByLocation?.[locationId]) || shop.services;
  const haircut = menu.find((s) => s.kind === "haircut") ?? menu[0];
  const [picked, setPicked] = useState<string[]>(haircut ? [haircut.id] : []);
  const [barbers, setBarbers] = useState<Barber[] | null>(null);
  const [barber, setBarber] = useState<string>("");
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => manilaDay(i)), []);
  const [day, setDay] = useState(days[0]!);
  const [time, setTime] = useState("");
  const [pay, setPay] = useState<PayChoice>("cash");

  useEffect(() => {
    let live = true;
    fetch(`/api/public/shops/${encodeURIComponent(shop.id)}/barbers?loc=${encodeURIComponent(locationId || "home")}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { barbers: [] }))
      .then((d) => { if (live) setBarbers((d.barbers ?? []) as Barber[]); })
      .catch(() => { if (live) setBarbers([]); });
    return () => { live = false; };
  }, [shop.id, locationId]);

  const slots = useMemo(() => slotsFor(day, shop.hoursWeek), [day, shop.hoursWeek]);
  const chosen = menu.filter((s) => picked.includes(s.id));
  const total = chosen.reduce((sum, s) => sum + s.price, 0);
  const ready = chosen.length > 0 && Boolean(time) && slots.includes(time);
  const dayLabel = (ymd: string, i: number) => (i === 0 ? "Today" : i === 1 ? "Tmrw" : new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "short" }));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas pb-8">
      <header className="flex items-center gap-1 border-b border-line bg-surface px-2 py-3">
        <button type="button" onClick={onBack} aria-label="Back" className="inline-flex size-11 flex-none items-center justify-center rounded-full"><ChevronLeft size={24} strokeWidth={2.2} /></button>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-extrabold leading-tight tracking-[-0.02em]">Schedule a visit</h1>
          <p className="truncate text-[12.5px] font-semibold text-muted">{shop.name}{shop.branches.find((b) => b.id === locationId)?.name ? ` · ${shop.branches.find((b) => b.id === locationId)!.name}` : ""}</p>
        </div>
      </header>
      <div className="px-4">
        <p className="mt-5 text-[13px] font-bold">Services</p>
        <ul className="mt-2 flex flex-col gap-2" aria-label="Services">
          {menu.map((s) => {
            const on = picked.includes(s.id);
            return (
              <li key={s.id}>
                <button type="button" aria-pressed={on} onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== s.id) : [...cur, s.id]))}
                  className={`flex w-full items-center gap-3 rounded-[16px] bg-surface px-3 py-2 text-left ${on ? "ring-2 ring-ink" : "ring-1 ring-grey-200"}`}>
                  <BarberIcon name={icon(s.icon)} size={36} title={s.name} />
                  <span className="min-w-0 flex-1 text-[14px] font-bold">{s.name}</span>
                  <span className="text-[13px] font-semibold tabular-nums">{s.price ? peso(s.price) : ""}</span>
                  <span className={`flex size-6 flex-none items-center justify-center rounded-full ${on ? "bg-ink text-on-ink" : "bg-grey-100"}`}>{on ? <Check size={14} strokeWidth={3} /> : null}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 text-[13px] font-bold">Barber</p>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Barber">
          {barbers === null ? [0, 1, 2, 3].map((i) => <span key={i} className="flex w-[76px] flex-none flex-col items-center gap-1.5"><Sk className="size-14 rounded-full" /><Sk className="h-3 w-12" /></span>) : (
            [{ id: "", name: "Any barber", photoUrl: null } as Barber, ...barbers].map((b) => {
              const on = barber === b.id;
              return (
                <button key={b.id || "any"} type="button" role="radio" aria-checked={on} onClick={() => setBarber(b.id)} className="flex w-[76px] flex-none flex-col items-center gap-1.5">
                  <span className={`rounded-full p-0.5 ${on ? "ring-2 ring-ink" : "ring-1 ring-transparent"}`}>
                    {b.id ? <Avatar name={b.name} src={b.photoUrl || undefined} size={52} /> : <span className="flex size-[52px] items-center justify-center rounded-full bg-grey-100"><Users size={22} /></span>}
                  </span>
                  <span className={`w-full truncate text-center text-[12px] ${on ? "font-extrabold" : "font-semibold text-muted"}`}>{b.name}</span>
                </button>
              );
            })
          )}
        </div>

        <p className="mt-5 text-[13px] font-bold">Date</p>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Date">
          {days.map((d, i) => {
            const on = day === d;
            return (
              <button key={d} type="button" role="radio" aria-checked={on} onClick={() => { setDay(d); setTime(""); }}
                className={`flex h-16 w-14 flex-none flex-col items-center justify-center rounded-[14px] ${on ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200"}`}>
                <small className={`text-[11px] font-bold ${on ? "text-on-ink/70" : "text-muted"}`}>{dayLabel(d, i)}</small>
                <b className="text-[18px] tabular-nums">{Number(d.slice(8))}</b>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-[13px] font-bold">Time</p>
        {slots.length ? (
          <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Time">
            {slots.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={time === t} onClick={() => setTime(t)}
                className={`h-10 rounded-[12px] text-[13px] font-bold ${time === t ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200"}`}>{timeLabel(t)}</button>
            ))}
          </div>
        ) : <p className="mt-2 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">No times left on this day. Pick another date.</p>}

        <p className="mt-5 text-[13px] font-bold">How will you pay?</p>
        <div className={`mt-2 grid gap-2 grid-cols-2`} role="radiogroup" aria-label="How will you pay">
          {payOptions(shop).map(([v, label, ic]) => (
            <button key={v} type="button" role="radio" aria-checked={pay === v} onClick={() => setPay(v)}
              className={`flex h-12 items-center justify-center gap-2 rounded-[14px] text-[14.5px] font-bold ${pay === v ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200"}`}>
              {ic} {label}
            </button>
          ))}
        </div>
        {pay === "online" && shop?.payQrUrl ? <PayQr url={shop.payQrUrl} shopName={shop.name} /> : null}
        <p className="mt-1.5 px-1 text-[12px] font-semibold text-muted">{pay === "online" ? (shop?.payQrUrl ? "Pay with the QR, then show the receipt at the shop." : "Pay online at the shop when the cut is done (GCash, Maya or bank QR).") : "You pay at the shop when the cut is done."}</p>

        {error ? <p className="mt-3 text-[13px] font-semibold">{error}</p> : null}
        <Button className="mt-5" fullWidth disabled={!ready || sending} loading={sending}
          onClick={() => onSend({ serviceIds: chosen.map((s) => s.id), barberId: barber || undefined, scheduledAt: at(day, time), pay, total })}>
          {ready ? `Schedule · ${peso(total)}` : chosen.length ? "Pick a time" : "Pick a service"}
        </Button>
      </div>
    </main>
  );
}
