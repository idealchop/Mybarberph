"use client";

import { Button } from "@/components/common/button";
import { cn } from "@river-apps/ui";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { SALES_RANGES, getCustomRange, setCustomRange, type SalesRange } from "@/lib/sales-report";

const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const short = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** Compact date chips. Sales passes the shared day filters; History keeps the default set. */
export function RangeChips({ value, onChange, className, allowCustom = false, ranges = SALES_RANGES }: { value: SalesRange; onChange: (v: SalesRange) => void; className?: string; allowCustom?: boolean; ranges?: { value: SalesRange; label: string }[] }) {
  const [open, setOpen] = useState(false);
  // Start from the active custom range (e.g. a day opened from the profit report), else the last 14 days.
  const [from, setFrom] = useState(() => (value === "custom" && getCustomRange()?.from) || ymd(Date.now() - 13 * 86_400_000));
  const [to, setTo] = useState(() => (value === "custom" && getCustomRange()?.to) || ymd(Date.now()));
  const [today] = useState(() => ymd(Date.now()));
  const apply = (f: string, t: string) => { setCustomRange(f, t); onChange("custom"); };
  return (
    <div className={cn("relative flex flex-wrap gap-1", className)}>
      <div role="radiogroup" aria-label="Date range" className="flex flex-wrap gap-1">
        {ranges.map((r) => (
          <button key={r.value} type="button" role="radio" aria-checked={value === r.value} onClick={() => { setOpen(false); onChange(r.value); }}
            className={cn("h-8 rounded-pill px-3 text-[12.5px] font-bold", value === r.value ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{r.label}</button>
        ))}
        {allowCustom ? (
          <button type="button" aria-pressed={value === "custom"} aria-label="Custom dates" aria-expanded={open} onClick={() => setOpen(!open)}
            className={cn("inline-flex h-8 items-center gap-1 rounded-pill px-2.5 text-[12.5px] font-bold", value === "custom" ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>
            <CalendarDays size={14} strokeWidth={2} />{value === "custom" ? (from === to ? short(from) : `${short(from)}–${short(to)}`) : null}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="absolute right-0 top-10 z-30 w-[260px] rounded-[18px] bg-surface p-3 shadow-card ring-1 ring-line" role="dialog" aria-label="Custom dates">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-bold text-muted">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 w-full rounded-[10px] bg-grey-100 px-2 text-[13px] font-semibold text-ink" /></label>
            <label className="text-[11px] font-bold text-muted">To<input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 w-full rounded-[10px] bg-grey-100 px-2 text-[13px] font-semibold text-ink" /></label>
          </div>
          <Button size="sm" pill fullWidth className="mt-2.5" onClick={() => { apply(from, to); setOpen(false); }}>Apply</Button>
          <p className="mt-1.5 text-center text-[11px] font-semibold text-muted">Up to 62 days</p>
        </div>
      ) : null}
    </div>
  );
}
