"use client";
import { useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { Avatar, Badge, Button, Card, cn, IconTile, Input, ListItem, ProgressRing, SegmentedControl, Topbar } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";
import { Dialog, Toggle } from "@/components/common/Dialog";
import { QrCode } from "@/components/common/QrCode";
import { Panel, PanelHeader } from "@/components/common/ui";
import { PageColumn } from "@/components/shell/PageColumn";
import { getRepository, type Customer, type ReferralStats, type Voucher } from "@/data";
import { peso } from "@/lib/format";

export interface VouchersData { vouchers: Voucher[]; referral: ReferralStats; customers: Customer[] }
const KIND: Record<Voucher["kind"], string> = { voucher: "Voucher", referral: "Referral", first_visit: "First visit" };
const valueLabel = (v: Voucher) => v.discountType === "fixed" ? `${peso(v.value)} off` : `${v.value}% off`;

export function Vouchers({ data }: { data: VouchersData }) {
  const [vouchers, setVouchers] = useState(data.vouchers);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const r = data.referral;
  const used = vouchers.reduce((a, v) => a + v.usedThisMonth, 0);
  const given = vouchers.reduce((a, v) => a + v.usedThisMonth * (v.discountType === "fixed" ? v.value : Math.round(25000 * v.value / 100)), 0);
  const referrers = data.customers.filter((c) => c.kind === "personal").slice(0, 4).map((c, i) => ({ c, n: [6, 4, 3, 2][i]! }));

  const copy = (code: string) => { void navigator.clipboard?.writeText(code).catch(() => undefined); setCopied(code); setTimeout(() => setCopied(null), 1500); };

  return (
    <PageColumn>
      <Topbar
        className="px-1"
        title="Vouchers & referrals"
        subtitle={`${r.month} · ${r.redeemedToday} redeemed today · ${r.referrals} of ${r.referralGoal} referrals`}
        actions={<Button size="md" leadingIcon={<Plus size={18} strokeWidth={1.75} />} onClick={() => setCreating(true)}>Create voucher</Button>}
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="relative flex items-center justify-between overflow-hidden rounded-card bg-ink px-5 py-[18px] text-on-ink shadow-raised">
          <i aria-hidden className="pointer-events-none absolute -right-20 -top-[120px] size-[260px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0)_65%)]" />
          <div className="relative flex flex-col leading-tight"><span className="text-[12px] font-semibold text-on-ink-muted">Referrals this month</span><span className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">{r.referrals}<span className="text-[15px] text-on-ink-muted"> / {r.referralGoal}</span></span><span className="mt-1 text-[12px] font-semibold text-on-ink-muted">Goal: {r.referralGoal} new customers</span></div>
          <ProgressRing value={Math.round((r.referrals / r.referralGoal) * 100)} size={60} thickness={7} tone="inverse" label={`${Math.round((r.referrals / r.referralGoal) * 100)}%`} labelSize={13} ariaLabel="Referral goal progress" />
        </div>
        <Stat label="Redeemed today" value={String(r.redeemedToday)} caption={`${used} this month`} icon="ticket" />
        <Stat label="Discounts given" value={peso(given)} caption="This month, all codes" icon="gift" />
        <Stat label="Active codes" value={String(vouchers.filter((v) => v.active).length)} caption={`${vouchers.filter((v) => v.partnerRedeemable && v.active).length} usable on River Mobile`} icon="qr" />
      </section>

      <div className="mt-[18px] grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card padding="none" className="min-w-0 px-4 py-1.5">
          <div className="px-1 pb-2 pt-3">
            <PanelHeader title="Codes" subtitle="Show at payment or on the kiosk" />
          </div>
          <ul aria-label="Voucher codes">
            {vouchers.map((v) => (
              <li key={v.id} className="border-b border-line last:border-b-0">
                <ListItem
                  variant="row"
                  className="py-2.5"
                  leading={
                    <span className={cn("inline-flex min-w-[72px] items-center justify-center rounded-sm px-2 py-1.5 font-mono text-[13px] font-bold tracking-[0.04em]", v.active ? "bg-ink text-on-ink" : "bg-grey-100 text-muted")}>
                      {v.code}
                    </span>
                  }
                  title={<>{valueLabel(v)} <span className="ml-1 text-[12.5px] font-semibold text-muted">{KIND[v.kind]}</span></>}
                  subtitle={`${v.description} · ${v.redemptionCount} redeemed${v.maxRedemptions ? ` of ${v.maxRedemptions}` : ""} · ${v.usedThisMonth} this month${v.partnerRedeemable ? " · River Mobile" : ""}${v.validUntil ? ` · until ${v.validUntil}` : ""}`}
                  trailing={
                    <span className="flex items-center gap-2">
                      <button type="button" aria-label={`Copy ${v.code}`} onClick={() => copy(v.code)} className="inline-flex size-8 items-center justify-center rounded-full bg-grey-100 text-ink">
                        {copied === v.code ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.75} />}
                      </button>
                      <Toggle label={`${v.code} active`} checked={v.active} onChange={(on) => { const next = { ...v, active: on }; setVouchers((all) => all.map((x) => x.id === v.id ? next : x)); void getRepository().saveVoucher(next).catch(() => undefined); }} />
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-[18px]">
          <Panel className="pb-4">
            <div className="flex items-start gap-3"><IconTile size={48}><BarberIcon name="gift" size={34} /></IconTile><PanelHeader title="Refer a friend" subtitle="KAIBIGAN · ₱100 off for both" /></div>
            <ol className="mt-3 flex flex-col gap-2 text-[13px] font-semibold">
              {["Regular shares their personal code or QR", "Friend gets ₱100 off the first cut", "Regular gets ₱100 off after the friend pays"].map((s, i) => (
                <li key={s} className="flex items-center gap-2"><span className="inline-flex size-5 flex-none items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-on-ink">{i + 1}</span>{s}</li>
              ))}
            </ol>
            <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-grey-100 p-3">
              <span className="rounded-tile bg-surface p-1.5"><QrCode value="https://barbers.ph/r/kanto-kings-marikina/KAIBIGAN" size={84} label="Referral QR" /></span>
              <span className="flex flex-col leading-tight"><b className="text-[14px]">Counter poster</b><span className="mt-0.5 text-[12px] font-medium text-muted">Print it for the mirror or door.</span><Button size="xs" variant="secondary" className="mt-2 w-fit" onClick={() => window.print()}>Print</Button></span>
            </div>
          </Panel>
          <Panel className="pb-3">
            <PanelHeader className="mb-1" title="Top referrers" subtitle={r.month} />
            <ul>{referrers.map(({ c, n }, i) => (
              <li key={c.id} className="flex items-center gap-3 py-[7px]"><span className="w-4 font-mono text-[12px] font-semibold text-muted">{i + 1}</span><Avatar name={c.name} preset={c.avatar} size={34} />
                <a href={`/customers/${c.id}`} className="flex min-w-0 flex-1 flex-col leading-[1.3]"><b className="truncate text-[14px]">{c.name}</b><span className="text-[12.5px] font-medium text-muted">{peso(n * 10000)} in rewards</span></a>
                <Badge variant={i === 0 ? "solid" : "soft"}>{n} friends</Badge></li>
            ))}</ul>
          </Panel>
        </div>
      </div>

      {creating ? <CreateVoucher onClose={() => setCreating(false)} onSave={(v) => { setVouchers((all) => [v, ...all]); setCreating(false); void getRepository().saveVoucher(v).catch(() => undefined); }} /> : null}
    </PageColumn>
  );
}

function Stat({ label, value, caption, icon }: { label: string; value: string; caption: string; icon: "ticket" | "gift" | "qr" }) {
  return (
    <div className="flex items-start justify-between rounded-card bg-surface px-5 py-[18px] shadow-card">
      <div className="flex flex-col leading-tight"><span className="text-[12px] font-semibold text-muted">{label}</span><span className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">{value}</span><span className="mt-1 text-[12px] font-semibold text-muted">{caption}</span></div>
      <IconTile size={40} style={{ borderRadius: 12 }}><BarberIcon name={icon} size={28} /></IconTile>
    </div>
  );
}

function CreateVoucher({ onClose, onSave }: { onClose: () => void; onSave: (v: Voucher) => void }) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"fixed" | "percent">("fixed");
  const [value, setValue] = useState("50");
  const [max, setMax] = useState("100");
  const [until, setUntil] = useState("Dec 31");
  const [partner, setPartner] = useState(false);
  const n = Number(value) || 0;
  const valid = /^[A-Z0-9]{4,12}$/.test(code) && n > 0 && (type === "fixed" || n <= 100);
  return (
    <Dialog open onClose={onClose} title="Create voucher" subtitle="Codes are 4–12 letters or numbers."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => onSave({ id: `v-${code.toLowerCase()}`, code, kind: "voucher", description: type === "fixed" ? `₱${n} off` : `${n}% off`, discountType: type, value: type === "fixed" ? n * 100 : n, maxRedemptions: Number(max) || undefined, redemptionCount: 0, usedThisMonth: 0, validUntil: until || undefined, active: true, partnerRedeemable: partner })}>Create</Button></>}>
      <div className="flex flex-col gap-4">
        <Input size="md" label="Code" placeholder="PASKO50" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} className="font-mono" />
        <div className="flex flex-col"><span className="mb-2 text-[14px] font-bold">Discount</span>
          <SegmentedControl label="Discount type" value={type} onChange={setType} options={[{ value: "fixed", label: "Peso amount" }, { value: "percent", label: "Percent" }]} /></div>
        <div className="grid grid-cols-2 gap-4">
          <Input size="md" label={type === "fixed" ? "Amount (₱)" : "Percent (%)"} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} />
          <Input size="md" label="Max uses" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} />
        </div>
        <Input size="md" label="Valid until" value={until} onChange={(e) => setUntil(e.target.value)} />
        <div className="flex items-center justify-between rounded-tile bg-grey-100 px-4 py-3"><span className="text-[13.5px] font-bold">Redeemable on River Mobile</span><Toggle label="Redeemable on River Mobile" checked={partner} onChange={setPartner} /></div>
      </div>
    </Dialog>
  );
}
