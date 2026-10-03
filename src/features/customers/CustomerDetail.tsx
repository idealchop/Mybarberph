"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, MessageSquare, Pencil, Phone, QrCode as QrIcon, Smartphone, UserCheck } from "lucide-react";
import { Avatar, Badge, Button, cn, Input, ProgressRing } from "@river-apps/ui";
import { Stars } from "@/components/art";
import { Dialog, SelectField, Toggle } from "@/components/common/Dialog";
import { CodeChip, Panel, PanelHeader, PaymentPill, Pill } from "@/components/common/ui";
import { PageHeader } from "@/components/shell/PageHeader";
import type { Barber, Customer, CustomerVisit, Membership, MembershipPlan, PaymentMethod, Voucher } from "@/data";
import { PAYMENT_LABEL, peso } from "@/lib/format";
import { lastVisitLabel, maskPhone, SOURCE_LABEL, TypePill } from "./Customers";
import { QueueQrDialog } from "./QueueQrDialog";

export interface CustomerDetailData { customer: Customer; visits: CustomerVisit[]; barbers: Barber[]; plans: MembershipPlan[]; membership?: Membership; vouchers: Voucher[] }

const DISCOUNTS = [{ value: "none", label: "No standing discount", pct: 0 }, { value: "Senior 20%", label: "Senior / PWD 20%", pct: 20 }, { value: "Student 10%", label: "Student 10%", pct: 10 }, { value: "VIP 10%", label: "VIP 10%", pct: 10 }, { value: "Suki 5%", label: "Suki 5%", pct: 5 }];

export function CustomerDetail({ data }: { data: CustomerDetailData }) {
  const [c, setC] = useState(data.customer);
  const [membership, setMembership] = useState(data.membership);
  const [qr, setQr] = useState(false);
  const [convert, setConvert] = useState(false);
  const [memberDialog, setMemberDialog] = useState(false);
  const visits = data.visits;
  const fav = data.barbers.find((b) => b.id === c.favoriteBarberId);
  const plan = data.plans.find((p) => p.id === membership?.planId);
  const tips = visits.reduce((a, v) => a + (v.tip ?? 0), 0);
  const mix = (["cash", "gcash", "maya", "card"] as PaymentMethod[]).map((m) => ({ m, n: visits.filter((v) => v.paymentMethod === m).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const avg = Math.round(c.totalSpent / Math.max(1, c.visitCount));
  const personal = c.kind === "personal";

  return (
    <>
      <Link href="/customers" className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-muted hover:text-ink"><ArrowLeft size={15} strokeWidth={2} />Customers</Link>
      <PageHeader title={c.name} subtitle={`${personal ? "Personal record" : "Walk-in record"} · ${SOURCE_LABEL[c.source]} · last visit ${lastVisitLabel(c.lastVisitAt).toLowerCase()}`}
        actions={<Button leadingIcon={<QrIcon size={18} strokeWidth={1.75} />} onClick={() => setQr(true)}>Generate queue QR</Button>} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-[18px]">
          {/* profile */}
          <Panel className="pb-4">
            <div className="flex items-center gap-3.5">
              <Avatar name={c.name} preset={c.avatar} size={64} />
              <div className="flex min-w-0 flex-col gap-1.5 leading-tight">
                <b className="truncate text-[18px] tracking-[-0.02em]">{c.name}</b>
                <span className="flex flex-wrap gap-1.5"><TypePill type={c.type} />{c.source === "partner:river-mobile" ? <Pill tone="outline"><Smartphone size={12} strokeWidth={1.75} />River Mobile</Pill> : null}</span>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2.5">
              {[["Visits", String(c.visitCount)], ["Total spent", peso(c.totalSpent)], ["Avg ticket", peso(avg)], ["Favourite", fav ? fav.nickname : "—"]].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 rounded-[18px] bg-grey-100 p-3"><dt className="text-[12px] font-semibold text-muted">{k}</dt><dd className="text-[15px] font-extrabold tracking-[-0.01em]">{v}</dd></div>
              ))}
            </dl>
            {personal ? (
              <ul className="mt-4 flex flex-col gap-2.5 text-[13.5px] font-semibold">
                <li className="flex items-center gap-2.5"><Phone size={16} strokeWidth={1.75} className="text-muted" /><span className="font-mono">{c.phone ?? "No number"}</span></li>
                <li className="flex items-center justify-between gap-2.5"><span className="flex items-center gap-2.5"><MessageSquare size={16} strokeWidth={1.75} className="text-muted" />Queue texts (SMS)</span>
                  <Toggle label="SMS consent" checked={c.consent.sms} onChange={(v) => setC({ ...c, consent: { ...c.consent, sms: v } })} disabled={!c.phone} /></li>
                <li className="flex items-center justify-between gap-2.5"><span className="flex items-center gap-2.5"><MessageSquare size={16} strokeWidth={1.75} className="text-muted" />Promos and vouchers</span>
                  <Toggle label="Marketing consent" checked={c.consent.marketing} onChange={(v) => setC({ ...c, consent: { ...c.consent, marketing: v } })} disabled={!c.phone} /></li>
              </ul>
            ) : (
              <div className="mt-4 rounded-[18px] bg-grey-100 p-3.5">
                <b className="text-[14px]">Anonymous walk-in</b>
                <p className="mt-0.5 text-[12.5px] font-medium text-muted">Created by the kiosk without contact details. Add a number to send queue texts and track their history across visits.</p>
                <Button size="sm" className="mt-3" leadingIcon={<UserCheck size={16} strokeWidth={1.75} />} onClick={() => setConvert(true)}>Make personal record</Button>
              </div>
            )}
            {c.notes ? <p className="mt-4 rounded-tile bg-grey-50 px-3 py-2.5 text-[13px] font-medium text-ink-2 ring-1 ring-inset ring-grey-200"><b>Note:</b> {c.notes}</p> : null}
          </Panel>

          {/* membership */}
          <Panel className="pb-4">
            <PanelHeader className="mb-3" title="Membership" subtitle={plan ? `${plan.name} · ${peso(plan.price)}/${plan.period === "monthly" ? "mo" : "yr"}` : "Not a member"} />
            {plan && membership ? (
              <div className="flex items-center gap-4 rounded-[18px] bg-ink p-4 text-on-ink">
                {membership.creditsRemaining !== undefined ? (
                  <ProgressRing value={(membership.creditsRemaining / 4) * 100} size={58} thickness={6} tone="inverse" label={`${membership.creditsRemaining}/4`} labelSize={13} ariaLabel={`${membership.creditsRemaining} of 4 haircuts left`} />
                ) : <span className="inline-flex size-[58px] items-center justify-center rounded-full bg-on-ink-subtle text-[13px] font-extrabold">∞</span>}
                <div className="flex flex-col leading-tight"><b className="text-[15px]">{membership.creditsRemaining !== undefined ? `${membership.creditsRemaining} haircuts left` : "Unlimited haircuts"}</b>
                  <span className="mt-1 text-[12.5px] font-semibold text-on-ink-muted">{membership.status === "active" ? "Active" : "Expired"} · renews {membership.endsAtLabel}</span>
                  <span className="mt-1 text-[12px] font-medium text-on-ink-muted">{plan.benefits.join(" · ")}</span></div>
              </div>
            ) : (
              <Button variant="secondary" fullWidth disabled={!personal} onClick={() => setMemberDialog(true)}>{personal ? "Add membership" : "Needs a personal record"}</Button>
            )}
          </Panel>

          {/* discounts */}
          <Panel className="pb-4">
            <PanelHeader className="mb-3" title="Discounts" subtitle="Applied automatically at payment" />
            <SelectField label="Standing discount" value={c.discount?.label ?? "none"} options={DISCOUNTS.map((d) => ({ value: d.value, label: d.label }))}
              onChange={(v) => { const d = DISCOUNTS.find((x) => x.value === v)!; setC({ ...c, discount: d.pct ? { label: d.value, pct: d.pct } : undefined }); }} />
            <p className="mb-1.5 mt-4 text-[12px] font-semibold text-muted">Vouchers they can use</p>
            <ul className="flex flex-col gap-1.5">
              {data.vouchers.filter((v) => v.active && (v.kind !== "first_visit" || c.visitCount <= 1)).map((v) => (
                <li key={v.id} className="flex items-center gap-2.5"><CodeChip tone="grey">{v.code}</CodeChip><span className="truncate text-[12.5px] font-medium text-muted">{v.description}</span></li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-[18px]">
          {/* payments summary */}
          <section className="grid gap-4 sm:grid-cols-3">
            <MiniStat label="Paid in total" value={peso(c.totalSpent)} caption={`${c.visitCount} visits since ${c.visitCount > 10 ? "2025" : "this year"}`} />
            <MiniStat label="Tips given" value={peso(tips)} caption="Last 4 visits · go to the barber" />
            <div className="flex flex-col rounded-card bg-surface px-5 py-[18px] shadow-card">
              <span className="text-[12px] font-semibold text-muted">Usually pays with</span>
              <div className="mt-2 flex flex-wrap gap-1.5">{mix.length ? mix.map((x) => <PaymentPill key={x.m} method={x.m} />) : <span className="text-[13px] font-semibold text-subtle">No payments yet</span>}</div>
              <span className="mt-auto pt-2 text-[12px] font-semibold text-muted">{mix[0] ? `${PAYMENT_LABEL[mix[0].m]} most often` : ""}</span>
            </div>
          </section>

          {/* visit history */}
          <Panel className="pb-2">
            <PanelHeader title="Visit history" subtitle="Payments, discounts and ratings per visit" action={<Badge variant="soft">{visits.length} shown</Badge>} />
            {visits.length ? (
              <div className="-mx-1 mt-3 overflow-x-auto px-1">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead><tr className="text-[12px] text-muted">
                    <th className="pb-2 pl-1 pr-3 font-semibold">Date</th>
                    {["Service", "Barber", "Payment", "Discount"].map((h) => <th key={h} className="whitespace-nowrap pb-2 pr-3 font-semibold">{h}</th>)}
                    <th className="pb-2 pr-3 text-right font-semibold">Amount</th><th className="pb-2 pr-4 text-right font-semibold">Tip</th><th className="pb-2 pr-1 font-semibold">Rating</th>
                  </tr></thead>
                  <tbody>{visits.map((v) => (
                    <tr key={v.id} className="border-t border-line">
                      <td className="whitespace-nowrap py-[9px] pl-1 pr-3 text-[13px] font-semibold text-ink-2">{v.dateLabel}</td>
                      <td className="whitespace-nowrap py-[9px] pr-3 text-[13.5px] font-semibold">{v.serviceLabel}</td>
                      <td className="whitespace-nowrap py-[9px] pr-3 text-[13.5px] font-bold">{v.barberName}</td>
                      <td className="whitespace-nowrap py-[9px] pr-3"><PaymentPill method={v.paymentMethod} /></td>
                      <td className="whitespace-nowrap py-[9px] pr-3">{v.discountLabel ? <Pill>{v.discountLabel}</Pill> : <span className="text-[13px] font-semibold text-subtle">—</span>}</td>
                      <td className="whitespace-nowrap py-[9px] pr-3 text-right text-[14px] font-extrabold">{peso(v.amount)}</td>
                      <td className="whitespace-nowrap py-[9px] pr-4 text-right">{v.tip ? <span className="text-[13.5px] font-bold text-ink-2">+{peso(v.tip)}</span> : <span className="text-[13.5px] font-semibold text-subtle">—</span>}</td>
                      <td className="whitespace-nowrap py-[9px] pr-1">{v.rating ? <Stars value={v.rating} /> : <span className="text-[12.5px] font-semibold text-subtle">No rating</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="py-8 text-center text-[13.5px] font-semibold text-muted">No visits yet.</p>}
          </Panel>

          <Panel className="pb-4">
            <PanelHeader title="Recent messages" subtitle="Texts sent to this customer" />
            <ul className="mt-2 flex flex-col">
              {(c.consent.sms ? [["On queue", "Today 6:10 PM", "Delivered"], ["Thank you", "Sep 20, 4:52 PM", "Delivered"]] : []).map(([t, at, s]) => (
                <li key={t} className="flex items-center gap-3 border-t border-line py-2 first:border-t-0"><MessageSquare size={16} strokeWidth={1.75} className="text-muted" /><b className="flex-1 text-[13.5px]">{t}</b><span className="text-[12.5px] font-semibold text-muted">{at}</span><Pill tone="outline"><Check size={12} strokeWidth={2.4} />{s}</Pill></li>
              ))}
              {!c.consent.sms ? <li className="py-3 text-[13px] font-semibold text-muted">No SMS consent, so no texts are sent.</li> : null}
            </ul>
          </Panel>
        </div>
      </div>

      <QueueQrDialog open={qr} onClose={() => setQr(false)} customer={c} />

      <ConvertDialog open={convert} onClose={() => setConvert(false)} name={c.name}
        onSave={(name, phone) => { setC({ ...c, name, phone, kind: "personal", type: "regular", consent: { sms: true, marketing: false } }); setConvert(false); }} />

      <Dialog open={memberDialog} onClose={() => setMemberDialog(false)} title="Add membership" subtitle={`Collect the first payment at the counter for ${c.name}.`}>
        <ul className="flex flex-col gap-2.5">
          {data.plans.map((p) => (
            <li key={p.id}><button type="button" className="flex w-full items-center justify-between gap-3 rounded-[18px] bg-grey-100 p-4 text-left hover:ring-2 hover:ring-ink"
              onClick={() => { setMembership({ id: "m-new", customerId: c.id, planId: p.id, status: "active", endsAtLabel: p.period === "monthly" ? "Nov 4" : "Oct 4, 2027", creditsRemaining: p.period === "monthly" ? 4 : undefined }); setC({ ...c, type: "member", membershipId: "m-new" }); setMemberDialog(false); }}>
              <span className="flex flex-col leading-tight"><b className="text-[15px]">{p.name}</b><span className="mt-1 text-[12.5px] font-medium text-muted">{p.benefits.join(" · ")}</span></span>
              <b className="text-[15px]">{peso(p.price)}</b>
            </button></li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

function MiniStat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="flex flex-col rounded-card bg-surface px-5 py-[18px] leading-tight shadow-card">
      <span className="text-[12px] font-semibold text-muted">{label}</span><span className="mt-1 text-[24px] font-extrabold tracking-[-0.03em]">{value}</span><span className="mt-1 text-[12px] font-semibold text-muted">{caption}</span>
    </div>
  );
}

function ConvertDialog({ open, onClose, name: initial, onSave }: { open: boolean; onClose: () => void; name: string; onSave: (name: string, phone: string) => void }) {
  const [name, setName] = useState(initial);
  const [phone, setPhone] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Make personal record" subtitle="Ask for consent before saving a number."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!phone.trim()} leadingIcon={<Pencil size={16} strokeWidth={1.75} />} onClick={() => onSave(name, phone.trim())}>Save</Button></>}>
      <div className={cn("flex flex-col gap-4")}>
        <Input size="md" label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input size="md" label="Mobile number" placeholder="+63 917 555 0100" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} hint={`Shown as ${maskPhone(phone || "+63 917 555 0100")} in lists`} />
      </div>
    </Dialog>
  );
}
