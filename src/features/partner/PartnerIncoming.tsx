"use client";
import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button, EmptyState, SegmentedControl } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";
import type { IncomingBooking } from "@/data";
import { BookingSheet } from "./BookingSheet";
import { usePartner } from "./PartnerShell";
import { BookingRow, ListCard, PageTitle, Section } from "./parts";

export function PartnerIncoming() {
  const { incoming } = usePartner();
  const [tab, setTab] = useState<"today" | "upcoming">("today");
  const [open, setOpen] = useState<IncomingBooking | null>(null);
  const today = incoming.filter((b) => b.arrivingAt.startsWith("2026-10-04"));
  const upcoming = incoming.filter((b) => !b.arrivingAt.startsWith("2026-10-04"));
  const list = tab === "today" ? today : upcoming;
  const here = list.filter((b) => b.status === "here");
  const rest = list.filter((b) => b.status !== "here");
  return (
    <>
      <PageTitle title="Incoming customers" subtitle="River Mobile bookings and queue tickets" back={null}
        action={<Button size="sm" href="/partner/scan" leadingIcon={<ScanLine size={16} strokeWidth={1.75} />}>Scan</Button>} />
      <div className="px-4 pt-3">
        <SegmentedControl label="When" value={tab} onChange={setTab} className="w-full [&>button]:flex-1"
          options={[{ value: "today", label: `Today ${today.length}` }, { value: "upcoming", label: `Upcoming ${upcoming.length}` }]} />
      </div>
      {here.length ? <Section title="At the shop now"><ListCard>{here.map((b, i) => <BookingRow key={b.id} b={b} first={i === 0} onClick={() => setOpen(b)} />)}</ListCard></Section> : null}
      {rest.length ? (
        <Section title={tab === "today" ? "Later today" : "Tomorrow and after"} aside={`${rest.length}`}>
          <ListCard>{rest.map((b, i) => <BookingRow key={b.id} b={b} first={i === 0} onClick={() => setOpen(b)} />)}</ListCard>
        </Section>
      ) : null}
      {!list.length ? <EmptyState className="mt-10 px-6" illustration={<BarberIcon name="ticket" size={72} />} title="No bookings yet" description="New River Mobile bookings land here and on your notifications." /> : null}
      <p className="px-6 pt-4 text-center text-[12.5px] font-medium text-muted">Tap a customer to accept, decline or verify.</p>
      <BookingSheet booking={open} onClose={() => setOpen(null)} />
    </>
  );
}
