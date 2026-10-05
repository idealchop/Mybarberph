"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ExternalLink, Lock, MonitorSmartphone, Smartphone } from "lucide-react";
import { Badge, Button, cn, IconTile, Input, SegmentedControl } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";
import { SelectField, Toggle } from "@/components/common/Dialog";
import { QrCode } from "@/components/common/QrCode";
import { Panel, PanelHeader } from "@/components/common/ui";
import { PageColumn } from "@/components/shell/PageColumn";
import { PageHeader } from "@/components/shell/PageHeader";
import { LocationPicker } from "@/components/settings/LocationPicker";
import { ShopPhotosGallery } from "@/components/settings/ShopPhotosGallery";
import { getRepository, type BillingPlan, type Shop, type ShopLocation } from "@/data";
import { PLANS, planLabel } from "@/lib/billing";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { useTier } from "@/lib/tier";

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-3.5 first:border-t-0">
      <span className="flex flex-col leading-snug"><b className="text-[14px]">{title}</b>{hint ? <span className="mt-0.5 text-[12.5px] font-medium text-muted">{hint}</span> : null}</span>
      {children}
    </div>
  );
}

export function Settings({ shop: initial }: { shop: Shop }) {
  const { tier, setTier, can, syncFromShop } = useTier();
  const { requireAuth, isAuthenticated } = useAuthGate();
  const router = useRouter();
  const params = useSearchParams();
  const [shop, setShop] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [planBusy, setPlanBusy] = useState<BillingPlan | null>(null);
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const s = shop.settings;
  const set = (patch: Partial<Shop["settings"]>) => {
    setShop((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
    void getRepository().updateShopSettings(patch);
  };
  const paid = can("kiosk");
  const currentPlan = shop.billingPlan ?? (tier === "paid" ? "monthly_950" : "partner");

  useEffect(() => {
    const billing = params.get("billing");
    const plan = params.get("plan") as BillingPlan | null;
    if (billing === "success" && plan) {
      void (async () => {
        const res = await fetch("/api/billing/demo-activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billingPlan: plan }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.shop) {
          setShop(json.shop);
          syncFromShop(json.shop.tier);
          setPlanMsg("Payment received — plan is active.");
        }
        router.replace("/settings");
      })();
    } else if (billing === "cancel") {
      setPlanMsg("Checkout canceled. Your previous plan is unchanged.");
      router.replace("/settings");
    }
  }, [params, router, syncFromShop]);

  async function saveProfile() {
    if (!isAuthenticated) {
      requireAuth(() => void saveProfile(), "Sign in to save your shop profile.");
      return;
    }
    const next = await getRepository().updateShopProfile({
      name: shop.name,
      phone: shop.phone,
      address: shop.address,
      city: shop.city,
      hours: shop.hours,
      location: shop.location,
    });
    setShop(next);
    setSaved(true);
  }

  async function selectPlan(plan: BillingPlan) {
    if (!isAuthenticated) {
      requireAuth(() => void selectPlan(plan), "Sign in to choose a plan.");
      return;
    }
    setPlanMsg(null);
    setPlanBusy(plan);
    try {
      if (plan === "partner") {
        const next = await getRepository().updateShopBilling({ billingPlan: "partner", billingStatus: "active" });
        setShop(next);
        setTier("partner");
        setPlanMsg("Switched to free Partner.");
        return;
      }
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingPlan: plan }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        mode?: string; checkoutUrl?: string; message?: string; error?: string; billingPlan?: BillingPlan;
      };
      if (!res.ok) throw new Error(json.error || "Checkout failed");
      if (json.mode === "paymongo" && json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      // pending without PayMongo — refresh shop and offer demo activate
      const pending = await getRepository().getShop();
      setShop(pending);
      setPlanMsg(json.message || "Plan pending. Connect PayMongo, or demo-activate below.");
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Could not start checkout");
    } finally {
      setPlanBusy(null);
    }
  }

  async function demoActivate(plan: BillingPlan) {
    if (!isAuthenticated) {
      requireAuth(() => void demoActivate(plan), "Sign in to activate a plan.");
      return;
    }
    setPlanBusy(plan);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/billing/demo-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingPlan: plan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Activate failed");
      setShop(json.shop);
      setTier(json.shop.tier);
      setPlanMsg(`Activated ${planLabel(plan)} (demo — no PayMongo charge).`);
      router.refresh();
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Activate failed");
    } finally {
      setPlanBusy(null);
    }
  }

  return (
    <PageColumn wide>
      <PageHeader
        title="Settings"
        subtitle={`${shop.name} · ${planLabel(currentPlan)}${shop.billingStatus === "pending" ? " · payment pending" : ""}`}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="pb-5">
            <PanelHeader className="mb-4" title="Shop profile" subtitle="Shown on River Mobile and customer texts" />
            <div className="grid gap-4 md:grid-cols-2">
              <Input size="md" label="Shop name" value={shop.name} onChange={(e) => { setShop({ ...shop, name: e.target.value }); setSaved(false); }} />
              <Input size="md" label="Phone" value={shop.phone} onChange={(e) => { setShop({ ...shop, phone: e.target.value }); setSaved(false); }} />
              <Input size="md" label="City" value={shop.city} onChange={(e) => { setShop({ ...shop, city: e.target.value }); setSaved(false); }} />
              {shop.hours.map((h, i) => (
                <Input key={h.day} size="md" label={`Hours · ${h.day}`} value={`${h.open} – ${h.close}`}
                  onChange={(e) => { const [open = "", close = ""] = e.target.value.split("–").map((x) => x.trim()); setShop({ ...shop, hours: shop.hours.map((x, j) => j === i ? { ...x, open, close } : x) }); setSaved(false); }} />
              ))}
              <LocationPicker
                address={shop.address}
                location={shop.location}
                onAddressChange={(address) => { setShop((x) => ({ ...x, address })); setSaved(false); }}
                onLocationChange={(location: ShopLocation) => { setShop((x) => ({ ...x, location, address: location.formattedAddress || x.address })); setSaved(false); }}
              />
              <ShopPhotosGallery shop={shop} onChange={(next) => { setShop(next); setSaved(false); }} />
            </div>
            <Button className="mt-5" leadingIcon={saved ? <Check size={17} strokeWidth={2} /> : undefined} onClick={() => void saveProfile()}>{saved ? "Saved" : "Save profile & location"}</Button>
          </Panel>

          <Panel className="pb-2">
            <div className="flex items-start gap-3"><IconTile size={44}><BarberIcon name="qr" size={30} /></IconTile><PanelHeader title="River Mobile" subtitle="Bookings, queue tickets and verification" /></div>
            <div className="mt-3">
              <Row title="Accept River Mobile customers" hint="Show in River Mobile search"><Toggle label="Accept River Mobile customers" checked={s.acceptingRiverMobile} onChange={(v) => set({ acceptingRiverMobile: v })} /></Row>
              <Row title="Require Scan to verify" hint="Visit counts after you scan their code"><Toggle label="Require Scan to verify" checked={s.requireScanVerification} onChange={(v) => set({ requireScanVerification: v })} /></Row>
              <Row title="Auto-accept after a good scan"><Toggle label="Auto-accept" checked={s.autoAcceptScans} onChange={(v) => set({ autoAcceptScans: v })} /></Row>
              <Row title="Email me on every scan"><Toggle label="Email on scan" checked={s.emailOwnerOnScan} onChange={(v) => set({ emailOwnerOnScan: v })} /></Row>
              <Row title="Text me on every scan" hint="SMS to the owner number"><Toggle label="SMS on scan" checked={s.smsOwnerOnScan} onChange={(v) => set({ smsOwnerOnScan: v })} /></Row>
            </div>
          </Panel>

          <Panel className="relative pb-2">
            <div className="flex items-start gap-3"><IconTile size={44}><BarberIcon name="ticket" size={30} /></IconTile><PanelHeader title="Queue & kiosk" subtitle="Walk-ins, tablet and payments" action={paid ? undefined : <Badge variant="solid"><Lock size={11} strokeWidth={2.4} className="mr-1" />Paid</Badge>} /></div>
            <div className={cn("mt-3", !paid && "pointer-events-none select-none opacity-45")} aria-disabled={!paid}>
              <Row title="Queue mode" hint="One line, or a line per barber">
                <SegmentedControl label="Queue mode" value={s.queueMode} onChange={(v) => set({ queueMode: v })} options={[{ value: "single", label: "One line" }, { value: "per_barber", label: "Per barber" }]} />
              </Row>
              <Row title="Kiosk (POS 2)" hint="Tablet for barber + haircut"><Toggle label="Kiosk enabled" checked={s.kioskEnabled} onChange={(v) => set({ kioskEnabled: v })} /></Row>
              <Row title="Ask for tips at payment" hint="Tips stay out of sales totals"><Toggle label="Tips" checked={s.tipsEnabled} onChange={(v) => set({ tipsEnabled: v })} /></Row>
              <Row title="Auto-complete after" hint="If nobody confirms the cut">
                <SelectField label="Auto-complete after" value={String(s.confirmCompleteTimeoutMins)} onChange={(v) => set({ confirmCompleteTimeoutMins: Number(v) })} options={["10", "15", "30"].map((m) => ({ value: m, label: `${m} minutes` }))} className="[&>label]:sr-only" />
              </Row>
            </div>
            {!paid ? <div className="mt-2 border-t border-line py-3"><Button size="sm" href="#plans">See plans</Button></div> : null}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel id="plans" className="pb-5">
            <PanelHeader className="mb-4" title="How you’re paid" subtitle="Partner is free. Paid unlocks the full shop." />
            <div className="flex flex-col gap-2.5">
              {PLANS.map((p) => {
                const current = currentPlan === p.id && shop.billingStatus !== "pending";
                const pending = shop.billingPlan === p.id && shop.billingStatus === "pending";
                return (
                  <div key={p.id} className={cn("rounded-[18px] p-3.5", current ? "bg-ink text-on-ink" : "bg-grey-100")}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col leading-snug">
                        <b className="text-[15px]">{p.label}</b>
                        <span className={cn("mt-0.5 text-[12.5px] font-semibold", current ? "text-on-ink-muted" : "text-muted")}>{p.priceLabel}</span>
                        <span className={cn("mt-1.5 text-[12.5px] font-medium leading-snug", current ? "text-on-ink-muted" : "text-muted")}>{p.description}</span>
                      </span>
                      {current ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-bold"><Check size={12} strokeWidth={2.6} />Current</span>
                      ) : pending ? (
                        <Badge variant={current ? "on-ink" : "soft"}>Pending</Badge>
                      ) : null}
                    </div>
                    <ul className={cn("mt-3 flex flex-col gap-1.5 text-[12.5px] font-semibold", current ? "text-on-ink-muted" : "text-muted")}>
                      {p.features.slice(0, 4).map((f) => (
                        <li key={f} className="flex items-center gap-2"><Check size={13} strokeWidth={2.2} />{f}</li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!current ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={planBusy !== null}
                          onClick={() => void selectPlan(p.id)}
                        >
                          {planBusy === p.id ? "Working…" : p.id === "partner" ? "Switch to Partner" : `Choose ${p.priceLabel}`}
                        </Button>
                      ) : null}
                      {pending && p.id !== "partner" ? (
                        <Button size="sm" disabled={planBusy !== null} onClick={() => void demoActivate(p.id)}>
                          Demo activate
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {planMsg ? <p className="mt-4 rounded-tile bg-grey-100 px-3 py-2.5 text-[12.5px] font-semibold leading-snug text-muted">{planMsg}</p> : null}
            <p className="mt-3 text-[12px] font-semibold leading-snug text-muted">
              Card checkout uses PayMongo when <code className="font-mono">PAYMONGO_SECRET_KEY</code> is set. Without it, choose a plan → Pending → Demo activate for testing.
            </p>
          </Panel>

          <Panel className="pb-4">
            <div className="flex items-start gap-3"><IconTile size={44}><MonitorSmartphone size={22} strokeWidth={1.75} /></IconTile><PanelHeader title="Kiosk tablet" subtitle={paid ? "Open on the counter tablet" : "Available on Paid"} /></div>
            <div className={cn("mt-3 flex items-center gap-3 rounded-[18px] bg-grey-100 p-3", !paid && "opacity-45")}>
              <span className="flex flex-col leading-snug"><small className="text-[12px] font-semibold text-muted">Pairing code</small><b className="font-mono text-[22px] tracking-[0.12em]">KK·4821</b></span>
              <span className="ml-auto text-right text-[12px] font-medium text-muted">Open /kiosk<br />on the tablet</span>
            </div>
            <Button className="mt-3" variant="secondary" fullWidth disabled={!paid} href={paid ? "/kiosk" : undefined} trailingIcon={<ExternalLink size={16} strokeWidth={1.75} />}>Open kiosk</Button>
          </Panel>

          <Panel className="pb-4">
            <div className="flex items-start gap-3"><IconTile size={44}><Smartphone size={22} strokeWidth={1.75} /></IconTile><PanelHeader title="Partner app" subtitle="Scan River Mobile customers from your phone" /></div>
            <div className="mt-3 flex items-center gap-3">
              <span className="rounded-tile bg-surface p-1 shadow-tile"><QrCode value="https://barbers.ph/partner" size={84} label="Open the partner app" /></span>
              <span className="text-[12.5px] font-medium leading-snug text-muted">Scan with your phone, or open it here.</span>
            </div>
            <Button className="mt-3" fullWidth href="/partner" trailingIcon={<ExternalLink size={16} strokeWidth={1.75} />}>Open partner app</Button>
          </Panel>
        </div>
      </div>
    </PageColumn>
  );
}
