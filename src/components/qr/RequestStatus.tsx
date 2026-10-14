"use client";

import { CheckIcon, CoinIcon } from "@river-apps/icons";
import { Card, HeroBanner, MonoText } from "@river-apps/ui";
import { Wallet } from "lucide-react";
import { BarberChair } from "@/components/art";
import { Brand } from "@/components/shell/Brand";
import { statusLabel, usePublicBooking, type ChairRequest } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";

const STEPS = ["Sent", "In chair", "Done"] as const;

function stepIndex(booking: ChairRequest) {
  if (booking.status === "done") return 2;
  if (booking.status === "in_chair") return 1;
  return 0;
}

/** Customer page after a QR booking. Accepting at the shop puts them straight in a chair. */
export function RequestStatus({ bookingId, shopId, onBookAnother }: { bookingId: string; shopId: string; onBookAnother: () => void }) {
  const booking = usePublicBooking(bookingId, shopId);

  if (booking === undefined) {
    return <main className="mx-auto min-h-dvh max-w-[440px] px-5 pt-8"><p className="text-[14px] font-semibold text-muted">Loading…</p></main>;
  }
  if (!booking) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-canvas px-5 pb-10">
        <div className="flex h-14 items-center"><Brand sub={false} /></div>
        <h1 className="mt-4 text-[28px] font-extrabold tracking-[-0.03em]">Request not found</h1>
        <button type="button" onClick={onBookAnother} className="mt-4 text-left text-[15px] font-bold underline">Book a haircut</button>
      </main>
    );
  }

  const closed = booking.status === "declined";
  const online = booking.payWhere === "online";
  const current = stepIndex(booking);
  const sitting = booking.status === "in_chair" && booking.chairLabel ? booking.chairLabel : "";
  const title = closed
    ? "The shop can’t take this"
    : booking.status === "done"
      ? "You’re done"
      : sitting
        ? `You’re in ${sitting}`
        : "Request sent";
  const canPay = online && !booking.paid && !closed && (booking.status === "in_chair" || booking.status === "done");
  const amount = booking.price ? peso(booking.price) : "";
  const payLine = booking.paid
    ? (amount ? `Paid ${amount} with GCash.` : "Paid with GCash.")
    : online
      ? (canPay ? (amount ? `${amount} with GCash.` : "Pay with GCash.") : "You’ll pay online.")
      : (amount ? `Cash ${amount} when the cut is done.` : "Pay at the chair when the cut is done.");

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas pb-10">
      <div className="flex h-14 items-center justify-between px-5 pt-1">
        <Brand sub={false} size={30} />
        <MonoText className="text-[13px]">{booking.ref}</MonoText>
      </div>
      <HeroBanner
        className="mx-4 mt-1"
        size="sm"
        eyebrow={`${booking.serviceName} · ${booking.slotLabel}`}
        title={title}
        description={payLine}
        contentWidth={200}
        illustration={booking.status === "done" ? <CheckIcon size={96} /> : <BarberChair size={120} />}
        illustrationClassName="right-3 bottom-3"
      />
      <Card className="mx-4 mt-3 px-4 py-4">
        <b className="block text-[16px]">Visit status</b>
        {closed ? (
          <p className="mt-2 text-[14px] font-semibold text-ink-2">Contact the shop if you still need a haircut.</p>
        ) : (
          <ol className="mt-3 flex justify-between gap-2" aria-label="Visit status">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
                <span className={`flex size-7 items-center justify-center rounded-full text-[12px] font-bold ${i <= current ? "bg-ink text-on-ink" : "bg-grey-100 text-muted"}`}>{i + 1}</span>
                <span className={`text-[11.5px] font-bold ${i <= current ? "text-ink" : "text-muted"}`}>{label}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 border-t border-dashed border-[#E8E8EC] pt-2.5 text-[12.5px] font-semibold text-muted">
          {booking.serviceName} · {statusLabel(booking.status)}
        </p>
      </Card>
      <Card className="mx-4 mt-2.5 flex items-center gap-3 px-4 py-3.5">
        {online ? <Wallet size={28} strokeWidth={1.75} /> : <CoinIcon size={40} />}
        <span>
          <b className="block text-[16px]">{booking.paid ? "Paid" : online ? "Pay online" : "Pay at the chair"}</b>
          <small className="text-[12.5px] font-semibold text-muted">{payLine}</small>
        </span>
      </Card>
      {canPay ? (
        <p className="mx-4 mt-3 rounded-card bg-grey-100 px-4 py-3 text-[13px] font-semibold text-muted">Online payment isn’t connected yet. Please pay at the shop.</p>
      ) : null}
      <p className="mx-4 mt-4 px-1">
        <button type="button" onClick={onBookAnother} className="text-[13.5px] font-bold text-muted underline">Book another haircut</button>
      </p>
    </main>
  );
}
