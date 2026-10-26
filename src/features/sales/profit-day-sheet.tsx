"use client";
import { useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { Button } from "@/components/common/button";
import { TransactionSheet } from "@/components/transactions/transaction-sheet";
import { refCode } from "@/lib/chair-bookings";
import { cloudSnapshot, saveBooking } from "@/lib/cloud";
import type { ChairRequest } from "@/lib/booking-types";
import { peso } from "@/lib/format";
import { defaultManualTime, manualRecord } from "@/lib/manual-record";
import { dayClaim, remitKey } from "@/lib/profit-claim";
import { useShopMenu } from "@/lib/shop-services";
import type { ShopChair } from "@/lib/shop-chairs";
import { useRemit } from "./use-remit";

const time = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "");
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const longDay = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", year: "numeric" });

export interface DayTarget { id: string; name: string; locationId: string; locationName: string; day: string }

/** Weekly Profit Report → tap a barber's day: claim that day's cash, see/edit its records, add a missed one. */
export function ProfitDaySheet({ t, rows, chairs, profileHref, onClose }: { t: DayTarget; rows: ChairRequest[]; chairs: ShopChair[]; profileHref: string; onClose: () => void }) {
  const remit = useRemit(t.locationId);
  const [open, setOpen] = useState<ChairRequest | null>(null);
  const [adding, setAdding] = useState(false);
  const records = useMemo(() => rows
    .filter((r) => r.status === "done" && r.completedAt && ymd(r.completedAt) === t.day)
    .filter((r) => { const k = remitKey(r, chairs); return k.id === t.id && k.loc === t.locationId; })
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0)), [rows, chairs, t]);
  const claim = dayClaim(records, chairs, t.id, t.locationId, t.day, (id) => Boolean(remit.claimOf(id)));
  const busy = remit.busy === `${t.id}@${t.locationId}`;
  if (open) return <TransactionSheet row={open} onClose={() => setOpen(null)} />;
  return (
    <BottomSheet title={t.name} subtitle={`${longDay(t.day)}${t.locationName ? ` · ${t.locationName}` : ""}`} onClose={onClose} tall>
      {adding ? <AddRecord t={t} onDone={() => setAdding(false)} /> : (
        <>
          <section aria-label="Claim" className="rounded-[16px] bg-grey-100 px-3.5 py-3">
            <p className="text-[12.5px] font-bold text-muted">Claim · cash from this day</p>
            {claim.owner ? <p className="mt-1 text-[13.5px] font-semibold text-muted">Your own cuts. Nothing to claim.</p>
              : !remit.data ? <p className="mt-1 text-[13.5px] font-semibold text-muted">Loading…</p>
              : claim.open > 0 ? (
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <b className="block text-[24px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(claim.open)}</b>
                    <small className="mt-1 block text-[12px] font-semibold text-muted">Your share of {peso(claim.openCash)} cash · {claim.openCount} cut{claim.openCount === 1 ? "" : "s"}{claim.claimed ? ` · ${peso(claim.claimed)} already claimed` : ""}</small>
                  </span>
                  <Button data-auth="action" size="md" disabled={busy} onClick={() => void remit.claim(t.id, t.locationId, t.day)}>{busy ? "Claiming…" : "Claim"}</Button>
                </div>
              ) : claim.claimed > 0 ? (
                <p className="mt-1 text-[15px] font-bold">Claimed {peso(claim.claimed)} <span className="text-[12.5px] font-semibold text-muted">· {claim.claimedCount} cut{claim.claimedCount === 1 ? "" : "s"}</span></p>
              ) : <p className="mt-1 text-[13.5px] font-semibold text-muted">No unclaimed cash this day.</p>}
            {remit.error ? <p className="mt-1.5 text-[12.5px] font-semibold">{remit.error}</p> : null}
          </section>

          <div className="mt-4 flex items-center justify-between px-1">
            <b className="text-[14.5px]">Records</b>
            <button type="button" onClick={() => setAdding(true)} className="inline-flex h-8 items-center gap-1 rounded-pill bg-ink px-3 text-[12.5px] font-bold text-on-ink"><Plus size={14} strokeWidth={2.4} aria-hidden />Add record</button>
          </div>
          {records.length === 0 ? <p className="mt-2 rounded-[14px] bg-grey-100 px-3 py-4 text-center text-[13px] font-semibold text-muted">No records this day. Add one you missed.</p> : (
            <ul className="mt-1 flex flex-col divide-y divide-line">
              {records.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpen(r)} className="flex w-full items-center gap-3 py-2.5 text-left active:bg-grey-100">
                    <span className="w-[4.2rem] flex-none text-[12.5px] font-semibold tabular-nums text-muted">{time(r.completedAt)}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[14px]">{r.serviceName || "Service"}</b>
                      <small className="block truncate text-[12px] font-semibold text-muted">{[r.customerLabel || "Walk-in", !r.paid ? "Unpaid" : r.payMethod === "gcash" ? "GCash" : r.payMethod === "online" ? "Online" : "Cash", remit.claimOf(r.id) ? "Claimed" : "", r.source === "manual" ? "Added by hand" : ""].filter(Boolean).join(" · ")}</small>
                    </span>
                    <b className="flex-none tabular-nums">{peso(r.price || 0)}</b>
                    <ChevronRight size={16} className="flex-none text-muted" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link href={profileHref} className="mt-4 block text-center text-[13px] font-bold underline decoration-line underline-offset-2">Open {t.name}’s profile for this day</Link>
        </>
      )}
    </BottomSheet>
  );
}

function AddRecord({ t, onDone }: { t: DayTarget; onDone: () => void }) {
  const { haircut, treatments } = useShopMenu(t.locationId);
  const menu = [haircut, ...treatments].filter((m) => m?.name);
  const [picked, setService] = useState("");
  const service = picked || menu[0]?.name || "Haircut";
  // Menu loads after the first render: until the owner types an amount, follow the picked service's menu price.
  const [typed, setPrice] = useState<string | null>(null);
  const price = typed ?? String(menu.find((m) => m.name === service)?.price ?? "");
  const [at, setAt] = useState(defaultManualTime(t.day));
  const [pay, setPay] = useState<"cash" | "gcash" | "unpaid">("cash");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const box = "rounded-[12px] bg-grey-100";
  const field = "h-10 w-full min-w-0 bg-transparent px-3 text-[14.5px] font-semibold outline-none";
  const seg = (on: boolean) => `h-8 flex-1 rounded-[9px] px-2 text-[13px] font-bold ${on ? "bg-surface text-ink shadow-card" : "text-muted"}`;
  const save = () => {
    const r = manualRecord({ day: t.day, time: at, barberId: t.id, barberName: t.name, locationId: t.locationId, serviceName: service, price: Math.round((Number(price) || 0) * 100), payMethod: pay, customerLabel: name, ref: refCode(), shopId: cloudSnapshot().shopId ?? "" });
    if (!(Number(price) > 0)) { setErr("Enter the amount."); return; }
    if ("error" in r) { setErr(r.error ?? ""); return; }
    saveBooking(r.row as ChairRequest);
    onDone();
  };
  return (
    <div>
      <p className="px-1 text-[13px] font-bold">Add record · {longDay(t.day)}</p>
      <p className="px-1 text-[12px] font-semibold text-muted">A finished cut for {t.name}, counted on this day.</p>
      <div className="mt-3 flex gap-2">
        <label className={`flex-1 ${box}`}><span className="sr-only">Date</span><input aria-label="Date" value={t.day} readOnly className={`${field} text-muted`} /></label>
        <label className={`flex-1 ${box}`}><span className="sr-only">Time</span><input aria-label="Time" type="time" value={at} onChange={(e) => setAt(e.target.value)} className={field} /></label>
      </div>
      <div className="mt-2.5 flex gap-2">
        <label className={`min-w-0 flex-[1.4] ${box}`}>
          <span className="sr-only">Service</span>
          <select aria-label="Service" value={service} onChange={(e) => { setService(e.target.value); setPrice(null); }} className={`${field} appearance-none`}>
            {menu.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </label>
        <label className={`flex flex-1 items-center pl-3 ${box}`}><span aria-hidden className="font-bold text-muted">₱</span>
          <input aria-label="Amount (₱)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} className={`${field} pl-1 tabular-nums`} /></label>
      </div>
      <div role="radiogroup" aria-label="Payment" className={`mt-2.5 flex gap-1 p-1 ${box}`}>
        {(["cash", "gcash", "unpaid"] as const).map((p) => <button key={p} type="button" role="radio" aria-checked={pay === p} onClick={() => setPay(p)} className={seg(pay === p)}>{p === "cash" ? "Cash" : p === "gcash" ? "GCash" : "Unpaid"}</button>)}
      </div>
      <label className={`mt-2.5 block ${box}`}><span className="sr-only">Customer name</span><input aria-label="Customer name" value={name} placeholder="Customer name (optional)" onChange={(e) => setName(e.target.value)} className={field} /></label>
      {err ? <p className="mt-2 px-1 text-[12.5px] font-semibold">{err}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button data-auth="action" onClick={save}>Save record</Button>
      </div>
    </div>
  );
}
