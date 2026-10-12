"use client";

import { CoinIcon } from "@river-apps/icons";
import { Button, Input } from "@river-apps/ui";
import { Wallet, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BarberIcon } from "@/components/art";
import { Brand } from "@/components/shell/Brand";
import { shop } from "@/data";
import {
  ACTIVE_BOOKING_KEY, SAMPLE_SHOP_ID, parseContact, refCode, writePublicBooking,
  type ChairRequest, type PayWhere,
} from "@/lib/chair-bookings";
import { useShopMenu } from "@/lib/shop-services";
import { chairBarberName, useShopChairs } from "@/lib/shop-chairs";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { BarberPortrait } from "@/features/settings/SeatList";
import { RequestStatus } from "./RequestStatus";

const TIMES = ["11:00 AM", "2:00 PM", "4:00 PM", "7:00 PM"] as const;

/** Public page opened by the shop QR. Contact is an email or a mobile number. */
export function BookScreen() {
  const params = useSearchParams();
  const shopId = params.get("shop")?.trim() ?? "";
  const loc = params.get("loc")?.trim() ?? "";
  const locationId = loc || HOME_LOCATION_ID;
  const known = shopId === SAMPLE_SHOP_ID;
  const shopName = known ? shop.name : shopId;
  const shops = useShopLocations();
  const branch = shops.branches.find((item) => item.id === locationId);
  const heading = branch && (loc || shops.enabled) ? `${shop.name} · ${branch.name}` : shopName;

  const { haircut, treatments } = useShopMenu(locationId);
  const { chairs } = useShopChairs({ locationId });
  const [contact, setContact] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [day, setDay] = useState<"Today" | "Tomorrow">("Today");
  const [time, setTime] = useState<(typeof TIMES)[number]>("4:00 PM");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<ChairRequest | null>(null);
  const [phase, setPhase] = useState<"form" | "pay" | "status">("form");
  const [payWhere, setPayWhere] = useState<PayWhere | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem(ACTIVE_BOOKING_KEY);
    if (!id || !shopId) return;
    const saved = window.localStorage.getItem("barbers.public-bookings");
    if (!saved) return;
    try {
      const rows = JSON.parse(saved) as ChairRequest[];
      const found = rows.find((b) => b.id === id && b.shopId === shopId);
      if (found) {
        setDraft(found);
        setPhase("status");
      }
    } catch {
      /* ignore a bad local copy */
    }
  }, [shopId]);

  const chosen = treatments.filter((t) => picked.includes(t.id));
  const serviceName = [haircut.name, ...chosen.map((t) => t.name)].join(" · ");

  const submit = () => {
    const who = parseContact(contact);
    if (!who) {
      setError("Enter an email or a Philippine mobile number.");
      return;
    }
    if (!shopId) {
      setError("This code is missing the shop.");
      return;
    }
    const now = Date.now();
    const booking: ChairRequest = {
      id: `bk-public-${now}`,
      shopId,
      ref: refCode(),
      channel: "online",
      status: "requested",
      contact: who,
      customerLabel: who,
      serviceId: "haircut",
      serviceName,
      price: 0,
      slotLabel: `${day}, ${time}`,
      payWhere: "shop",
      locationId,
      createdAt: now,
      updatedAt: now,
    };
    setError("");
    setPayWhere(null);
    setDraft(booking);
    setPhase("pay");
  };

  const confirmPay = () => {
    if (!draft || !payWhere) return;
    const booking = { ...draft, payWhere, updatedAt: Date.now() };
    writePublicBooking(booking);
    sessionStorage.setItem(ACTIVE_BOOKING_KEY, booking.id);
    setDraft(booking);
    setPhase("status");
  };

  const bookAnother = () => {
    sessionStorage.removeItem(ACTIVE_BOOKING_KEY);
    setDraft(null);
    setPayWhere(null);
    setPhase("form");
  };

  if (!shopId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col justify-center px-6 py-12">
        <Brand />
        <h1 className="mt-6 text-[28px] font-extrabold tracking-[-0.03em]">Booking</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">This code is missing the shop. Ask the shop for a new QR code.</p>
      </main>
    );
  }

  if (phase === "status" && draft) return <RequestStatus bookingId={draft.id} onBookAnother={bookAnother} />;

  if (phase === "pay" && draft) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
        <Brand sub={false} />
        <div className="mt-4 flex items-center gap-1">
          <button type="button" aria-label="Back" onClick={() => setPhase("form")} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink">
            <ChevronLeft size={26} strokeWidth={1.75} />
          </button>
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">How will you pay?</h1>
        </div>
        <p className="mt-2 text-[15px] font-medium text-ink-2">{draft.ref} · {draft.serviceName}. Choose online, or pay at the chair.</p>
        <div className="mt-5 grid gap-3">
          <PayChoice selected={payWhere === "online"} onClick={() => setPayWhere("online")} title="Pay online" subtitle="GCash" icon={<Wallet size={28} strokeWidth={1.75} />} />
          <PayChoice selected={payWhere === "shop"} onClick={() => setPayWhere("shop")} title="Pay at the chair" subtitle="Cash when you’re done" icon={<CoinIcon size={36} />} />
        </div>
        <Button className="mt-5" fullWidth disabled={!payWhere} onClick={confirmPay}>Send request</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <Brand sub={false} />
      <p className="mt-4 text-[13px] font-bold text-muted">{heading}</p>
      <h1 className="mt-1 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Book a haircut</h1>
      {chairs.length ? (
        <>
          <p className="mt-5 text-[13px] font-bold">Barbers</p>
          <ul className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {chairs.map((chair) => (
              <li key={chair.id} className="flex w-16 flex-none flex-col items-center gap-1.5">
                <BarberPortrait chair={chair} size={56} />
                <span className="w-full truncate text-center text-[12px] font-bold">{chairBarberName(chair)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <label className="mt-5 block text-[13px] font-bold">Haircut</label>
      <div className="mt-2 flex items-center gap-3 rounded-[16px] bg-ink px-3 py-2.5 text-on-ink">
        <BarberIcon name={haircut.icon} size={40} title={haircut.name} />
        <span className="min-w-0 flex-1 font-bold">{haircut.name}</span>
        <span className="text-[13px] font-semibold">{haircut.durationMins} min</span>
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
                  <span className="text-[13px] font-semibold">{t.durationMins} min</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
      <p className="mt-4 text-[13px] font-bold">When</p>
      <div className="mt-2 flex gap-2">
        {(["Today", "Tomorrow"] as const).map((d) => (
          <button key={d} type="button" onClick={() => setDay(d)} className={`h-10 flex-1 rounded-[12px] text-[14px] font-bold ${day === d ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200"}`}>{d}</button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {TIMES.map((t) => (
          <button key={t} type="button" onClick={() => setTime(t)} className={`h-10 rounded-[12px] text-[14px] font-bold ${time === t ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200"}`}>{t}</button>
        ))}
      </div>
      <div className="mt-4">
        <Input label="Email or mobile" placeholder="you@email.com or 09…" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      {error ? <p className="mt-2 text-[13px] font-semibold">{error}</p> : null}
      <Button className="mt-5" fullWidth onClick={submit}>Continue</Button>
    </main>
  );
}

function PayChoice({ selected, onClick, title, subtitle, icon }: { selected: boolean; onClick: () => void; title: string; subtitle: string; icon: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-[18px] px-4 py-3 text-left ${selected ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200"}`}>
      <span className="flex size-12 items-center justify-center">{icon}</span>
      <span>
        <b className="block text-[16px]">{title}</b>
        <small className={`text-[12.5px] font-semibold ${selected ? "text-on-ink/70" : "text-muted"}`}>{subtitle}</small>
      </span>
    </button>
  );
}
