"use client";
import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button, HeroBanner } from "@river-apps/ui";
import { BarberChair } from "@/components/art";
import type { IncomingBooking } from "@/data";
import { BookingSheet } from "./BookingSheet";
import { usePartner } from "./PartnerShell";
import { BookingRow, GreetingHeader, ListCard, Section, VisitRow } from "./parts";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function PartnerHome() {
  const { incoming, visits } = usePartner();
  const [open, setOpen] = useState<IncomingBooking | null>(null);
  const today = incoming.filter((b) => b.arrivingAt.startsWith(todayKey()) && b.status !== "declined");
  const coming = today.filter((b) => b.status !== "verified").length;
  const week = visits.filter((v) => v.status !== "no_show");
  return (
    <>
      <GreetingHeader />
      <HeroBanner className="mx-4 mt-2 pb-5 [&>div:first-of-type>div]:w-full" eyebrow="River Mobile" contentWidth="100%"
        title={<span className="block max-w-[190px] text-[22px]">{coming ? `${coming} customer${coming > 1 ? "s" : ""} coming in today` : "All caught up for today"}</span>}
        illustration={<BarberChair size={132} />} illustrationClassName="-right-4 top-2"
        actions={<Button variant="white" size="lg" fullWidth className="mt-0.5 text-[17px]" href="/partner/scan" leadingIcon={<ScanLine size={22} strokeWidth={1.75} />}>Scan to verify</Button>} />
      <Section title="Incoming customers" aside={`${today.length} today`}>
        <ListCard>{today.map((b, i) => <BookingRow key={b.id} b={b} first={i === 0} onClick={() => setOpen(b)} />)}</ListCard>
      </Section>
      <Section title="Verified visits" aside={`${week.length} this week`}>
        <ListCard>{visits.slice(0, 4).map((v, i) => <VisitRow key={v.id} v={v} first={i === 0} />)}</ListCard>
      </Section>
      <BookingSheet booking={open} onClose={() => setOpen(null)} />
    </>
  );
}
