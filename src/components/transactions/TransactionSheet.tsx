"use client";
import { Avatar, Badge, Button, Card, CardHeader, Input, SegmentedControl, StatusDot } from "@river-apps/ui";
import { ArrowLeft, Phone, User } from "lucide-react";
import { useEffect, useState } from "react";
import { patchRequest, statusLabel, useChairRequests, type ChairRequest } from "@/lib/chair-bookings";
import type { PayMethod } from "@/lib/booking-types";
import { peso } from "@/lib/format";
import { useShopMenu } from "@/lib/shop-services";

const when = (ms?: number) => ms ? new Date(ms).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const METHOD: Record<PayMethod, string> = { cash: "Cash", gcash: "GCash", online: "Online" };

export function payLabel(row: ChairRequest) {
  if (!row.paid) return row.payWhere === "online" ? "Pay online" : "Unpaid";
  return `Paid · ${METHOD[row.payMethod ?? (row.payWhere === "online" ? "online" : "cash")]}`;
}

const isOnlinePaid = (row: ChairRequest) => Boolean(row.paid) && (row.payMethod === "online" || (!row.payMethod && row.payWhere === "online"));

/** Order details (Laundry.ph layout): header with status, customer, service lines + total, payment, timeline, edit. */
export function TransactionSheet({ row: initial, onClose }: { row: ChairRequest; onClose: () => void }) {
  const { rows } = useChairRequests();
  const row = rows.find((r) => r.id === initial.id) ?? initial;
  const [editing, setEditing] = useState(false);
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
  const timeline: [string, number | undefined][] = [["Booked", row.createdAt], ["In the chair", row.startedAt], ["Done", row.completedAt]];
  const setPay = (patch: Partial<ChairRequest>) => patchRequest(row.id, patch);

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
            <p className="mt-0.5 truncate text-[13.5px] font-semibold text-ink-2">{row.channel === "walk-in" ? "Walk-in" : "Online booking"}{row.seatLabel || row.chairLabel ? ` · ${row.seatLabel || row.chairLabel}` : ""}</p>
            <StatusDot tone={tone} className="mt-1 text-[12.5px] font-semibold text-muted">{statusLabel(row.status)} · updated {when(row.updatedAt)}</StatusDot>
          </div>
        </header>

        {editing ? <EditForm row={row} onDone={() => setEditing(false)} /> : (
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
                  <p className="mt-2 text-[14px] font-medium text-muted">Paid {peso(row.price ?? 0)}{onlinePaid ? " online" : ""}. Thank you!</p>
                  {onlinePaid ? null : <Button data-auth="action" variant="secondary" size="md" fullWidth className="mt-3" onClick={() => setPay({ paid: false, payMethod: undefined })}>Mark unpaid</Button>}
                </>
              ) : (
                <>
                  <p className="mt-2 text-[14px] font-medium text-muted">Amount due <b className="text-ink">{peso(row.price ?? 0)}</b></p>
                  {row.payWhere === "online" && row.status !== "done" ? null : (
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

            {row.notes ? (
              <Card className="mt-4 px-4 py-3.5">
                <b className="text-[16px]">Notes</b>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] font-medium text-ink-2">{row.notes}</p>
              </Card>
            ) : null}

            <p className="mt-4 px-1 text-[12.5px] font-semibold text-muted">Ticket {row.id}</p>
            <Button data-auth="action" className="mt-3" fullWidth onClick={() => setEditing(true)}>Edit</Button>
          </>
        )}
      </div>
    </div>
  );
}

function EditForm({ row, onDone }: { row: ChairRequest; onDone: () => void }) {
  const { haircut, treatments } = useShopMenu(row.locationId);
  const [name, setName] = useState(row.customerLabel);
  const [phone, setPhone] = useState(row.contact);
  const [service, setService] = useState(row.serviceName);
  const [price, setPrice] = useState(row.price ? String(row.price / 100) : "");
  const [paid, setPaid] = useState(Boolean(row.paid));
  const [method, setMethod] = useState<"cash" | "gcash">(row.payMethod === "gcash" ? "gcash" : "cash");
  const [notes, setNotes] = useState(row.notes ?? "");
  const onlinePaid = isOnlinePaid(row);
  const services = [haircut.name, ...treatments.map((t) => t.name)];
  const save = () => {
    const cents = Math.max(0, Math.round(Number(price.replace(/[^\d.]/g, "")) * 100) || 0);
    patchRequest(row.id, {
      customerLabel: name.trim(), contact: phone.trim(), serviceName: service.trim() || row.serviceName, price: cents, notes: notes.trim() || undefined,
      ...(onlinePaid ? {} : paid ? { paid: true, payMethod: method, payWhere: "shop" as const } : { paid: false, payMethod: undefined }),
    });
    onDone();
  };
  return (
    <Card className="mt-4 flex flex-col gap-3 px-4 py-4">
      <b className="text-[16px]">Edit order</b>
      <Input label="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold">Service</span>
        <select value={services.includes(service) ? service : "__custom"} onChange={(e) => { if (e.target.value !== "__custom") setService(e.target.value); }} className="h-12 rounded-[14px] bg-grey-100 px-3 text-[15px] font-semibold">
          {services.map((s) => <option key={s} value={s}>{s}</option>)}
          {services.includes(service) ? null : <option value="__custom">{service}</option>}
        </select>
      </label>
      <Input label="Amount (₱)" inputMode="decimal" value={price} placeholder="e.g. 150" onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} />
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
        <Button variant="secondary" className="flex-1" onClick={onDone}>Cancel</Button>
        <Button data-auth="action" className="flex-1" onClick={save}>Save</Button>
      </div>
    </Card>
  );
}
