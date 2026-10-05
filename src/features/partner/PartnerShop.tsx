"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, MapPin, Phone } from "lucide-react";
import { Button, HeroBanner } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";
import { Toggle } from "@/components/common/Dialog";
import { getRepository } from "@/data";
import { useTier } from "@/lib/tier";
import { usePartner } from "./PartnerShell";
import { ListCard, PageTitle, Section } from "./parts";

const UNLOCKS = ["Walk-in queue and waitlist", "Kiosk with payments and tips", "Sales record", "Customers, vouchers and SMS", "Growth dashboard with AI insights"];

export function PartnerShop() {
  const { shop } = usePartner();
  const { tier } = useTier();
  const router = useRouter();
  const [accepting, setAccepting] = useState(shop.settings.acceptingRiverMobile);
  const [notify, setNotify] = useState(true);
  return (
    <>
      <PageTitle title="Shop" subtitle={tier === "partner" ? "Free Partner plan" : "Paid plan"} back={null} />
      <ListCard>
        <div className="flex items-center gap-3 py-2.5">
          <span className="inline-flex size-12 items-center justify-center rounded-tile bg-grey-100"><BarberIcon name="pole" size={34} /></span>
          <span className="flex min-w-0 flex-col leading-[1.3]"><b className="truncate text-[16px]">{shop.name}</b><span className="truncate text-[12.5px] font-medium text-muted">{shop.city} · River Mobile partner</span></span>
        </div>
        <div className="flex items-center gap-2.5 border-t border-line py-2.5 text-[13px] font-semibold"><MapPin size={16} strokeWidth={1.75} className="flex-none text-muted" /><span className="truncate">{shop.address}</span></div>
        <div className="flex items-center gap-2.5 border-t border-line py-2.5 text-[13px] font-semibold"><Phone size={16} strokeWidth={1.75} className="flex-none text-muted" /><span className="font-mono">{shop.phone}</span></div>
      </ListCard>

      <Section title="River Mobile">
        <ListCard>
          <div className="flex items-center justify-between gap-3 py-2.5"><span className="flex flex-col leading-tight"><b className="text-[14px]">Accept new customers</b><span className="text-[12px] font-medium text-muted">Show my shop in River Mobile</span></span><Toggle label="Accept new customers" checked={accepting} onChange={(v) => { setAccepting(v); void getRepository().updateShopSettings({ acceptingRiverMobile: v }).catch(() => undefined); }} /></div>
          <div className="flex items-center justify-between gap-3 border-t border-line py-2.5"><span className="flex flex-col leading-tight"><b className="text-[14px]">Booking notifications</b><span className="text-[12px] font-medium text-muted">Push and email</span></span><Toggle label="Booking notifications" checked={notify} onChange={setNotify} /></div>
        </ListCard>
      </Section>

      {tier === "partner" ? (
        <Section title="Get the full Barbers.ph">
          <HeroBanner className="mx-4 [&>div:first-of-type>div]:w-full" size="sm" eyebrow="Paid plan" contentWidth="100%" title={<span className="block max-w-[200px]">Run your whole shop from one app</span>}
            illustration={<BarberIcon name="clipper" size={92} />} illustrationClassName="right-3 top-3"
            actions={<>
              <ul className="-mt-1 flex w-full flex-col gap-1 text-[13px] font-medium text-on-ink-muted">{UNLOCKS.map((u) => <li key={u} className="flex items-center gap-1.5"><Lock size={12} strokeWidth={2} />{u}</li>)}</ul>
              <Button variant="white" fullWidth className="mt-1" onClick={() => { router.push("/settings#plans"); }}>See plans · ₱950/mo</Button>
            </>} />
        </Section>
      ) : (
        <Section title="Your plan">
          <ListCard>
            <ul className="flex flex-col gap-1.5 py-2.5 text-[13px] font-semibold">{UNLOCKS.map((u) => <li key={u} className="flex items-center gap-1.5"><Check size={14} strokeWidth={2.4} />{u}</li>)}</ul>
            <div className="border-t border-line py-2.5"><Button fullWidth href="/dashboard">Open owner dashboard</Button></div>
          </ListCard>
        </Section>
      )}
    </>
  );
}
