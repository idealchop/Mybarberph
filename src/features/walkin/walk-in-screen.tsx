"use client";
import { clientId } from "@/lib/offline-queue";

import { Input } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BarberIcon } from "@/components/art";
import { PageBack } from "@/components/shell/page-back";
import { queueLocation, refCode, seatOwnerWalkIn, seatWalkInOnChair, useChairRequests } from "@/lib/chair-bookings";
import { useShopChairs } from "@/lib/shop-chairs";
import { activeBarbersAt, NO_BARBER_MESSAGE, ownerBarberChoice, resolveOwnerBarber } from "@/lib/owner-barber-pick";
import { cloudSnapshot } from "@/lib/cloud";
import { useShopLocations } from "@/lib/shop-locations";
import { useShopMenu } from "@/lib/shop-services";
import { useWalkInAllowance } from "@/lib/walkin-limit";
import { HOME_LOCATION_ID } from "@/lib/shop-locations";
import { walkInLocation } from "@/lib/walkin-location";

const ME = "__me";

/** Walk-in counter: they sit down immediately. Partner: 10 a day per shop; Pro and Lifetime: unlimited. */
export function WalkInScreen() {
  const shops = useShopLocations();
  // v1.0.28: saved under the active location; on "All locations" the owner picks one first.
  const [pickedLoc, setPickedLoc] = useState("");
  const where = walkInLocation(shops, pickedLoc);
  const allowance = useWalkInAllowance(where.locationId ?? queueLocation(shops));
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const loc = where.locationId ?? queueLocation(shops);
  // This location's prices (not the default, and not whichever location the owner happens to be viewing).
  const { haircut, treatments } = useShopMenu(loc);
  const { chairs } = useShopChairs({ locationId: loc });
  const { rows } = useChairRequests();
  const busyLabels = new Set(rows.filter((r) => r.status === "in_chair" && r.chairLabel && (r.locationId || HOME_LOCATION_ID) === loc).map((r) => r.chairLabel!));
  // From the Home hero (?me=1) the owner takes the customer himself; with no barbers that's the only choice.
  const fromHome = useSearchParams().get("me") === "1";
  // v1.0.35: the walk-in goes to a barber at this location: one active barber = assigned automatically; several = the
  // owner picks (required); none = a clear message. "Me" only when the owner started it from Home to cut himself.
  const [barberPick, setBarberPick] = useState(fromHome ? ME : "");
  const choice = ownerBarberChoice(activeBarbersAt(chairs, loc));
  const me = barberPick === ME;

  const chosen = treatments.filter((t) => picked.includes(t.id));
  const menuTotal = (haircut.price ?? 0) + chosen.reduce((sum, t) => sum + (t.price ?? 0), 0);
  const serviceName = [haircut.name, ...chosen.map((t) => t.name)].join(" · ");

  const newRow = (now: number) => ({
    id: clientId("wk-", now),
    shopId: cloudSnapshot().shopId ?? "",
    ref: refCode(),
    channel: "walk-in" as const,
    locationId: loc,
    status: "accepted" as const,
    contact: "",
    customerLabel: name.trim() || "Walk-in",
    serviceId: "haircut",
    serviceName,
    price: Math.round(menuTotal * 100),
    slotLabel: "Now",
    payWhere: "shop" as const,
    paid: false,
    createdAt: now,
    updatedAt: now,
  });

  const save = () => {
    if (where.needsPick) { setNote("Pick a location first."); return; }
    if (allowance.atLimit) { setNote(allowance.message); return; }
    // eslint-disable-next-line react-hooks/purity -- runs in the Save click handler, not during render
    const now = Date.now();
    if (me) {
      seatOwnerWalkIn({ ...newRow(now) }, "Owner");
      router.push(fromHome ? "/" : "/queue");
      return;
    }
    if (choice.kind === "none") { setNote(NO_BARBER_MESSAGE); return; }
    const pick = resolveOwnerBarber(choice, barberPick);
    if (!pick) { setNote("Pick the barber for this walk-in."); return; }
    if (busyLabels.has(pick.label)) { setNote(`${pick.name} is busy with a customer.${choice.kind === "pick" ? " Pick another barber." : ""}`); return; }
    if (!seatWalkInOnChair({ ...newRow(now) }, pick.label, loc)) { setNote(`${pick.name} is busy with a customer.`); return; }
    router.push("/queue");
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <div className="flex items-center gap-1">
        <PageBack fallback="/queue" />
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Walk-in</h1>
      </div>
      <>
      <p className="mt-2 pl-11 text-[15px] font-medium text-ink-2">{where.needsPick ? "Pick the location they’re at, then seat them." : shops.enabled ? `They sit down now at ${shops.branches.find((b) => b.id === loc)?.name ?? "the main shop"} and pay at the shop.` : "They sit down now and pay at the shop."}</p>
      {allowance.unlimited ? null : allowance.atLimit ? (
        <div className="mt-4 rounded-card bg-surface px-4 py-3.5 shadow-card">
          <b className="block text-[14px]">That’s 10 walk-ins today</b>
          <p className="mt-1 text-[13px] font-medium text-muted">{allowance.message}</p>
          <Button href="/settings/billing" size="sm" className="mt-2.5">See plans</Button>
        </div>
      ) : (
        <p className="mt-3 pl-11 text-[13px] font-bold">{allowance.label}</p>
      )}
      {where.needsPick || pickedLoc ? (
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">Location</span>
          <select aria-label="Location" value={pickedLoc} onChange={(e) => { setPickedLoc(e.target.value); setBarberPick(fromHome ? ME : ""); setNote(""); }} className="h-12 rounded-[14px] bg-grey-100 px-3 text-[15px] font-semibold">
            <option value="" disabled>Pick a location</option>
            {shops.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      ) : null}
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
      {choice.kind === "none" && !me ? (
        <p role="note" className="mt-3 rounded-card bg-surface px-4 py-3.5 text-[13.5px] font-semibold shadow-card">{NO_BARBER_MESSAGE}</p>
      ) : choice.kind === "auto" && !fromHome ? (
        <p className="mt-3 text-[13.5px] font-semibold"><span className="text-muted">Barber: </span>{choice.barber.name}{busyLabels.has(choice.barber.label) ? " (busy)" : ""}</p>
      ) : choice.kind !== "none" || fromHome ? (
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">Barber</span>
          <select aria-label="Barber" value={barberPick} onChange={(e) => { setBarberPick(e.target.value); setNote(""); }} className="h-12 rounded-[14px] bg-grey-100 px-3 text-[15px] font-semibold">
            <option value="" disabled>Pick a barber</option>
            {fromHome ? <option value={ME}>Me, I’ll cut</option> : null}
            {(choice.kind === "pick" ? choice.barbers : choice.kind === "auto" ? [choice.barber] : []).map((b) => <option key={b.barberId} value={b.barberId} disabled={busyLabels.has(b.label)}>{b.name}{busyLabels.has(b.label) ? " (busy)" : ""}</option>)}
          </select>
        </label>
      ) : null}
      {note ? <p className="mt-4 text-[13.5px] font-semibold">{note}</p> : null}
      <Button data-auth="action" className="mt-5" fullWidth onClick={save} disabled={where.needsPick || (!me && choice.kind === "none")}>{me ? "Start the haircut" : "Seat them"}</Button>
      </>
    </main>
  );
}

