"use client";
import { Button, Input, SegmentedControl } from "@river-apps/ui";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { patchRequest, statusLabel, type ChairRequest } from "@/lib/chair-bookings";
import type { PayMethod } from "@/lib/booking-types";
import { peso } from "@/lib/format";
import { useShopMenu } from "@/lib/shop-services";

const when = (ms?: number) => ms ? new Date(ms).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const METHOD: Record<PayMethod, string> = { cash: "Cash", gcash: "GCash", online: "Online" };

export function payLabel(row: ChairRequest) {
  if (!row.paid) return row.payWhere === "online" ? "Pay online" : "Unpaid";
  return `Paid · ${METHOD[row.payMethod ?? (row.payWhere === "online" ? "online" : "cash")]}`;
}

function Line({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="text-[13px] font-semibold text-muted">{k}</span>
      <span className="min-w-0 text-right text-[14px] font-bold">{v}</span>
    </div>
  );
}

/** One transaction: every detail, and an edit form (saved through the shop API; gated by sign-in). */
export function TransactionSheet({ row, onClose }: { row: ChairRequest; onClose: () => void }) {
  const { haircut, treatments } = useShopMenu(row.locationId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.customerLabel);
  const [phone, setPhone] = useState(row.contact);
  const [service, setService] = useState(row.serviceName);
  const [price, setPrice] = useState(row.price ? String(row.price / 100) : "");
  const [paid, setPaid] = useState(Boolean(row.paid));
  const [method, setMethod] = useState<"cash" | "gcash">(row.payMethod === "gcash" ? "gcash" : "cash");
  const [notes, setNotes] = useState(row.notes ?? "");
  const onlinePaid = Boolean(row.paid) && (row.payMethod === "online" || (!row.payMethod && row.payWhere === "online"));
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const save = () => {
    const pesos = Math.max(0, Math.round(Number(price.replace(/[^\d.]/g, "")) * 100) || 0);
    patchRequest(row.id, {
      customerLabel: name.trim(), contact: phone.trim(), serviceName: service.trim() || row.serviceName, price: pesos, notes: notes.trim() || undefined,
      ...(onlinePaid ? {} : paid ? { paid: true, payMethod: method, payWhere: "shop" as const } : { paid: false, payMethod: undefined }),
    });
    setEditing(false);
    onClose();
  };
  const services = [haircut.name, ...treatments.map((t) => t.name)];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="txn-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[92dvh] w-full max-w-[440px] flex-col overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-card sm:rounded-[28px]">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-grey-100"><X size={16} strokeWidth={2.2} /></button>
        <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-muted">{row.channel === "walk-in" ? "Walk-in" : "Online booking"} · {row.ref || row.id}</p>
        <h2 id="txn-title" className="mt-1 pr-10 text-[22px] font-extrabold tracking-[-0.02em]">{row.price ? peso(row.price) : "No price yet"}</h2>
        {!editing ? (
          <>
            <div className="mt-3">
              <Line k="Ticket" v={row.ref || row.id} />
              <Line k="Customer" v={row.customerLabel || "Walk-in"} />
              <Line k="Phone" v={row.contact} />
              <Line k="Service" v={row.serviceName} />
              <Line k="Price" v={row.price ? peso(row.price) : "₱0 · tap Edit to set"} />
              <Line k="Payment" v={payLabel(row)} />
              <Line k="Status" v={statusLabel(row.status)} />
              <Line k="Chair" v={row.seatLabel || row.chairLabel} />
              <Line k="Booked" v={when(row.createdAt)} />
              <Line k="Started" v={when(row.startedAt)} />
              <Line k="Done" v={when(row.completedAt)} />
              <Line k="Updated" v={when(row.updatedAt)} />
              <Line k="Notes" v={row.notes} />
            </div>
            <Button data-auth="action" className="mt-4" fullWidth onClick={() => setEditing(true)}>Edit</Button>
          </>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <Input label="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold">Service</span>
              <select value={services.includes(service) ? service : "__custom"} onChange={(e) => { if (e.target.value !== "__custom") setService(e.target.value); }} className="h-12 rounded-[14px] bg-grey-100 px-3 text-[15px] font-semibold">
                {services.map((s) => <option key={s} value={s}>{s}</option>)}
                {services.includes(service) ? null : <option value="__custom">{service}</option>}
              </select>
            </label>
            <Input label="Price (₱)" inputMode="decimal" value={price} placeholder="e.g. 150" onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} />
            {onlinePaid ? <p className="text-[13px] font-semibold text-muted">Paid online. Payment can’t be changed here.</p> : (
              <>
                <SegmentedControl label="Payment" value={paid ? "paid" : "unpaid"} onChange={(v: string) => setPaid(v === "paid")} options={[{ value: "paid", label: "Paid" }, { value: "unpaid", label: "Unpaid" }]} />
                {paid ? <SegmentedControl label="Method" value={method} onChange={(v: string) => setMethod(v as "cash" | "gcash")} options={[{ value: "cash", label: "Cash" }, { value: "gcash", label: "GCash" }]} /> : null}
              </>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold">Notes</span>
              <textarea value={notes} maxLength={500} rows={3} onChange={(e) => setNotes(e.target.value)} className="rounded-[14px] bg-grey-100 px-3 py-2.5 text-[15px] font-medium outline-none" placeholder="Optional" />
            </label>
            <div className="mt-1 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
              <Button data-auth="action" className="flex-1" onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
