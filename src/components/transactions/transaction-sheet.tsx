"use client";
import { HOME_LOCATION_ID } from "@/lib/shop-locations";
import { Avatar, Badge, Card, CardHeader, StatusDot } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { ArrowLeft, ChevronDown, History, Lock, Pencil, Phone, Plus, Trash2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { patchRequest, statusLabel, useChairRequests, type ChairRequest } from "@/lib/chair-bookings";
import { payMethodLabel } from "@/lib/pay-split";
import { peso } from "@/lib/format";
import { useShopMenu } from "@/lib/shop-services";
import { removeBooking, useCloud } from "@/lib/cloud";
import { lockedAmount } from "@/lib/menu-amount";

const when = (ms?: number) => ms ? new Date(ms).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export function payLabel(row: ChairRequest) {
  if (!row.paid) return row.payWhere === "online" ? "Pay online" : "Unpaid";
  // Stored method only; a paid visit with no saved method shows "Other".
  return `Paid · ${payMethodLabel(row)}`;
}

const isOnlinePaid = (row: ChairRequest) => Boolean(row.paid) && (row.payMethod === "online" || (!row.payMethod && row.payWhere === "online"));

/** Order details (Laundry.ph layout): header with status, customer, service lines + total, payment, timeline, edit. */
/** `barber`: barber-link view; payment can be recorded, but price/service edits are owner-only. */
/** `locked`: the owner already claimed this cut, so the barber can only view it. */
export function TransactionSheet({ row: initial, onClose, barber = false, locked = false }: { row: ChairRequest; onClose: () => void; barber?: boolean; locked?: boolean }) {
  const { rows } = useChairRequests();
  const row = rows.find((r) => r.id === initial.id) ?? initial;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const who = row.customerLabel?.trim() && row.customerLabel !== "Walk-in" ? row.customerLabel.trim() : "";
  const phone = row.contact?.trim() ?? "";
  const tel = phone.replace(/[^\d+]/g, "");
  const onlinePaid = isOnlinePaid(row);
  const tone = row.status === "done" ? "idle" : row.status === "in_chair" ? "active" : "waiting";
  const lines = (row.serviceName || "Service").split(" · ");
  const timeline: [string, number | undefined][] = [["Booked", row.createdAt], ["In service", row.startedAt], ["Done", row.completedAt]];
  const setPay = (patch: Partial<ChairRequest>) => patchRequest(row.id, patch, row);
  const readOnly = barber && locked;

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-canvas" role="dialog" aria-modal="true" aria-labelledby="txn-title">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-3">
        <header className="flex items-center gap-3 px-1">
          <button type="button" onClick={onClose} aria-label="Back" className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-surface shadow-card"><ArrowLeft size={20} strokeWidth={2.2} /></button>
          {who ? <Avatar name={who} size={56} /> : (
            <span aria-hidden className="flex size-14 flex-none items-center justify-center rounded-full bg-grey-200 text-muted"><User size={26} strokeWidth={1.75} /></span>
          )}
          <div className="flex min-w-0 flex-1 flex-col leading-[1.25]">
            <h1 id="txn-title" className="truncate text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">{row.ref || row.id}</h1>
            <p className="mt-0.5 truncate text-[13.5px] font-semibold text-ink-2">{row.channel === "walk-in" ? "Walk-in" : "Online booking"}{row.seatLabel || row.chairLabel ? ` · ${row.seatLabel || row.chairLabel}` : ""}{row.barberName ? ` · ${row.barberName}` : ""}</p>
            <StatusDot tone={tone} className="mt-1 text-[12.5px] font-semibold text-muted">{statusLabel(row.status)} · updated {when(row.updatedAt)}</StatusDot>
          </div>
        </header>

        {editing && !readOnly ? <EditForm row={row} onDone={() => setEditing(false)} /> : (
          <>
            <Card className="mt-4 px-4 py-3.5">
              <h2 className="mb-2.5 text-[13px] font-bold text-muted">Customer</h2>
              {!who && !phone ? <p className="text-[14px] font-semibold text-ink-2">Walk-in · no customer information</p> : (
                <div className="flex items-center gap-3">
                  {who ? <Avatar name={who} size={44} /> : <span aria-hidden className="flex size-11 flex-none items-center justify-center rounded-full bg-grey-200 text-muted"><User size={20} /></span>}
                  <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
                    {who ? <b className="truncate text-[15.5px]">{who}</b> : null}
                    {phone ? <a href={`tel:${tel}`} className="text-[13.5px] font-semibold text-ink-2 underline decoration-grey-300 underline-offset-[3px]">{phone}</a> : <small className="text-[13px] font-semibold text-muted">No number</small>}
                  </span>
                  {phone ? <a href={`tel:${tel}`} className="inline-flex h-11 flex-none items-center gap-1.5 rounded-pill bg-ink px-4 text-[14px] font-bold text-on-ink"><Phone size={16} /> Call</a> : null}
                </div>
              )}
            </Card>

            <Card className="mt-4 px-4 py-3.5">
              <CardHeader title="Service" subtitle={row.slotLabel && row.slotLabel !== "Now" ? row.slotLabel : undefined} />
              <ul className="mt-3 flex flex-col gap-2">
                {lines.map((l, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-[14px] font-medium">
                    <span className="text-ink-2">{l}</span>{lines.length === 1 ? <b>{row.price ? peso(row.price) : "—"}</b> : null}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-[#E8E8EC] pt-3">
                <b className="text-[15px]">Total</b>
                <b className="text-[22px] font-extrabold tracking-[-0.03em]">{peso(row.price ?? 0)}</b>
              </div>
            </Card>

            <Card className="mt-4 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <b className="text-[16px]">Payment</b>
                <Badge variant={row.paid ? "solid" : "outline"}>{payLabel(row)}</Badge>
              </div>
              {row.paid ? (
                <>
                  <p className="mt-2 text-[14px] font-medium text-muted">Paid {peso(row.price ?? 0)}{onlinePaid ? " online" : ""}{row.tip ? ` + ${peso(row.tip)} tip for the barber` : ""}. Thank you!</p>
                  {onlinePaid || readOnly ? null : <Button data-auth="action" variant="secondary" size="md" fullWidth className="mt-3" onClick={() => setPay({ paid: false, payMethod: undefined })}>Mark unpaid</Button>}
                </>
              ) : (
                <>
                  <p className="mt-2 text-[14px] font-medium text-muted">Amount due <b className="text-ink">{peso(row.price ?? 0)}</b></p>
                  {readOnly || (row.payWhere === "online" && row.status !== "done") ? null : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button data-auth="action" variant="secondary" size="md" onClick={() => setPay({ paid: true, payMethod: "cash", payWhere: "shop" })}>Paid cash</Button>
                      <Button data-auth="action" variant="secondary" size="md" onClick={() => setPay({ paid: true, payMethod: "gcash", payWhere: "shop" })}>Paid GCash</Button>
                    </div>
                  )}
                </>
              )}
            </Card>

            <Card className="mt-4 px-4 py-3.5">
              <b className="text-[16px]">Timeline</b>
              <ol className="mt-3 flex flex-col">
                {timeline.map(([k, t], i) => (
                  <li key={k} className="relative flex items-start gap-3 pb-3 last:pb-0">
                    {i < timeline.length - 1 ? <i aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-0.5 bg-grey-200" /> : null}
                    <i aria-hidden className={`mt-1 block size-3 flex-none rounded-full ${t ? "bg-ink" : "border-2 border-grey-300 bg-surface"}`} />
                    <span className="flex flex-1 items-baseline justify-between gap-3 text-[14px]">
                      <b className={t ? "" : "text-muted"}>{k}</b>
                      <span className="font-semibold text-muted">{t ? when(t) : "—"}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>

            {row.rating ? (
              <Card className="mt-4 px-4 py-3.5">
                <div className="flex items-center justify-between"><b className="text-[16px]">Customer feedback</b><span className="text-[16px] font-extrabold text-[#F5B301]" aria-label={`${row.rating} of 5 stars`}>{"★".repeat(row.rating)}<span className="text-grey-300">{"★".repeat(5 - row.rating)}</span></span></div>
                {row.feedback ? <p className="mt-1.5 whitespace-pre-wrap text-[14px] font-medium text-ink-2">“{row.feedback}”</p> : <p className="mt-1.5 text-[13px] font-semibold text-muted">No comment.</p>}
              </Card>
            ) : row.status === "done" ? (
              <Card className="mt-4 px-4 py-3.5">
                <div className="flex items-center justify-between"><b className="text-[16px]">Customer feedback</b><span className="text-[13px] font-semibold text-muted">No rating yet</span></div>
              </Card>
            ) : null}
            {row.notes ? (
              <Card className="mt-4 px-4 py-3.5">
                <b className="text-[16px]">Notes</b>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] font-medium text-ink-2">{row.notes}</p>
              </Card>
            ) : null}

            <p className="mt-4 px-1 text-[12.5px] font-semibold text-muted">Ticket {row.id}</p>
            <EditLog row={row} />
            {readOnly ? (
              <p role="status" className="mt-3 flex items-center gap-2 rounded-[14px] bg-[#E7F6EC] px-3.5 py-3 text-[13px] font-bold text-[#0B7A3E]"><Lock size={14} strokeWidth={2.4} aria-hidden />Claimed by the owner. Ask the owner to change it.</p>
            ) : <Button data-auth="action" className="mt-3" fullWidth variant="secondary" leadingIcon={<Pencil size={16} strokeWidth={2} />} onClick={() => setEditing(true)}>Edit information</Button>}
            {barber ? (readOnly ? null : <p className="mt-2 px-1 text-[12px] font-semibold text-muted">The amount follows the shop menu for the service you pick.</p>) : (
              <Button data-auth="action" className="mt-2 !text-[#DC2626]" fullWidth variant="ghost" leadingIcon={<Trash2 size={16} strokeWidth={2} />} onClick={() => setConfirmDelete(true)}>Delete walk-in</Button>
            )}
            {!barber && confirmDelete ? (
              <div role="dialog" aria-modal="true" aria-label="Delete walk-in" className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
                <Card className="w-full max-w-[400px] px-5 py-5">
                  <b className="text-[17px]">Delete {row.ref}?</b>
                  <p className="mt-1.5 text-[14px] text-muted">{[row.serviceName, peso(row.price || 0), row.barberName].filter(Boolean).join(" · ")}. It will be removed from sales and collections. This can&apos;t be undone; the delete is saved in the shop activity log.</p>
                  <div className="mt-4 flex gap-2">
                    <Button fullWidth variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    <Button fullWidth className="!bg-[#DC2626]" onClick={() => { removeBooking(row.id); onClose(); }}>Delete</Button>
                  </div>
                </Card>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function EditForm({ row, onDone }: { row: ChairRequest; onDone: () => void }) {
  const { haircut, treatments } = useShopMenu(row.locationId || HOME_LOCATION_ID);
  // Barber link: Amount is read-only, the menu price of the chosen service (the server enforces this too).
  const barber = useCloud().mode === "barber";
  const [name, setName] = useState(row.customerLabel);
  const [phone, setPhone] = useState(row.contact);
  const [service, setService] = useState(row.serviceName);
  const [price, setPrice] = useState(row.price ? String(row.price / 100) : "");
  const [paid, setPaid] = useState(Boolean(row.paid));
  const [method, setMethod] = useState<"cash" | "gcash">(row.payMethod === "gcash" ? "gcash" : "cash");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [tip, setTip] = useState(row.tip ? String(row.tip / 100) : "");
  const onlinePaid = isOnlinePaid(row);
  const services = [haircut.name, ...treatments.map((t) => t.name)];
  const locked = barber ? lockedAmount(row, [haircut, ...treatments], service.trim() || row.serviceName) : null;
  const save = () => {
    const cents = locked ?? (Math.max(0, Math.round(Number(price.replace(/[^\d.]/g, "")) * 100) || 0));
    patchRequest(row.id, {
      customerLabel: name.trim(), contact: phone.trim(), serviceName: service.trim() || row.serviceName, price: cents, notes: notes.trim() || undefined, tip: Math.max(0, Math.round(Number(tip) * 100) || 0),
      ...(onlinePaid ? {} : paid ? { paid: true, payMethod: method, payWhere: "shop" as const } : { paid: false, payMethod: undefined }),
    }, row);
    onDone();
  };
  const [showTip, setShowTip] = useState(Boolean(row.tip));
  const [showNotes, setShowNotes] = useState(Boolean(row.notes));
  const field = "h-10 w-full min-w-0 bg-transparent px-3 text-[14.5px] font-semibold outline-none placeholder:font-medium placeholder:text-muted";
  const box = "rounded-[12px] bg-grey-100";
  const seg = (on: boolean) => `h-8 flex-1 rounded-[9px] px-2.5 text-[13px] font-bold transition-colors ${on ? "bg-surface text-ink shadow-card" : "text-muted"}`;
  const more = "inline-flex h-8 items-center gap-1 text-[13px] font-bold text-ink-2";
  return (
    <Card className="mt-4 px-4 pb-4 pt-3">
      <div className="flex items-center justify-between">
        <b className="text-[15.5px] tracking-[-0.01em]">Edit information</b>
        <button type="button" aria-label="Close edit" onClick={onDone} className="-mr-1.5 inline-flex size-9 items-center justify-center rounded-full text-muted active:bg-grey-100"><X size={18} strokeWidth={2.2} /></button>
      </div>

      <div className={`mt-2 divide-y divide-line ${box}`}>
        <input aria-label="Customer name" value={name} placeholder="Customer name" onChange={(e) => setName(e.target.value)} className={field} />
        <input aria-label="Phone" inputMode="tel" value={phone} placeholder="Phone (optional)" onChange={(e) => setPhone(e.target.value)} className={field} />
      </div>

      <div className="mt-2.5 flex gap-2">
        <label className={`relative min-w-0 flex-[1.4] ${box}`}>
          <span className="sr-only">Service</span>
          <select value={services.includes(service) ? service : "__custom"} onChange={(e) => { if (e.target.value !== "__custom") setService(e.target.value); }} className={`${field} appearance-none pr-8`}>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
            {services.includes(service) ? null : <option value="__custom">{service}</option>}
          </select>
          <ChevronDown size={15} strokeWidth={2.2} aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
        </label>
        {locked != null ? (
          <p aria-label="Amount, set by the shop menu" title="Menu price" className={`flex h-10 flex-1 items-center justify-between gap-1 px-3 ${box}`}>
            <b className="text-[14.5px] tabular-nums">{peso(locked)}</b><Lock size={13} strokeWidth={2.2} className="text-muted" aria-hidden />
          </p>
        ) : (
          <label className={`flex flex-1 items-center pl-3 ${box}`}>
            <span aria-hidden className="text-[14.5px] font-bold text-muted">₱</span>
            <input aria-label="Amount (₱)" inputMode="decimal" value={price} placeholder="150" onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} className={`${field} pl-1 tabular-nums`} />
          </label>
        )}
      </div>
      {locked != null ? <p className="mt-1 px-1 text-[11.5px] font-semibold text-muted">Amount follows the shop menu.</p> : null}

      {onlinePaid ? <p className="mt-2.5 px-1 text-[13px] font-semibold text-muted">Paid online. Payment can’t be changed here.</p> : (
        <div className="mt-2.5 flex gap-2">
          <div role="radiogroup" aria-label="Payment" className={`flex flex-1 gap-1 p-1 ${box}`}>
            <button type="button" role="radio" aria-checked={paid} onClick={() => setPaid(true)} className={seg(paid)}>Paid</button>
            <button type="button" role="radio" aria-checked={!paid} onClick={() => setPaid(false)} className={seg(!paid)}>Unpaid</button>
          </div>
          {paid ? (
            <div role="radiogroup" aria-label="Method" className={`flex flex-1 gap-1 p-1 ${box}`}>
              <button type="button" role="radio" aria-checked={method === "cash"} onClick={() => setMethod("cash")} className={seg(method === "cash")}>Cash</button>
              <button type="button" role="radio" aria-checked={method === "gcash"} onClick={() => setMethod("gcash")} className={seg(method === "gcash")}>GCash</button>
            </div>
          ) : null}
        </div>
      )}

      {showTip ? (
        <label className={`mt-2.5 flex items-center pl-3 ${box}`}>
          <span className="flex-none text-[13px] font-bold text-muted">Tip ₱</span>
          <input aria-label="Tip for the barber (₱)" autoFocus={!row.tip} inputMode="decimal" value={tip} placeholder="0" onChange={(e) => setTip(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))} className={`${field} pl-1.5 tabular-nums`} />
        </label>
      ) : null}
      {showNotes ? (
        <textarea aria-label="Notes" autoFocus={!row.notes} value={notes} maxLength={500} rows={2} onChange={(e) => setNotes(e.target.value)} placeholder="Note" className={`mt-2.5 block w-full resize-none px-3 py-2.5 text-[14.5px] font-medium outline-none placeholder:text-muted ${box}`} />
      ) : null}
      {!showTip || !showNotes ? (
        <div className="mt-1.5 flex gap-4 px-1">
          {!showTip ? <button type="button" className={more} onClick={() => setShowTip(true)}><Plus size={14} strokeWidth={2.4} aria-hidden />Add tip</button> : null}
          {!showNotes ? <button type="button" className={more} onClick={() => setShowNotes(true)}><Plus size={14} strokeWidth={2.4} aria-hidden />Add note</button> : null}
        </div>
      ) : null}

      <Button data-auth="action" fullWidth className="mt-3" onClick={save}>Save</Button>
    </Card>
  );
}

/** Accountability (Jimboy, 2026-10-21): every change to this visit's details, newest first. Written by the server. */
function EditLog({ row }: { row: ChairRequest }) {
  const log = (row.editLog ?? []).slice().reverse();
  return (
    <Card className="mt-4 px-4 py-3.5">
      <div className="flex items-center justify-between"><b className="text-[16px]">Activity</b><History size={17} strokeWidth={2} className="text-muted" aria-hidden /></div>
      {log.length === 0 ? <p className="mt-1.5 text-[13px] font-semibold text-muted">No edits. Changes to this visit show here with who made them.</p> : (
        <ol className="mt-2 flex flex-col">
          {log.map((e, i) => (
            <li key={`${e.at}-${i}`} className="border-b border-line py-2.5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <b className="text-[14px]">{e.by}<span className="ml-1 text-[12px] font-semibold text-muted">{e.role === "barber" ? "Barber" : "Owner"}</span></b>
                <small className="flex-none text-[12px] font-semibold text-muted">{when(e.at)}</small>
              </div>
              <ul className="mt-0.5 text-[13px] font-medium text-ink-2">{e.changes.map((c) => <li key={c}>{c}</li>)}</ul>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
