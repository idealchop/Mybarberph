"use client";
import { useState, type ReactNode } from "react";
import { Check, ExternalLink, Lock, MonitorSmartphone, Smartphone } from "lucide-react";
import { Badge, Button, cn, IconTile, Input, SegmentedControl } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";
import { SelectField, Toggle } from "@/components/common/Dialog";
import { QrCode } from "@/components/common/QrCode";
import { Panel, PanelHeader } from "@/components/common/ui";
import { PageHeader } from "@/components/shell/PageHeader";
import { getRepository, type Shop } from "@/data";
import { useTier } from "@/lib/tier";

const PARTNER = ["River Mobile bookings and queue tickets", "Scan to verify visits", "Verified visit history", "Booking notifications"];
const PAID = ["Everything in Partner", "Walk-in queue and waitlist", "Kiosk (POS 2) with payments and tips", "Sales record and CSV export", "Customers CRM, memberships, discounts", "Vouchers, referrals and SMS templates", "Growth dashboard with AI insights"];

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0">
      <span className="flex flex-col leading-tight"><b className="text-[14px]">{title}</b>{hint ? <span className="mt-0.5 text-[12.5px] font-medium text-muted">{hint}</span> : null}</span>
      {children}
    </div>
  );
}

export function Settings({ shop: initial }: { shop: Shop }) {
  const { tier, setTier, can } = useTier();
  const [shop, setShop] = useState(initial);
  const [saved, setSaved] = useState(false);
  const s = shop.settings;
  const set = (patch: Partial<Shop["settings"]>) => { setShop((x) => ({ ...x, settings: { ...x.settings, ...patch } })); void getRepository().updateShopSettings(patch); };
  const paid = can("kiosk");

  return (
    <>
      <PageHeader title="Settings" subtitle={`${shop.name} · ${tier === "paid" ? "Paid plan" : "Free Partner plan"}`} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          {/* shop */}
          <Panel className="pb-4">
            <PanelHeader className="mb-4" title="Shop profile" subtitle="Shown on River Mobile and on customer texts" />
            <div className="grid gap-4 md:grid-cols-2">
              <Input size="md" label="Shop name" value={shop.name} onChange={(e) => { setShop({ ...shop, name: e.target.value }); setSaved(false); }} />
              <Input size="md" label="Phone" value={shop.phone} onChange={(e) => { setShop({ ...shop, phone: e.target.value }); setSaved(false); }} />
              <Input size="md" label="Address" containerClassName="md:col-span-2" value={shop.address} onChange={(e) => { setShop({ ...shop, address: e.target.value }); setSaved(false); }} />
              {shop.hours.map((h, i) => (
                <Input key={h.day} size="md" label={`Hours · ${h.day}`} value={`${h.open} – ${h.close}`}
                  onChange={(e) => { const [open = "", close = ""] = e.target.value.split("–").map((x) => x.trim()); setShop({ ...shop, hours: shop.hours.map((x, j) => j === i ? { ...x, open, close } : x) }); setSaved(false); }} />
              ))}
            </div>
            <Button className="mt-4" leadingIcon={saved ? <Check size={17} strokeWidth={2} /> : undefined} onClick={() => setSaved(true)}>{saved ? "Saved" : "Save profile"}</Button>
          </Panel>

          {/* River Mobile */}
          <Panel className="pb-2">
            <div className="flex items-start gap-3"><IconTile size={44}><BarberIcon name="qr" size={30} /></IconTile><PanelHeader title="River Mobile" subtitle="Partner API · bookings, queue tickets and verification" /></div>
            <div className="mt-3">
              <Row title="Accept River Mobile customers" hint="Your shop shows in River Mobile search and can receive bookings"><Toggle label="Accept River Mobile customers" checked={s.acceptingRiverMobile} onChange={(v) => set({ acceptingRiverMobile: v })} /></Row>
              <Row title="Require Scan to verify" hint="A visit only counts after you scan the customer’s code"><Toggle label="Require Scan to verify" checked={s.requireScanVerification} onChange={(v) => set({ requireScanVerification: v })} /></Row>
              <Row title="Auto-accept after a good scan" hint="Skip the Accept step and add them to the queue"><Toggle label="Auto-accept" checked={s.autoAcceptScans} onChange={(v) => set({ autoAcceptScans: v })} /></Row>
              <Row title="Email me on every scan"><Toggle label="Email on scan" checked={s.emailOwnerOnScan} onChange={(v) => set({ emailOwnerOnScan: v })} /></Row>
              <Row title="Text me on every scan" hint="SMS to the owner number"><Toggle label="SMS on scan" checked={s.smsOwnerOnScan} onChange={(v) => set({ smsOwnerOnScan: v })} /></Row>
            </div>
          </Panel>

          {/* queue & kiosk (paid) */}
          <Panel className="relative pb-2">
            <div className="flex items-start gap-3"><IconTile size={44}><BarberIcon name="ticket" size={30} /></IconTile><PanelHeader title="Queue & kiosk" subtitle="Walk-ins, the kiosk tablet and payments" action={paid ? undefined : <Badge variant="solid"><Lock size={11} strokeWidth={2.4} className="mr-1" />Paid</Badge>} /></div>
            <div className={cn("mt-3", !paid && "pointer-events-none select-none opacity-45")} aria-disabled={!paid}>
              <Row title="Queue mode" hint="One line for everyone, or a line per barber">
                <SegmentedControl label="Queue mode" value={s.queueMode} onChange={(v) => set({ queueMode: v })} options={[{ value: "single", label: "One line" }, { value: "per_barber", label: "Per barber" }]} />
              </Row>
              <Row title="Kiosk (POS 2)" hint="Customers pick a barber and haircut on the tablet"><Toggle label="Kiosk enabled" checked={s.kioskEnabled} onChange={(v) => set({ kioskEnabled: v })} /></Row>
              <Row title="Ask for tips at payment" hint="Tips go to the barber and are kept out of sales"><Toggle label="Tips" checked={s.tipsEnabled} onChange={(v) => set({ tipsEnabled: v })} /></Row>
              <Row title="Auto-complete after" hint="If nobody taps “Confirm haircut is done”">
                <SelectField label="Auto-complete after" value={String(s.confirmCompleteTimeoutMins)} onChange={(v) => set({ confirmCompleteTimeoutMins: Number(v) })} options={["10", "15", "30"].map((m) => ({ value: m, label: `${m} minutes` }))} className="[&>label]:sr-only" />
              </Row>
            </div>
            {!paid ? <div className="mt-2 border-t border-line py-3"><Button size="sm" onClick={() => setTier("paid")}>Upgrade to Paid</Button></div> : null}
          </Panel>
        </div>

        <div className="flex flex-col gap-[18px]">
          {/* plan */}
          <Panel className="pb-4">
            <PanelHeader className="mb-3" title="Plan" subtitle="Partner is free. Paid unlocks the whole Barbers.ph." />
            <div className="grid grid-cols-2 gap-2.5">
              {(["partner", "paid"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTier(t)} aria-pressed={tier === t}
                  className={cn("flex flex-col rounded-[18px] p-3.5 text-left leading-tight transition-colors", tier === t ? "bg-ink text-on-ink" : "bg-grey-100 hover:bg-grey-200/70")}>
                  <b className="text-[15px]">{t === "partner" ? "Partner" : "Paid"}</b>
                  <span className={cn("mt-0.5 text-[12.5px] font-semibold", tier === t ? "text-on-ink-muted" : "text-muted")}>{t === "partner" ? "Free" : "₱999 / month"}</span>
                  {tier === t ? <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-bold"><Check size={12} strokeWidth={2.6} />Current</span> : null}
                </button>
              ))}
            </div>
            <ul className="mt-4 flex flex-col gap-2 text-[13px] font-semibold">
              {(tier === "paid" ? PAID : PARTNER).map((f) => <li key={f} className="flex items-center gap-2"><Check size={15} strokeWidth={2.2} />{f}</li>)}
              {tier === "partner" ? PAID.slice(1).map((f) => <li key={f} className="flex items-center gap-2 text-subtle"><Lock size={13} strokeWidth={2} />{f}</li>) : null}
            </ul>
            <p className="mt-4 rounded-tile bg-grey-100 px-3 py-2.5 text-[12px] font-semibold text-muted">Changing plan updates this shop in Firestore. Card billing through River Apps / PayMongo is not wired yet — use this to switch Partner ↔ Paid while building.</p>
          </Panel>

          {/* kiosk pairing */}
          <Panel className="pb-4">
            <div className="flex items-start gap-3"><IconTile size={44}><MonitorSmartphone size={22} strokeWidth={1.75} /></IconTile><PanelHeader title="Kiosk tablet" subtitle={paid ? "1 paired · Lenovo Tab M10 · last seen just now" : "Available on Paid"} /></div>
            <div className={cn("mt-3 flex items-center gap-3 rounded-[18px] bg-grey-100 p-3", !paid && "opacity-45")}>
              <span className="flex flex-col leading-tight"><small className="text-[12px] font-semibold text-muted">Pairing code</small><b className="font-mono text-[22px] tracking-[0.12em]">KK·4821</b></span>
              <span className="ml-auto text-right text-[12px] font-medium text-muted">Open barbers.ph/kiosk<br />on the tablet</span>
            </div>
            <Button className="mt-3" variant="secondary" fullWidth disabled={!paid} href={paid ? "/kiosk" : undefined} trailingIcon={<ExternalLink size={16} strokeWidth={1.75} />}>Open kiosk</Button>
          </Panel>

          {/* partner app */}
          <Panel className="pb-4">
            <div className="flex items-start gap-3"><IconTile size={44}><Smartphone size={22} strokeWidth={1.75} /></IconTile><PanelHeader title="Partner app" subtitle="Scan and verify River Mobile customers from your phone" /></div>
            <div className="mt-3 flex items-center gap-3">
              <span className="rounded-tile bg-surface p-1 shadow-tile"><QrCode value="https://barbers.ph/partner" size={84} label="Open the partner app" /></span>
              <span className="text-[12.5px] font-medium text-muted">Scan with your phone camera, or open it here.</span>
            </div>
            <Button className="mt-3" fullWidth href="/partner" trailingIcon={<ExternalLink size={16} strokeWidth={1.75} />}>Open partner app</Button>
          </Panel>
        </div>
      </div>
    </>
  );
}
