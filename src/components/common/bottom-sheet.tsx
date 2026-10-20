"use client";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";

/**
 * Slide-up sheet (Jimboy, 2026-10-21): dimmed backdrop, rounded top, Back on the left, scrolls inside.
 * Escape and the backdrop close it. Candidate for the River UI kit.
 */
export function BottomSheet({ title, subtitle, onClose, children, footer, tall }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; tall?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[78] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="sheet-fade absolute inset-0 bg-ink/45" onClick={onClose} />
      <div className={`sheet-up relative z-[1] flex w-full max-w-[440px] flex-col rounded-t-[28px] bg-surface shadow-card sm:rounded-[28px] ${tall ? "h-[82dvh]" : "max-h-[90dvh]"}`}>
        <div className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-grey-200" aria-hidden />
        <header className="flex flex-none items-center gap-1 px-3 pb-2 pt-1">
          <button type="button" aria-label="Back" onClick={onClose} className="inline-flex size-11 flex-none items-center justify-center rounded-full"><ChevronLeft size={24} strokeWidth={1.9} /></button>
          <span className="min-w-0">
            <b className="block truncate text-[18px] tracking-[-0.02em]">{title}</b>
            {subtitle ? <small className="block truncate text-[12.5px] font-semibold text-muted">{subtitle}</small> : null}
          </span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">{children}</div>
        {footer ? <div className="flex-none border-t border-line px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">{footer}</div> : <div className="h-[calc(env(safe-area-inset-bottom)+12px)] flex-none" />}
      </div>
    </div>
  );
}
