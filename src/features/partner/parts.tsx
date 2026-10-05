"use client";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Bell } from "lucide-react";
import { CheckIcon } from "@river-apps/icons";
import { Avatar, IconButton, IconTile, Topbar } from "@river-apps/ui";
import { Dialog } from "@/components/common/Dialog";
import type { IncomingBooking, VerifiedVisit } from "@/data";
import { useTier } from "@/lib/tier";
import { shortService } from "@/lib/format";
import { usePartner } from "./PartnerShell";

export function TierPill() {
  const { tier } = useTier();
  return <span className="inline-flex items-center whitespace-nowrap rounded-pill bg-surface px-2.5 py-1 text-[12px] font-bold leading-none ring-1 ring-inset ring-grey-200">{tier === "partner" ? "Free partner" : "Paid"}</span>;
}

export function NotificationsButton() {
  const { notifications, markAllRead } = usePartner();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => n.unread).length;
  return (
    <>
      <IconButton variant="surface" label="Notifications" count={unread || undefined} icon={<Bell size={22} strokeWidth={1.75} />} onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={() => { setOpen(false); markAllRead(); }} title="Notifications" subtitle="Recent activity">
        <ul className="flex flex-col">
          {notifications.map((n) => (
            <li key={n.id} className="flex gap-3 border-t border-line py-3 first:border-t-0">
              <i aria-hidden className={`mt-1.5 block size-2 flex-none rounded-full ${n.unread ? "bg-ink" : "bg-grey-200"}`} />
              <span className="flex min-w-0 flex-1 flex-col leading-[1.3]"><b className="text-[14.5px]">{n.title}</b><span className="text-[13px] font-medium text-muted">{n.body}</span></span>
              <span className="whitespace-nowrap text-[12px] font-semibold text-muted">{n.atLabel}</span>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

/** Greeting header (kit Topbar variant="greeting"). */
export function GreetingHeader() {
  return (
    <Topbar variant="greeting" leading={<Avatar name="Jimboy" preset="sky" size={44} />} eyebrow="Good evening" title="Hi, Jimboy"
      actions={<div className="flex items-center gap-2"><TierPill /><NotificationsButton /></div>} className="[&>div:last-child]:gap-2" />
  );
}

/** Sub-page header with a back button. */
export function PageTitle({ title, subtitle, back = "/partner", action }: { title: string; subtitle?: string; back?: string | null; action?: ReactNode }) {
  return (
    <header className="flex items-center gap-3 px-5 pb-1 pt-2">
      {back ? <a href={back} aria-label="Back" className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-surface shadow-card"><ArrowLeft size={20} strokeWidth={1.75} /></a> : null}
      <div className="flex min-w-0 flex-1 flex-col leading-snug gap-0.5"><h1 className="truncate text-[22px] font-extrabold tracking-[-0.02em]">{title}</h1>{subtitle ? <span className="text-[13px] font-semibold text-muted">{subtitle}</span> : null}</div>
      {action}
    </header>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 px-5 pb-2.5 pt-[18px]"><h2 className="text-[19px] font-extrabold tracking-[-0.02em]">{title}</h2>{aside ? <span className="text-[13.5px] font-semibold text-muted">{aside}</span> : null}</div>
      {children}
    </>
  );
}

export function ListCard({ children }: { children: ReactNode }) {
  return <div className="mx-4 rounded-card bg-surface px-3.5 py-1.5 shadow-card">{children}</div>;
}

export function BookingTrailing({ b }: { b: IncomingBooking }) {
  if (b.status === "here") return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill bg-ink px-2.5 py-1 text-[12px] font-bold leading-none text-on-ink"><i aria-hidden className="block size-[6px] rounded-full bg-on-ink" />Here now</span>;
  if (b.status === "verified") return <span className="text-[12.5px] font-bold">Verified</span>;
  if (b.status === "pending") return <span className="inline-flex items-center whitespace-nowrap rounded-pill bg-surface px-2.5 py-1 text-[12px] font-bold leading-none ring-1 ring-inset ring-ink">New</span>;
  if (b.status === "declined") return <span className="text-[12.5px] font-semibold text-subtle">Declined</span>;
  return <span className="inline-flex items-center whitespace-nowrap rounded-pill bg-grey-100 px-2.5 py-1 text-[12px] font-bold leading-none">{b.arrivingLabel.replace(/^Today, /, "")}</span>;
}

export function BookingRow({ b, first, onClick }: { b: IncomingBooking; first?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 py-2 text-left ${first ? "" : "border-t border-line"}`}>
      <Avatar name={b.customerName} preset={b.avatar} size={40} />
      <div className="flex min-w-0 flex-1 flex-col leading-[1.3]"><b className="truncate text-[14.5px] tracking-[-0.01em]">{b.customerName}</b><span className="truncate text-[12.5px] font-medium text-muted">{shortService(b.serviceLabel)} · <span className="font-mono">{b.referenceId}</span></span></div>
      <BookingTrailing b={b} />
    </button>
  );
}

export function VisitRow({ v, first }: { v: VerifiedVisit; first?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-[7px] ${first ? "" : "border-t border-line"}`}>
      <IconTile size={40} style={{ borderRadius: 12 }} className={v.status === "no_show" ? "opacity-40 grayscale" : ""}><CheckIcon size={26} /></IconTile>
      <div className="flex min-w-0 flex-1 flex-col leading-[1.3]"><b className="truncate text-[14px]">{v.customerName}</b><span className="truncate text-[12.5px] font-medium text-muted">{v.atLabel} · {v.serviceLabel}</span></div>
      <span className={`text-[12.5px] font-bold ${v.status === "no_show" ? "text-subtle" : ""}`}>{v.status === "verified" ? "Verified" : v.status === "completed" ? "Completed" : "No-show"}</span>
    </div>
  );
}
