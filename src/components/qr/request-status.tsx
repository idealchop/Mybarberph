"use client";

import { AppLoader } from "@/components/common/app-loader";
import { CheckIcon } from "@river-apps/icons";
import { Card, MonoText } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { Star } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { BarberChair } from "@/components/art";
import { usePublicBooking, type ChairRequest } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { PoweredBy, ShopHeader } from "./shop-brand";
import { QrCode } from "@/components/common/qr-code";
import type { PublicShop } from "./use-public-shop";

const STEPS = ["Sent", "In chair", "Done"] as const;
const stepIndex = (b: ChairRequest) => (b.status === "done" ? 2 : b.status === "in_chair" ? 1 : 0);

/** Customer ticket after a QR booking. Updates live (every 3s) as the shop or the barber moves it along. */
export function RequestStatus({ bookingId, shopId, shop, branchName, onBookAnother }: { bookingId: string; shopId: string; shop: PublicShop | null; branchName?: string; onBookAnother: () => void }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const live = usePublicBooking(bookingId, shopId);
  const [rated, setRated] = useState<ChairRequest | null>(null);
  const booking = rated ?? live;

  if (booking === undefined) return <AppLoader />;
  if (!booking) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-canvas">
        {shop ? <ShopHeader shop={shop} branchName={branchName} compact /> : null}
        <div className="px-5">
          <h1 className="mt-6 text-[26px] font-extrabold tracking-[-0.03em]">Ticket not found</h1>
          <Button className="mt-5" fullWidth onClick={onBookAnother}>Book a haircut</Button>
        </div>
        <PoweredBy />
      </main>
    );
  }

  const done = booking.status === "done";
  const closed = booking.status === "declined";
  const current = stepIndex(booking);
  const sitting = booking.status === "in_chair" ? booking.chairLabel || "the chair" : "";
  const method = (() => { const m = booking.paid ? booking.payMethod : booking.payPref; return booking.paid ? (m === "gcash" ? "GCash" : m === "online" ? "online" : "cash") : (m === "online" || m === "gcash" || m === "maya" ? "online" : "cash"); })();
  const amount = booking.price ? peso(booking.price) : "";
  const payLine = booking.paid ? `Paid ${amount} · ${method === "cash" ? "Cash" : "GCash"}` : `Pay ${amount} by ${method} at the shop`;

  if (done && !booking.rating) return <Feedback booking={booking} shop={shop} branchName={branchName} shopId={shopId} onSaved={setRated} />;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas">
      {shop ? <ShopHeader shop={shop} branchName={branchName} compact /> : null}
      <div className="px-4">
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-muted">Your ticket</span>
          <MonoText className="text-[13px]">{booking.ref}</MonoText>
        </div>
        {!done && !closed && !sitting && origin ? (
          <Card className="mt-2 flex items-center gap-3 px-4 py-3">
            <span className="flex-none rounded-[12px] bg-white p-1 ring-1 ring-line"><QrCode value={`${origin}/scan?code=${encodeURIComponent(booking.ref)}`} size={104} label={`Ticket QR ${booking.ref}`} /></span>
            <span className="min-w-0 text-[13px] font-semibold text-muted">Show this at the shop. Your barber scans it to call you in.</span>
          </Card>
        ) : null}
        <Card className="mt-2 overflow-hidden px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.03em]" aria-live="polite">
                {closed ? "The shop can’t take this" : done ? "Thank you!" : sitting ? `You’re in ${sitting}` : "Request sent"}
              </h1>
              <p className="mt-1 text-[13.5px] font-semibold text-muted">{booking.serviceName} · {booking.slotLabel}</p>
            </div>
            {done ? <CheckIcon size={64} /> : <BarberChair size={84} />}
          </div>
          {closed ? <p className="mt-3 text-[14px] font-semibold text-ink-2">Contact the shop if you still need a haircut.</p> : (
            <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Visit status">
              {STEPS.map((label, i) => (
                <li key={label} className="flex flex-col items-center gap-1.5 text-center">
                  <span className={`h-1.5 w-full rounded-full ${i <= current ? "bg-ink" : "bg-grey-200"}`} />
                  <span className={`text-[12px] font-bold ${i <= current ? "text-ink" : "text-muted"}`}>{label}</span>
                </li>
              ))}
            </ol>
          )}
          {done && booking.rating ? <p className="mt-3 text-[13.5px] font-semibold text-ink-2">You rated this visit {booking.rating} ★. See you next time!</p> : null}
        </Card>
        <Card className="mt-2.5 px-4 py-3.5">
          <b className="block text-[15px]">{booking.paid ? "Paid" : "Payment"}</b>
          <small className="text-[13px] font-semibold text-muted">{payLine}</small>
        </Card>
        {!done && !closed ? <p className="mt-3 px-1 text-[12px] font-semibold text-muted">This page updates by itself. Keep it open, or come back with “Back to my ticket”.</p> : null}
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={onBookAnother}>Book another haircut</Button>
        </div>
      </div>
      <PoweredBy />
    </main>
  );
}

/** After the cut: stars + optional comment, saved on the visit (the owner sees it in order details). */
function Feedback({ booking, shop, branchName, shopId, onSaved }: { booking: ChairRequest; shop: PublicShop | null; branchName?: string; shopId: string; onSaved: (b: ChairRequest) => void }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    if (!stars || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/public/bookings/${encodeURIComponent(booking.id)}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shop: shopId, rating: stars, comment }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn’t send. Try again.");
      onSaved(d.booking);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas">
      {shop ? <ShopHeader shop={shop} branchName={branchName} compact /> : null}
      <div className="px-4">
        <Card className="mt-5 px-4 py-5 text-center">
          <CheckIcon size={56} className="mx-auto" />
          <h1 className="mt-2 text-[24px] font-extrabold tracking-[-0.03em]">You’re all done!</h1>
          <p className="mt-1 text-[13.5px] font-semibold text-muted">How was your {booking.serviceName.toLowerCase()}{booking.barberName ? ` with ${booking.barberName}` : ""}?</p>
          <div className="mt-4 flex justify-center gap-1.5" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setStars(n)} className="p-1">
                <Star size={34} strokeWidth={1.6} className={n <= stars ? "fill-[#F5B301] text-[#F5B301]" : "text-grey-300"} />
              </button>
            ))}
          </div>
          <textarea value={comment} maxLength={500} rows={3} onChange={(e) => setComment(e.target.value)} placeholder="Anything to tell the shop? (optional)" aria-label="Comment"
            className="mt-4 w-full rounded-[14px] bg-grey-100 px-3 py-2.5 text-left text-[14.5px] font-medium outline-none" />
          {err ? <p className="mt-2 text-[13px] font-semibold">{err}</p> : null}
          <Button className="mt-4" fullWidth disabled={!stars || busy} onClick={() => void send()}>{busy ? "Sending…" : "Send feedback"}</Button>
        </Card>
      </div>
      <PoweredBy />
    </main>
  );
}
function noop() { return () => undefined; }
