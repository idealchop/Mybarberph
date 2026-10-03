"use client";
import { Check, ScanLine, X } from "lucide-react";
import { Avatar, Button } from "@river-apps/ui";
import { Dialog } from "@/components/common/Dialog";
import { CodeChip } from "@/components/common/ui";
import { getRepository, type IncomingBooking } from "@/data";
import { peso } from "@/lib/format";
import { usePartner } from "./PartnerShell";

/** Booking details with the Partner API actions (accept / decline / scan to verify). */
export function BookingSheet({ booking, onClose }: { booking: IncomingBooking | null; onClose: () => void }) {
  const { barbers, setBookingStatus } = usePartner();
  if (!booking) return null;
  const b = booking;
  const barber = barbers.find((x) => x.id === b.barberId);
  const act = (status: IncomingBooking["status"]) => {
    setBookingStatus(b.id, status);
    void (status === "accepted" ? getRepository().acceptBooking(b.id) : getRepository().declineBooking(b.id)).catch(() => undefined);
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title={b.customerName} subtitle={`River Mobile · received ${b.receivedAgo.toLowerCase()}`}>
      <div className="flex items-center gap-3">
        <Avatar name={b.customerName} preset={b.avatar} size={52} />
        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]"><b className="text-[16px]">{b.serviceLabel}</b><span className="text-[13px] font-medium text-muted">{peso(b.price)} · pay at the shop</span></span>
        <CodeChip>{b.referenceId}</CodeChip>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-0.5 rounded-[18px] bg-grey-100 p-3"><small className="text-[12px] font-semibold text-muted">Arriving</small><b className="text-[14.5px]">{b.arrivingLabel}</b></div>
        <div className="flex flex-col gap-0.5 rounded-[18px] bg-grey-100 p-3"><small className="text-[12px] font-semibold text-muted">Barber</small><b className="text-[14.5px]">{barber?.nickname ?? "Any barber"}</b></div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {b.status === "pending" ? (
          <>
            <Button fullWidth leadingIcon={<Check size={18} strokeWidth={1.75} />} onClick={() => act("accepted")}>Accept booking</Button>
            <Button fullWidth variant="ghost" leadingIcon={<X size={18} strokeWidth={1.75} />} onClick={() => act("declined")}>Decline</Button>
          </>
        ) : b.status === "here" || b.status === "accepted" ? (
          <>
            <Button fullWidth href="/partner/scan" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>{b.status === "here" ? "Scan to verify" : "Scan when they arrive"}</Button>
            <Button fullWidth variant="ghost" leadingIcon={<X size={18} strokeWidth={1.75} />} onClick={() => act("declined")}>Mark as no-show</Button>
          </>
        ) : (
          <p className="rounded-tile bg-grey-100 px-3 py-2.5 text-center text-[13.5px] font-semibold">{b.status === "verified" ? "Visit verified. River Mobile has been told." : "Declined. The customer was notified."}</p>
        )}
      </div>
    </Dialog>
  );
}
