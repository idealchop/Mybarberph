"use client";
import { Input } from "@river-apps/ui";

/** Optional tip: a small "+ Add tip" text link that reveals one ₱ input (whole pesos). */
export function TipField({ open, onOpen, value, onChange, className = "mt-3" }: { open: boolean; onOpen: () => void; value: string; onChange: (v: string) => void; className?: string }) {
  if (!open) return <button type="button" onClick={onOpen} className={`${className} text-[13px] font-bold text-ink-2 underline decoration-grey-300 underline-offset-[3px]`}>+ Add tip</button>;
  return (
    <div className={className}>
      <Input label="Tip (₱)" inputMode="numeric" value={value} placeholder="e.g. 50" autoFocus={!value} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 6))} />
    </div>
  );
}
