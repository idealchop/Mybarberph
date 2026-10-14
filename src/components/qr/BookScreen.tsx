"use client";

import { CoinIcon } from "@river-apps/icons";
import { Button, Input } from "@river-apps/ui";
import { Wallet, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BarberIcon } from "@/components/art";
import { Brand } from "@/components/shell/Brand";
import { ACTIVE_BOOKING_KEY, parseContact, type PayWhere } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { RequestStatus } from "./RequestStatus";
import { usePublicShop } from "./usePublicShop";

interface Draft { contact: string; slotLabel: string; serviceIds: string[]; serviceName: string; price: number }

const TIMES = ["11:00 AM", "2:00 PM", "4:00 PM", "7:00 PM"] as const;

function savedBooking(shopId: string): string | null {
  if (typeof window === "undefined" || !shopId) return null;
  const [sid, id] = (sessionStorage.getItem(ACTIVE_BOOKING_KEY) ?? "").split(":");
  return sid === shopId && id ? id : null;
}

/** Public page opened by the shop QR. Contact is an email or a mobile number. */
export function BookScreen() {
  const params = useSearchParams();
  const shopId = params.get("shop")?.trim() ?? "";
  const loc = params.get("loc")?.trim() ?? "";
  const { shop, payOnline } = usePublicShop(shopId);
  const branch = shop?.branches.find((item) => item.id === loc);
  const heading = shop ? (branch ? `${shop.name} · ${branch.name}` : shop.name) : "";
  const haircut = shop?.services.find((s) => s.kind === "haircut");
  const treatments = shop?.services.filter((s) => s.kind === "treatment") ?? [];
  const [contact, setContact] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [day, setDay] = useState<"Today" | "Tomorrow">("Today");
  const [time, setTime] = useState<(typeof TIMES)[number]>("4:00 PM");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(() => savedBooking(shopId));
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<"form" | "pay" | "status">(() => (savedBooking(shopId) ? "status" : "form"));
  const [payWhere, setPayWhere] = useState<PayWhere | null>(null);

  const chosen = treatments.filter((t) => picked.includes(t.id));
  const serviceName = [haircut?.name ?? "Haircut", ...chosen.map((t) => t.name)].join(" · ");
  const total = (haircut?.price ?? 0) + chosen.reduce((sum, t) => sum + t.price, 0);

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
    setError("");
    setPayWhere(payOnline ? null : "shop");
    setDraft({ contact: who, slotLabel: `${day}, ${time}`, serviceIds: [haircut?.id ?? "haircut", ...chosen.map((t) => t.id)], serviceName, price: total });
    setPhase("pay");
  };

  const confirmPay = async () => {
    if (!draft || !payWhere || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shopId, locationId: loc || undefined, contact: draft.contact, customerLabel: draft.contact, slotLabel: draft.slotLabel, serviceIds: draft.serviceIds, payWhere }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn’t send the request.");
      sessionStorage.setItem(ACTIVE_BOOKING_KEY, `${shopId}:${d.booking.id}`);
      setBookingId(d.booking.id);
      setPhase("status");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const bookAnother = () => {
    sessionStorage.removeItem(ACTIVE_BOOKING_KEY);
    setDraft(null);
    setBookingId(null);
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

  if (phase === "status" && bookingId) return <RequestStatus bookingId={bookingId} shopId={shopId} onBookAnother={bookAnother} />;

  if (shop === undefined) {
    return <main className="mx-auto min-h-dvh max-w-[402px] px-6 pt-10"><Brand sub={false} /><p className="mt-6 text-[14px] font-semibold text-muted">Loading the shop…</p></main>;
  }
  if (!shop || !haircut) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col justify-center px-6 py-12">
        <Brand />
        <h1 className="mt-6 text-[28px] font-extrabold tracking-[-0.03em]">{shop ? "Not taking bookings yet" : "Shop not found"}</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">{shop ? "This shop hasn’t added its services yet. Ask at the counter." : "This code doesn’t match a shop on Barbers.ph. Ask the shop for a new QR code."}</p>
      </main>
    );
  }

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
        <p className="mt-2 text-[15px] font-medium text-ink-2">{draft.serviceName}{draft.price ? ` · ${peso(draft.price)}` : ""}. {payOnline ? "Choose online, or pay at the chair." : "Pay at the chair when the cut is done."}</p>
        <div className="mt-5 grid gap-3">
          {payOnline ? <PayChoice selected={payWhere === "online"} onClick={() => setPayWhere("online")} title="Pay online" subtitle="GCash" icon={<Wallet size={28} strokeWidth={1.75} />} /> : (
            <p className="rounded-[18px] bg-grey-100 px-4 py-3 text-[13px] font-semibold text-muted">Online payment isn’t available for this shop yet.</p>
          )}
          <PayChoice selected={payWhere === "shop"} onClick={() => setPayWhere("shop")} title="Pay at the chair" subtitle="Cash when you’re done" icon={<CoinIcon size={36} />} />
        </div>
        {error ? <p className="mt-3 text-[13px] font-semibold">{error}</p> : null}
        <Button className="mt-5" fullWidth disabled={!payWhere || sending} onClick={() => void confirmPay()}>{sending ? "Sending…" : "Send request"}</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <Brand sub={false} />
      <p className="mt-4 text-[13px] font-bold text-muted">{heading}</p>
      <h1 className="mt-1 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Book a haircut</h1>
      <label className="mt-5 block text-[13px] font-bold">Haircut</label>
      <div className="mt-2 flex items-center gap-3 rounded-[16px] bg-ink px-3 py-2.5 text-on-ink">
        <BarberIcon name="clipper" size={40} title={haircut.name} />
        <span className="min-w-0 flex-1 font-bold">{haircut.name}</span>
        <span className="text-[13px] font-semibold">{haircut.durationMins} min{haircut.price ? ` · ${peso(haircut.price)}` : ""}</span>
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
                  <BarberIcon name="towel" size={40} title={t.name} />
                  <span className="min-w-0 flex-1 font-bold">{t.name}</span>
                  <span className="text-[13px] font-semibold">{t.durationMins} min{t.price ? ` · ${peso(t.price)}` : ""}</span>
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
