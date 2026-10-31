"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Pencil, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { Button } from "@/components/common/button";
import { RiverIcon } from "@/components/common/river-icon";
import { TransactionSheet } from "@/components/transactions/transaction-sheet";
import { refCode, useChairRequests } from "@/lib/chair-bookings";
import { mergeLiveRows } from "@/lib/cut-count";
import { api } from "@/lib/cloud";
import { cloudSnapshot, saveBooking } from "@/lib/cloud";
import type { ChairRequest } from "@/lib/booking-types";
import { peso } from "@/lib/format";
import { defaultManualTime, manualRecord } from "@/lib/manual-record";
import { dayClaim, remitKey } from "@/lib/profit-claim";
import { ownerPart } from "@/lib/split-view";
import { useShopMenu } from "@/lib/shop-services";
import type { ShopChair } from "@/lib/shop-chairs";
import { cn } from "@river-apps/ui";
import { useRemit } from "./use-remit";
import { isClaimable } from "@/lib/claim-rule";
import { claimAdjust, dayAdjustment, parseClaimAmount } from "@/lib/claim-adjust";
import { ClaimTag } from "@/components/transactions/claim-tag";

const time = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "");
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const longDay = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** One barber's day from the server (same function as the barber link's History). */
function useBarberDay(t: DayTarget) {
  const [rows, setRows] = useState<ChairRequest[] | null>(null);
  useEffect(() => {
    let off = false;
    const pull = () => void (api(`/api/shop/barber-day?barberId=${encodeURIComponent(t.id)}&loc=${encodeURIComponent(t.locationId)}&date=${t.day}`) as Promise<{ rows: ChairRequest[] }>)
      .then((d) => { if (!off) setRows(d.rows); }).catch(() => {});
    pull();
    const iv = window.setInterval(() => { if (document.visibilityState === "visible") pull(); }, 20_000);
    return () => { off = true; window.clearInterval(iv); };
  }, [t.id, t.locationId, t.day]);
  return rows;
}


export interface DayTarget { id: string; name: string; locationId: string; locationName: string; day: string }

/** Barber face (photo when the shop added one) or initials, River style. */
function Face({ photo, size = 44 }: { name: string; photo?: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (photo) return <img src={photo} alt="" className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />;
  return <span aria-hidden className="flex flex-none items-center justify-center rounded-full bg-ink text-on-ink" style={{ width: size, height: size }}><UserRound size={Math.round(size * 0.5)} aria-hidden /></span>;
}

/** Weekly Profit Report → tap a barber's day: claim that day's cash, see/edit its records, add a missed one. */
export function ProfitDaySheet({ t, rows, chairs, profileHref, onClose }: { t: DayTarget; rows: ChairRequest[]; chairs: ShopChair[]; profileHref: string; onClose: () => void }) {
  const remit = useRemit(t.locationId);
  const [open, setOpen] = useState<ChairRequest | null>(null);
  const [adding, setAdding] = useState(false);
  const add = useAddRecord(t, () => setAdding(false));
  const photo = chairs.find((c) => (c.barberId === t.id || c.id === t.id) && (c.locationId || "home") === t.locationId)?.photoUrl;
  // Same server source as the barber link History (barberDayCuts), merged with live edits; then the shared rule.
  const server = useBarberDay(t);
  const live = useChairRequests().rows;
  const source = useMemo(() => (server ? mergeLiveRows(server, live) : rows), [server, live, rows]);
  const records = useMemo(() => source
    .filter((r) => r.status === "done" && r.completedAt && ymd(r.completedAt) === t.day)
    .filter((r) => { const k = remitKey(r, chairs); return k.id === t.id && k.loc === t.locationId; })
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0)), [source, chairs, t]);
  const claim = dayClaim(records, chairs, t.id, t.locationId, t.day, (r) => Boolean(remit.claimOf(r.id)));
  const busy = remit.busy === `${t.id}@${t.locationId}`;
  // Owner sees only their split (split-view.ts), never the full sales.
  const dayTotal = records.reduce((s, r) => s + ownerPart(r, chairs), 0);
  const allClaimed = !claim.owner && claim.open === 0 && claim.claimed > 0;
  // Editable claim (v1.0.34): owner enters the actual amount received; sales records are never touched.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [received, setReceived] = useState<number | null>(null);
  const [openSeen, setOpenSeen] = useState(claim.open);
  if (openSeen !== claim.open) { setOpenSeen(claim.open); setReceived(null); setEditing(false); }
  const adj = claimAdjust(claim.open, received);
  const draftValue = parseClaimAmount(draft);
  const startEdit = () => { setDraft(String(adj.received)); setEditing(true); };
  const saveEdit = () => { if (draftValue === null) return; setReceived(draftValue); setEditing(false); };
  const doClaim = () => remit.claim(t.id, t.locationId, t.day, records.filter((r) => isClaimable(r) && !remit.claimOf(r.id)).map((r) => r.id), adj.adjusted ? { expected: adj.expected, received: adj.received } : undefined);
  const claimedAdj = dayAdjustment(records.map((r) => remit.claimOf(r.id)).filter((c): c is NonNullable<typeof c> => Boolean(c)));
  const claimedShown = claimedAdj ? claim.claimed - claimedAdj.expected + claimedAdj.received : claim.claimed;
  if (open) return <TransactionSheet row={open} onClose={() => setOpen(null)} />;

  return (
    <BottomSheet title={adding ? "Add record" : t.name} subtitle={adding ? `${t.name}${t.locationName ? ` · ${t.locationName}` : ""}` : `${longDay(t.day)}${t.locationName ? ` · ${t.locationName}` : ""}`}
      onClose={adding ? () => setAdding(false) : onClose} tall
      footer={adding ? (
        <div className="flex flex-col items-stretch gap-1">
          <Button data-auth="action" fullWidth loading={add.saving} onClick={add.save} className="!h-14 !text-[16px]">
            Save record{add.amount > 0 ? ` · ${peso(add.amount)}` : ""}
          </Button>
          <button type="button" onClick={() => setAdding(false)} className="h-11 text-[14px] font-bold text-ink-2">Cancel</button>
        </div>
      ) : undefined}>
      {adding ? <AddRecordForm t={t} photo={photo} f={add} /> : (
        <div className="flex flex-col gap-5 pb-2 pt-1">
          <section aria-label="Claim" className={cn("rounded-[22px] px-4 pb-4 pt-3.5", allClaimed ? "bg-[#0F7A45] text-white" : "bg-ink text-on-ink")}>
            <div className="flex items-center justify-between gap-3">
              <p className={cn("text-[12.5px] font-semibold", allClaimed ? "text-white/75" : "text-on-ink-muted")}>{allClaimed ? "Claimed this day" : "To claim"}</p>
              {claim.owner || !remit.data ? null : allClaimed ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-white/20 px-2.5 text-[11.5px] font-bold text-white"><Check size={12} strokeWidth={3} aria-hidden />All claimed</span>
              ) : claim.open > 0 ? (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-pill bg-[#FFF1D6] px-2.5 text-[11.5px] font-bold text-[#8A5A00]"><i aria-hidden className="size-1.5 rounded-full bg-[#D97706]" />To claim</span>
              ) : null}
            </div>
            {claim.owner ? <p className="mt-1.5 text-[15px] font-bold">Your own haircuts. Nothing to claim.</p>
              : !remit.data ? <p className="mt-1.5 text-[15px] font-bold text-on-ink-muted">Loading…</p>
              : (
                <>
                  {claim.open > 0 && editing ? (
                    <div className="mt-1.5">
                      <label className="flex h-14 items-center gap-1 rounded-[16px] bg-white/10 px-3.5 ring-2 ring-white/60 focus-within:ring-white">
                        <span className="text-[26px] font-extrabold text-on-ink-muted">₱</span>
                        <input autoFocus inputMode="decimal" aria-label="Amount received" value={draft}
                          onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ""))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(false); }}
                          className="min-w-0 flex-1 bg-transparent text-[30px] font-extrabold tabular-nums tracking-[-0.03em] text-on-ink outline-none" />
                      </label>
                      <p className="mt-2 text-[12px] font-semibold text-on-ink-muted">{draftValue === null ? "Enter a valid amount" : `Expected ${peso(adj.expected)} from the records`}</p>
                      <Button data-auth="action" variant="white" size="md" pill fullWidth className="mt-3" disabled={draftValue === null} onClick={saveEdit}>Save</Button>
                      <button type="button" onClick={() => setEditing(false)} className="mt-1 h-10 w-full text-[14px] font-bold text-on-ink-muted">Cancel</button>
                    </div>
                  ) : claim.open > 0 ? (
                    <button type="button" onClick={startEdit} aria-label="Edit amount to claim" className="mt-1 flex items-center gap-2 text-left">
                      <b className="block text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#FF6B6B]">{peso(adj.received)}</b>
                      <span className="flex size-7 items-center justify-center rounded-full bg-white/15"><Pencil size={13} aria-hidden /></span>
                    </button>
                  ) : (
                    <b className="mt-1 block text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(claimedShown)}</b>
                  )}
                  {!editing ? <p className={cn("mt-2 text-[12px] font-semibold tabular-nums", allClaimed ? "text-white/70" : "text-on-ink-muted")}>
                    Total {peso(dayTotal)}
                    {claim.open > 0 && adj.adjusted ? ` · Adjusted from ${peso(adj.expected)}` : allClaimed && claimedAdj ? ` · Adjusted from ${peso(claimedAdj.expected)}` : ""}
                  </p> : null}
                  {claim.open > 0 && !editing ? (
                    <Button data-auth="action" variant="white" size="md" pill fullWidth className="mt-3.5" loading={busy} onClick={doClaim}>{`Claim ${peso(adj.received)}`}</Button>
                  ) : null}
                </>
              )}
            {remit.error ? <p className="mt-2 text-[12.5px] font-semibold text-on-ink-muted">{remit.error}</p> : null}
            {remit.error ? <ClaimErrorToast msg={remit.error} onDone={remit.clearError} /> : null}
          </section>

          <section aria-label="Records">
            <div className="flex items-end justify-between px-1">
              <span><b className="block text-[16px] tracking-[-0.01em]">Records</b><small className="block text-[12.5px] font-semibold text-muted">{records.length} haircut{records.length === 1 ? "" : "s"} · {peso(dayTotal)} your share</small></span>
            </div>
            {records.length === 0 ? (
              <div className="mt-2.5 flex flex-col items-center rounded-[20px] bg-grey-100 px-4 py-6 text-center">
                <RiverIcon name="empty-queue" size={56} />
                <p className="mt-2 text-[14px] font-bold">No records this day</p>
                <p className="text-[12.5px] font-semibold text-muted">Add one you missed or encoded offline.</p>
              </div>
            ) : (
              <ul className="mt-2.5 overflow-hidden rounded-[20px] bg-grey-100">
                {records.map((r) => (
                  <li key={r.id} className="border-b border-line last:border-b-0">
                    <button type="button" onClick={() => setOpen(r)} className="flex min-h-[60px] w-full items-center gap-3 px-3.5 py-3 text-left active:bg-grey-200">
                      <span className="w-[3.9rem] flex-none text-[12.5px] font-bold tabular-nums text-muted">{time(r.completedAt)}</span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[14.5px]">{r.serviceName || "Service"}</b>
                        <small className="block truncate text-[12px] font-semibold text-muted">{[r.customerLabel || "Walk-in", r.source === "manual" ? "Added by hand" : ""].filter(Boolean).join(" · ")}</small>
                      </span>
                      <ClaimTag r={r} claimed={Boolean(remit.claimOf(r.id))} />
                      <b className="w-[3.6rem] flex-none text-right text-[15px] tabular-nums">{peso(ownerPart(r, chairs))}</b>
                      <ChevronRight size={16} className="flex-none text-muted" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setAdding(true)}
              className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-pill border-2 border-dashed border-grey-300 text-[14.5px] font-bold text-ink active:bg-grey-100">
              <Plus size={17} strokeWidth={2.6} aria-hidden />Add record
            </button>
          </section>

          <Link href={profileHref} className="flex h-11 items-center justify-center gap-1 text-[13.5px] font-bold text-ink-2">
            Open {t.name}’s profile for this day<ChevronRight size={15} aria-hidden />
          </Link>
        </div>
      )}
    </BottomSheet>
  );
}

/** Add-record state and save (logic unchanged from v1.0.15: Cash or GCash, finished walk-in on that day). */
function useAddRecord(t: DayTarget, onDone: () => void) {
  const { haircut, treatments } = useShopMenu(t.locationId);
  const menu = [haircut, ...treatments].filter((m) => m?.name);
  const [picked, setService] = useState("");
  const service = picked || menu[0]?.name || "Haircut";
  // Menu loads after the first render: until the owner types an amount, follow the picked service's menu price.
  const [typed, setPrice] = useState<string | null>(null);
  const price = typed ?? String(menu.find((m) => m.name === service)?.price ?? "");
  // No Time field (v1.0.33): today → now, past day → noon (defaultManualTime), read at save.
  const [saving, setSaving] = useState(false);
  const [pay, setPay] = useState<"cash" | "gcash">("cash");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const save = () => {
    if (saving) return;
    const r = manualRecord({ day: t.day, time: defaultManualTime(t.day), barberId: t.id, barberName: t.name, locationId: t.locationId, serviceName: service, price: Math.round((Number(price) || 0) * 100), payMethod: pay, customerLabel: name, ref: refCode(), shopId: cloudSnapshot().shopId ?? "" });
    if (!(Number(price) > 0)) { setErr("Enter the amount."); return; }
    if ("error" in r) { setErr(r.error ?? ""); return; }
    setSaving(true);
    try { saveBooking(r.row as ChairRequest); onDone(); } finally { setSaving(false); }
  };
  return { menu, service, pick: (s: string) => { setService(s); setPrice(null); }, price, setPrice, saving, pay, setPay, name, setName, err, save, amount: Math.round((Number(price) || 0) * 100) };
}

function AddRecordForm({ t, photo, f }: { t: DayTarget; photo?: string; f: ReturnType<typeof useAddRecord> }) {
  const [showName, setShowName] = useState(false);
  // Haircut only until the owner asks for more (v1.0.33); a non-haircut pick keeps the grid open.
  const [showOther, setShowOther] = useState(false);
  const haircut = f.menu[0];
  const others = f.menu.slice(1);
  const shown = showOther || (haircut && f.service !== haircut.name) ? f.menu : f.menu.slice(0, 1);
  const label = "px-1 text-[13px] font-bold text-muted";
  const svcIcon = (n: string) => { const s = n.toLowerCase(); return s.includes("beard") ? "beard" : s.includes("shave") ? "shave" : s.includes("kid") ? "kids-cut" : s.includes("wash") || s.includes("shampoo") ? "hair-wash" : s.includes("styl") ? "styling" : "haircut"; };
  return (
    <div className="flex flex-col gap-5 pb-2 pt-1">
      <div className="flex items-center gap-3 rounded-[22px] bg-grey-100 px-3.5 py-3">
        <Face name={t.name} photo={photo} />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[16px]">{t.name}</b>
          <small className="block truncate text-[12.5px] font-semibold text-muted">A finished haircut, counted on this day</small>
        </span>
        <span className="flex-none rounded-pill bg-ink px-3 py-1.5 text-[12.5px] font-bold text-on-ink">{longDay(t.day).replace(/, \d{4}$/, "")}</span>
      </div>

      <div>
        <p className={label}>Service</p>
        <div role="radiogroup" aria-label="Service" className="mt-1.5 grid grid-cols-2 gap-2">
          {shown.map((m) => {
            const on = m.name === f.service;
            return (
              <button key={m.name} type="button" role="radio" aria-checked={on} aria-label={`${m.name}, ${peso(Math.round((m.price ?? 0) * 100))}`} onClick={() => f.pick(m.name)}
                className={cn("flex min-h-[64px] items-center gap-2.5 rounded-[18px] px-3 py-2.5 text-left transition-colors", on ? "bg-ink text-on-ink" : "bg-grey-100 text-ink active:bg-grey-200")}>
                <RiverIcon name={svcIcon(m.name)} size={36} />
                <span className="min-w-0">
                  <b className="block truncate text-[14px] leading-tight">{m.name}</b>
                  <small className={cn("block text-[12.5px] font-semibold tabular-nums", on ? "text-on-ink-muted" : "text-muted")}>{peso(Math.round((m.price ?? 0) * 100))}</small>
                </span>
              </button>
            );
          })}
        </div>
        {others.length && shown.length === 1 ? (
          <button type="button" onClick={() => setShowOther(true)} className="mt-2 inline-flex items-center gap-1 px-1 py-2 text-[13px] font-semibold text-muted hover:text-ink">
            <Plus size={15} strokeWidth={2.25} aria-hidden />
            Other services
          </button>
        ) : null}
      </div>

      <label className="block">
        <span className={label}>Amount</span>
        <span className="mt-1.5 flex h-14 items-center rounded-[18px] bg-grey-100 px-4">
          <span aria-hidden className="text-[20px] font-extrabold text-muted">₱</span>
          <input aria-label="Amount (₱)" inputMode="decimal" value={f.price} onChange={(e) => f.setPrice(e.target.value.replace(/[^\d.]/g, ""))}
            className="h-full min-w-0 flex-1 bg-transparent pl-1.5 text-[20px] font-extrabold tabular-nums outline-none" />
          <small className="flex-none text-[12px] font-semibold text-muted">{f.price === String(f.menu.find((m) => m.name === f.service)?.price ?? "") ? "Menu price" : "Edited"}</small>
        </span>
      </label>

      <div>
        <p className={label}>Paid with</p>
        <div role="radiogroup" aria-label="Payment" className="mt-1.5 grid grid-cols-2 gap-2">
          {([["cash", "Cash", "payments"], ["gcash", "GCash", "qr"]] as const).map(([v, l, icon]) => {
            const on = f.pay === v;
            return (
              <button key={v} type="button" role="radio" aria-checked={on} aria-label={l} onClick={() => f.setPay(v)}
                className={cn("flex h-14 items-center justify-center gap-2 rounded-pill text-[15.5px] font-extrabold transition-colors", on ? "bg-ink text-on-ink" : "bg-grey-100 text-ink active:bg-grey-200")}>
                <RiverIcon name={icon} size={30} />{l}
              </button>
            );
          })}
        </div>
      </div>

      {showName || f.name ? (
        <label className="block">
          <span className={label}>Customer name</span>
          <span className="mt-1.5 flex h-14 items-center gap-2.5 rounded-[18px] bg-grey-100 px-4">
            <UserRound size={19} strokeWidth={2.2} className="flex-none text-muted" aria-hidden />
            <input aria-label="Customer name" autoFocus value={f.name} placeholder="Optional" onChange={(e) => f.setName(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:font-medium placeholder:text-muted" />
          </span>
        </label>
      ) : (
        <button type="button" onClick={() => setShowName(true)} className="-mt-1 inline-flex h-10 items-center gap-1.5 self-start px-1 text-[14px] font-bold text-ink-2">
          <Plus size={16} strokeWidth={2.6} aria-hidden />Add customer name
        </button>
      )}

      {f.err ? <p role="alert" className="rounded-[14px] bg-grey-100 px-3.5 py-2.5 text-[13px] font-bold">{f.err}</p> : null}
    </div>
  );
}

/** Error toast when a claim fails and its haircuts roll back to red (v1.0.30). */
function ClaimErrorToast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = window.setTimeout(onDone, 5000); return () => window.clearTimeout(t); }, [msg, onDone]);
  return <div role="alert" className="fixed inset-x-4 bottom-6 z-[100] mx-auto max-w-sm rounded-card bg-[#C62828] px-4 py-3 text-[13px] font-semibold text-white shadow-lg">{`Claim failed: ${msg}`}</div>;
}
