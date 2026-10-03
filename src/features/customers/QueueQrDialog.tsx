"use client";
import { useState } from "react";
import { Check, MessageSquare, Printer } from "lucide-react";
import { Button } from "@river-apps/ui";
import { Dialog } from "@/components/common/Dialog";
import { QrCode } from "@/components/common/QrCode";
import type { Customer } from "@/data";

/** "Generate queue QR": a link that drops the customer straight into the shop queue from their phone. */
export function QueueQrDialog({ open, onClose, customer, shopSlug = "kanto-kings-marikina" }: { open: boolean; onClose: () => void; customer?: Customer; shopSlug?: string }) {
  const [sent, setSent] = useState(false);
  const url = `https://barbers.ph/q/${shopSlug}${customer ? `?c=${customer.id}` : ""}`;
  const canText = !!customer?.phone && customer.consent.sms;
  return (
    <Dialog open={open} onClose={() => { setSent(false); onClose(); }} title="Queue QR"
      subtitle={customer ? `For ${customer.name}. Scanning it joins the queue with their details filled in.` : "For the counter or door. Anyone can scan it to join the queue."}>
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-card bg-surface p-3 shadow-card"><QrCode value={url} size={208} label={`Queue QR for ${customer?.name ?? "Kanto Kings"}`} /></div>
        <span className="max-w-full truncate rounded-sm bg-grey-100 px-2.5 py-1 font-mono text-[12px] font-semibold">{url.replace("https://", "")}</span>
        <p className="text-center text-[12.5px] font-medium text-muted">They choose a barber and haircut on their phone and get the same “On queue” text as kiosk walk-ins.</p>
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="flex-1" leadingIcon={<Printer size={17} strokeWidth={1.75} />} onClick={() => window.print()}>Print</Button>
        {customer ? (
          <Button className="flex-1" disabled={!canText || sent} leadingIcon={sent ? <Check size={17} strokeWidth={2} /> : <MessageSquare size={17} strokeWidth={1.75} />} onClick={() => setSent(true)}>
            {sent ? "Link texted (demo)" : canText ? "Text the link" : "No SMS consent"}
          </Button>
        ) : <Button className="flex-1" onClick={onClose}>Done</Button>}
      </div>
    </Dialog>
  );
}
