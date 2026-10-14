"use client";

import { Button, Input } from "@river-apps/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarberIcon } from "@/components/art";
import { PageBack } from "@/components/shell/PageBack";
import { refCode, seatWalkIn } from "@/lib/chair-bookings";
import { cloudSnapshot } from "@/lib/cloud";
import { useShopLocations } from "@/lib/shop-locations";
import { useShopMenu } from "@/lib/shop-services";
import { useWalkInAllowance } from "@/lib/walkin-limit";
import { HOME_LOCATION_ID } from "@/lib/shop-locations";

/** Walk-in counter: they sit down immediately. Partner: 10 a day per shop; Pro and Lifetime: unlimited. */
export function WalkInScreen() {
  const shops = useShopLocations();
  const allowance = useWalkInAllowance(shops.scopeId ?? HOME_LOCATION_ID);
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const { haircut, treatments } = useShopMenu();
  const [picked, setPicked] = useState<string[]>([]);

  const chosen = treatments.filter((t) => picked.includes(t.id));
  const menuTotal = (haircut.price ?? 0) + chosen.reduce((sum, t) => sum + (t.price ?? 0), 0);
  const [priceText, setPriceText] = useState("");
  const pricePesos = priceText ? Number(priceText) : menuTotal;
  const serviceName = [haircut.name, ...chosen.map((t) => t.name)].join(" · ");

  const save = () => {
    if (allowance.atLimit) { setNote(allowance.message); return; }
    if (!(pricePesos > 0)) { setNote("Enter the price so it counts in Sales."); return; }
    const now = Date.now();
    const chair = seatWalkIn({
      id: `wk-${now}`,
      shopId: cloudSnapshot().shopId ?? "",
      ref: refCode(),
      channel: "walk-in",
      status: "accepted",
      contact: "",
      customerLabel: name.trim() || "Walk-in",
      serviceId: "haircut",
      serviceName,
      price: Math.round(pricePesos * 100),
      slotLabel: "Now",
      payWhere: "shop",
      // Walk-ins are paid at the chair: recorded as paid cash. Change it in View details.
      paid: true,
      payMethod: "cash",
      createdAt: now,
      updatedAt: now,
    });
    if (!chair) {
      setNote("Every chair is taken, or none have been added in Services yet.");
      return;
    }
    router.push("/queue");
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <div className="flex items-center gap-1">
        <PageBack fallback="/queue" />
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Walk-in</h1>
      </div>
      {shops.viewingAll ? (
        <div className="mt-3">
          <p className="text-[15px] font-medium text-ink-2">Open one shop in Settings → Shops before seating a walk-in.</p>
          <Button className="mt-4" href="/settings/shops">Shops</Button>
        </div>
      ) : (
      <>
      <p className="mt-2 pl-11 text-[15px] font-medium text-ink-2">{shops.enabled && shops.branch ? `They sit down now at ${shops.branch.name} and pay at the shop.` : "They sit down now and pay at the shop."}</p>
      {allowance.unlimited ? null : allowance.atLimit ? (
        <div className="mt-4 rounded-card bg-surface px-4 py-3.5 shadow-card">
          <b className="block text-[14px]">That’s 10 walk-ins today</b>
          <p className="mt-1 text-[13px] font-medium text-muted">{allowance.message}</p>
          <Button href="/settings/billing" size="sm" className="mt-2.5">See plans</Button>
        </div>
      ) : (
        <p className="mt-3 pl-11 text-[13px] font-bold">{allowance.label}</p>
      )}
      <div className="mt-5 flex items-center gap-3 rounded-[16px] bg-ink px-3 py-2.5 text-on-ink">
        <BarberIcon name={haircut.icon} size={40} title={haircut.name} />
        <span className="min-w-0 flex-1">
          <b className="block">{haircut.name}</b>
          <small className="text-[12.5px] font-semibold text-on-ink/70">{haircut.price ? `₱${haircut.price}` : ""}</small>
        </span>
      </div>
      {treatments.length ? (
        <>
          <p className="mt-4 text-[13px] font-bold">Other services</p>
          <div className="mt-2 flex flex-col gap-2">
            {treatments.map((t) => {
              const on = picked.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((cur) => on ? cur.filter((id) => id !== t.id) : [...cur, t.id])}
                  className={`flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-left ${on ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200"}`}
                >
                  <BarberIcon name={t.icon} size={40} title={t.name} />
                  <span className="min-w-0 flex-1 font-bold">{t.name}</span>
                  <span className="text-[13px] font-semibold">{t.price ? `₱${t.price}` : ""}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
      <div className="mt-4">
        <Input label="Name" placeholder="Optional" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="mt-3">
        <Input label="Price (₱) · paid cash" inputMode="decimal" placeholder={menuTotal ? String(menuTotal) : "e.g. 150"} value={priceText} onChange={(e) => setPriceText(e.target.value.replace(/[^\d.]/g, ""))} />
      </div>
      {note ? <p className="mt-4 text-[13.5px] font-semibold">{note}</p> : null}
      <Button data-auth="action" className="mt-5" fullWidth onClick={save}>Seat them</Button>
      </>
      )}
    </main>
  );
}

