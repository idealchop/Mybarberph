"use client";
import { Button } from "@/components/common/button";
import { QrCode as QrIcon } from "lucide-react";

/** Calm empty state for bookings / queue lists: River 3D icon on a soft backdrop, one line, one quiet action. */
export function EmptyBookings({ title = "No bookings yet", subtitle = "Share your shop QR so customers can book", locationId, icon = "calendar", className = "" }: { title?: string; subtitle?: string; locationId?: string; icon?: "calendar" | "ticket"; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-card bg-gradient-to-b from-grey-50 to-surface px-5 py-6 text-center ring-1 ring-line ${className}`}>
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-2 size-36 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(10,10,10,0.06),transparent)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/icons3d/${icon}.png`} alt="" width={72} height={72} className="relative mx-auto size-[72px] object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.12)]" />
      <b className="relative mt-3 block text-[16px] tracking-[-0.01em]">{title}</b>
      <p className="relative mt-1 text-[13px] font-medium text-muted">{subtitle}</p>
      <Button href={`/qr${locationId ? `?loc=${encodeURIComponent(locationId)}` : ""}`} size="sm" variant="secondary" className="relative mt-4" leadingIcon={<QrIcon size={15} strokeWidth={2} />}>Show QR</Button>
    </div>
  );
}
