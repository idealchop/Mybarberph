"use client";

import { Card, Topbar } from "@river-apps/ui";
import { shop } from "@/data";
import { bookableServices } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { useTier } from "@/lib/tier";

/** Shop profile and plan. Reached from the avatar, not the tab bar. */
export function AccountScreen() {
  const { tier, setTier } = useTier();
  const paid = tier === "paid";

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <Topbar title="Account" subtitle={shop.ownerName} />
      <Card className="mt-4 px-5 py-5">
        <b className="text-[18px]">{shop.name}</b>
        <p className="mt-1 text-[14px] font-medium text-ink-2">{shop.address}</p>
        <p className="mt-1 text-[14px] font-semibold text-muted">{shop.phone}</p>
        <ul className="mt-3 flex flex-col gap-1 text-[14px] font-semibold">
          {shop.hours.map((h) => <li key={h.day}>{h.day} · {h.open} – {h.close}</li>)}
        </ul>
      </Card>
      <Card className="mt-3 px-5 py-5">
        <b className="text-[16px]">Haircuts</b>
        <ul className="mt-3 divide-y divide-line">
          {bookableServices.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5">
              <span className="font-semibold">{s.name}</span>
              <span className="text-[14px] font-bold">{peso(s.price)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="mt-3 px-5 py-5">
        <b className="text-[16px]">Plan</b>
        <p className="mt-1 text-[14px] font-medium text-ink-2">
          {paid ? "Paid includes walk-ins, the shop QR, and the live status page." : "Partner includes Home, Queue, and Community. Online bookings land in Queue."}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <PlanButton on={tier === "partner"} title="Partner" detail="Free" onClick={() => setTier("partner")} />
          <PlanButton on={paid} title="Paid" detail="Walk-ins and QR" onClick={() => setTier("paid")} />
        </div>
      </Card>
    </div>
  );
}

function PlanButton({ on, title, detail, onClick }: { on: boolean; title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-[16px] px-4 py-3 text-left ${on ? "bg-ink text-on-ink" : "bg-grey-100"}`}>
      <b className="block text-[15px]">{title}</b>
      <small className={`text-[12.5px] font-semibold ${on ? "text-on-ink/70" : "text-muted"}`}>{detail}</small>
    </button>
  );
}
