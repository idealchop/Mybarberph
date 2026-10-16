"use client";

import { CoinIcon } from "@river-apps/icons";
import { Input } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { CalendarDays, Check, ChevronRight, Plus, Wallet, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BarberIcon, type BarberIconName } from "@/components/art";
import { Sk } from "@/components/common/Skeleton";
import { Brand } from "@/components/shell/Brand";
import { ACTIVE_BOOKING_KEY, parseContact } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { ScheduleScreen, type ScheduleRequest } from "./ScheduleScreen";
import { RequestStatus } from "./RequestStatus";
import { PoweredBy, ShopHeader } from "./ShopBrand";
import { usePublicShop } from "./usePublicShop";

const ICONS: BarberIconName[] = ["scissors", "clipper", "pole", "razor", "towel", "ticket", "gift", "qr"];
const icon = (v?: string | null, fallback: BarberIconName = "scissors") => (ICONS.includes(v as BarberIconName) ? (v as BarberIconName) : fallback);

/** The customer's current ticket at this shop, kept on the phone so they can always get back to it. */
const ticketKey = (shopId: string) => `${ACTIVE_BOOKING_KEY}:${shopId}`;
function savedTicket(shopId: string): string | null {
  if (typeof window === "undefined" || !shopId) return null;
  return localStorage.getItem(ticketKey(shopId));
}

/** Public page opened by a shop's QR (bound to one location). Contact is an email or a mobile number. */
export function BookScreen() {
  const params = useSearchParams();
  const shopId = params.get("shop")?.trim() ?? "";
  const loc = params.get("loc")?.trim() ?? "";
  const { shop } = usePublicShop(shopId);
  const branch = shop?.branches.find((item) => item.id === loc);
  const menu = (branch && shop?.servicesByLocation?.[branch.id]) || shop?.services || [];
  const haircut = menu.find((s) => s.kind === "haircut");
  const extras = menu.filter((s) => s.kind === "treatment");
  const [contact, setContact] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [sched, setSched] = useState<ScheduleRequest | null>(null);
  const [pay, setPay] = useState<"cash" | "gcash">("cash");
  const [error, setError] = useState("");
  const [ask, setAsk] = useState(false);
  const [sending, setSending] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [view, setView] = useState<"form" | "ticket" | "schedule">("form");
  useEffect(() => {
    const t = savedTicket(shopId);
    if (!t) return;
    const timer = window.setTimeout(() => { setTicket(t); setView("ticket"); }, 0);
    return () => window.clearTimeout(timer);
  }, [shopId]);

  const chosen = extras.filter((t) => picked.includes(t.id));
  const total = (haircut?.price ?? 0) + chosen.reduce((sum, t) => sum + t.price, 0);

  const send = async (raw: string) => {
    const who = raw.trim() ? parseContact(raw) : "";
    if (raw.trim() && !who) { setError("Enter an email or a Philippine mobile number, or skip."); return; }
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shopId, locationId: loc || undefined, contact: who || undefined, customerLabel: who || undefined, ...(sched
          ? { scheduledAt: sched.scheduledAt, barberId: sched.barberId, serviceIds: sched.serviceIds, payPref: sched.pay }
          : { slotLabel: "Now", serviceIds: [haircut?.id ?? "haircut", ...chosen.map((t) => t.id)], payPref: pay }), payWhere: "shop" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn’t send the request.");
      localStorage.setItem(ticketKey(shopId), d.booking.id);
      setAsk(false);
      setSched(null);
      setTicket(d.booking.id);
      setView("ticket");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
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
  const sheet = ask ? (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="contact-title">
      <button type="button" aria-label="Dismiss" className="absolute inset-0 bg-ink/45" onClick={() => { if (!sending) setAsk(false); }} />
      <div className="relative w-full max-w-[440px] rounded-t-[28px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 sm:rounded-[28px]">
        <button type="button" aria-label="Close" onClick={() => { if (!sending) setAsk(false); }} className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-grey-100"><X size={16} /></button>
        <h2 id="contact-title" className="pr-10 text-[20px] font-extrabold tracking-[-0.02em]">Stay updated?</h2>
        <p className="mt-1 text-[13.5px] font-medium text-muted">Add your email or mobile so the shop can update you about your visit and follow up. Optional.</p>
        <div className="mt-4"><Input label="Email or mobile (optional)" placeholder="you@email.com or 09…" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
        {error ? <p className="mt-2 text-[13px] font-semibold">{error}</p> : null}
        <Button className="mt-4" fullWidth disabled={sending} loading={sending} onClick={() => void send(contact)}>{sending ? "Sending…" : contact.trim() ? "Send request" : "Send without contact"}</Button>
        <button type="button" disabled={sending} onClick={() => void send("")} className="mt-2 w-full py-2 text-[13.5px] font-bold text-muted">Skip</button>
      </div>
    </div>
  ) : null;

  if (view === "schedule" && shop) {
    return (
      <>
        <ScheduleScreen shop={shop} locationId={loc} sending={sending} error={ask ? "" : error}
          onBack={() => { setSched(null); setView("form"); }}
          onSend={(r) => { setError(""); setSched(r); setAsk(true); }} />
        {sheet}
      </>
    );
  }
  if (view === "ticket" && ticket) return <RequestStatus bookingId={ticket} shopId={shopId} shop={shop ?? null} branchName={branch?.name} onBookAnother={() => setView("form")} />;
  if (shop === undefined) return (
    <main role="status" aria-label="Loading the shop" className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3"><Sk className="size-12 rounded-full" /><span className="flex-1 space-y-1.5"><Sk className="h-4 w-32" /><Sk className="h-3 w-20" /></span><Sk className="h-10 w-28 rounded-pill" /></div>
      <div className="space-y-3 px-4 pt-5"><Sk className="h-7 w-48" /><Sk className="h-16 w-full rounded-[16px]" /><Sk className="h-12 w-full rounded-[14px]" /><Sk className="h-24 w-full rounded-card" /><Sk className="h-12 w-full rounded-pill" /></div>
    </main>
  );
  if (!shop || !haircut) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col justify-center px-6 py-12">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">{shop ? "Not taking bookings yet" : "Shop not found"}</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">{shop ? "This shop hasn’t added its services yet. Ask at the counter." : "This code doesn’t match a shop on Barbers.ph. Ask the shop for a new QR code."}</p>
        <PoweredBy />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas pb-6">
      <ShopHeader shop={shop} branchName={branch?.name} trailing={
        <button type="button" onClick={() => { setError(""); setView("schedule"); }} className="inline-flex h-10 flex-none items-center gap-1.5 rounded-pill bg-grey-100 px-3.5 text-[13.5px] font-bold text-ink">
          <CalendarDays size={17} strokeWidth={2.1} aria-hidden /> Schedule
        </button>
      } />
      <div className="px-4">
        {ticket ? (
          <button type="button" onClick={() => setView("ticket")} className="mt-4 flex w-full items-center justify-between rounded-card bg-ink px-4 py-3 text-left text-on-ink">
            <span><b className="block text-[14.5px]">Back to my ticket</b><small className="text-[12px] font-semibold text-on-ink/70">See your place in the queue</small></span>
            <ChevronRight size={20} />
          </button>
        ) : null}
        <h2 className="mt-5 text-[24px] font-extrabold leading-[1.15] tracking-[-0.03em]">Book a haircut</h2>

        <p className="mt-4 text-[13px] font-bold">Service</p>
        <div className="mt-2 flex items-center gap-3 rounded-[16px] bg-ink px-3 py-2.5 text-on-ink">
          <BarberIcon name={icon(haircut.icon, "clipper")} size={40} title={haircut.name} />
          <span className="min-w-0 flex-1">
            <b className="block truncate">{haircut.name}</b>
            <small className="text-[12.5px] font-semibold text-on-ink/70">{haircut.price ? peso(haircut.price) : ""}</small>
          </span>
          {extras.length ? (
            <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="inline-flex h-8 flex-none items-center gap-1 rounded-pill bg-white px-3 text-[12.5px] font-bold text-ink">
              <Plus size={14} strokeWidth={2.4} /> Add more
            </button>
          ) : null}
        </div>
        {more || chosen.length ? (
          <ul className="mt-2 flex flex-col gap-2" aria-label="More services">
            {(more ? extras : chosen).map((t) => {
              const on = picked.includes(t.id);
              return (
                <li key={t.id}>
                  <button type="button" aria-pressed={on} onClick={() => setPicked((cur) => (on ? cur.filter((id) => id !== t.id) : [...cur, t.id]))}
                    className={`flex w-full items-center gap-3 rounded-[16px] px-3 py-2 text-left ${on ? "bg-surface ring-2 ring-ink" : "bg-surface ring-1 ring-grey-200"}`}>
                    <BarberIcon name={icon(t.icon)} size={36} title={t.name} />
                    <span className="min-w-0 flex-1 text-[14px] font-bold">{t.name}</span>
                    <span className="text-[13px] font-semibold">{t.price ? `+${peso(t.price)}` : ""}</span>
                    <span className={`flex size-6 flex-none items-center justify-center rounded-full ${on ? "bg-ink text-on-ink" : "bg-grey-100"}`}>{on ? <Check size={14} strokeWidth={3} /> : null}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <p className="mt-5 text-[13px] font-bold">How will you pay?</p>
        <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="How will you pay">
          {([["cash", "Cash", <CoinIcon key="c" size={28} />], ["gcash", "GCash", <Wallet key="g" size={24} strokeWidth={1.75} />]] as const).map(([v, label, ic]) => (
            <button key={v} type="button" role="radio" aria-checked={pay === v} onClick={() => setPay(v)}
              className={`flex h-12 items-center justify-center gap-2 rounded-[14px] text-[14.5px] font-bold ${pay === v ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200"}`}>
              {ic} {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 px-1 text-[12px] font-semibold text-muted">You pay at the shop when the cut is done.</p>

        <div className="mt-5 rounded-card bg-surface px-4 py-3 shadow-card" aria-live="polite">
          <div className="flex justify-between text-[13.5px] font-semibold"><span>{haircut.name}</span><span className="tabular-nums">{peso(haircut.price ?? 0)}</span></div>
          {chosen.map((t) => <div key={t.id} className="mt-1 flex justify-between text-[13.5px] font-semibold"><span>{t.name}</span><span className="tabular-nums">{peso(t.price)}</span></div>)}
          <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-line pt-2">
            <b className="text-[15px]">Total</b>
            <b data-testid="book-total" className="text-[22px] font-extrabold tracking-[-0.03em] tabular-nums">{peso(total)}</b>
          </div>
        </div>
        {error && !ask ? <p className="mt-2 text-[13px] font-semibold">{error}</p> : null}
        <Button className="mt-4" fullWidth disabled={sending} onClick={() => { setError(""); setSched(null); setAsk(true); }}>Send request · {peso(total)}</Button>
      </div>
      <PoweredBy />
      {sheet}
    </main>
  );
}
