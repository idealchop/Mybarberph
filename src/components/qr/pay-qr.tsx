"use client";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

export type Wallet = "gcash" | "maya";
export const WALLET_LABEL: Record<Wallet, string> = { gcash: "GCash", maya: "Maya" };

/** The shop's GCash / Maya QR on the booking page. Tap to enlarge; the large view links to the image to save it. */
export function PayQr({ wallet, url, shopName }: { wallet: Wallet; url: string; shopName?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const label = WALLET_LABEL[wallet];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Enlarge the ${label} QR`}
        className="mt-3 flex w-full items-center gap-3 rounded-card bg-surface p-3 text-left shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${label} QR code${shopName ? ` for ${shopName}` : ""}`} className="size-24 flex-none rounded-[12px] bg-white object-contain ring-1 ring-grey-200" />
        <span className="min-w-0 flex-1">
          <b className="block text-[14.5px]">Scan to pay with {label}</b>
          <small className="mt-0.5 block text-[12.5px] font-semibold text-muted">Tap to enlarge or save. Show the receipt at the shop.</small>
        </span>
      </button>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label={`${label} QR`} className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-ink/80 px-6" onClick={() => setOpen(false)}>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink"><X size={20} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${label} QR code`} onClick={(e) => e.stopPropagation()} className="w-full max-w-[340px] rounded-[20px] bg-white object-contain p-3" />
          <a href={url} target="_blank" rel="noreferrer" download onClick={(e) => e.stopPropagation()}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-pill bg-surface px-5 text-[14px] font-bold text-ink">
            <Download size={18} aria-hidden /> Save image
          </a>
          <p className="mt-2 text-center text-[12px] font-semibold text-on-ink/80">On iPhone, press and hold the QR, then tap Save to Photos.</p>
        </div>
      ) : null}
    </>
  );
}
