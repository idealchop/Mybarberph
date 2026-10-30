"use client";
import { Check, ChevronDown, Scissors } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { peso } from "@/lib/format";

export interface ServiceOption { name: string; priceCentavos?: number | null }

/**
 * Shared service picker (v1.0.22): a field that opens a bottom sheet in the location-switch style,
 * listing services with prices, a check on the selected one; tap selects and closes.
 */
export function ServicePicker({ value, options, onChange, className = "", fieldClassName = "" }: {
  value: string; options: ServiceOption[]; onChange: (name: string) => void; className?: string; fieldClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const list = options.some((o) => o.name === value) || !value ? options : [...options, { name: value }];
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={`Service: ${value || "none"}. Change service`} onClick={() => setOpen(true)} className={`flex min-w-0 flex-1 items-center justify-between gap-2 text-left ${className}`}>
        <span className={`min-w-0 flex-1 truncate ${fieldClassName}`}>{value || "Choose service"}</span>
        <ChevronDown size={16} strokeWidth={2.2} aria-hidden className="flex-none text-muted" />
      </button>
      {open ? (
        <BottomSheet title="Choose service" subtitle={`${list.length} service${list.length === 1 ? "" : "s"}`} onClose={() => setOpen(false)} tall={list.length > 6}>
          <ul role="listbox" aria-label="Services" className="flex flex-col">
            {list.map((o) => {
              const on = o.name === value;
              return (
                <li key={o.name} role="option" aria-selected={on}>
                  <button type="button" onClick={() => { onChange(o.name); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-[16px] px-2.5 py-3 text-left ${on ? "bg-grey-100" : "active:bg-grey-50"}`}>
                    <span aria-hidden className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-grey-100"><Scissors size={16} strokeWidth={2.2} /></span>
                    <b className="min-w-0 flex-1 truncate text-[15px]">{o.name}</b>
                    {o.priceCentavos != null ? <span className="flex-none text-[14px] font-bold tabular-nums">{peso(o.priceCentavos)}</span> : null}
                    {on ? <Check size={20} strokeWidth={2.6} className="flex-none" aria-label="Selected" /> : <span className="w-5 flex-none" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </BottomSheet>
      ) : null}
    </>
  );
}
