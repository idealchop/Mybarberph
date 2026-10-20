"use client";
import { Check, ChevronDown, Loader2, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/common/bottom-sheet";

export interface SwitcherOption { id: string; name: string; sub?: string }

/** Pure filter for the location sheet (name or area, any case). */
export function filterLocations<T extends SwitcherOption>(list: T[], q: string): T[] {
  const n = q.trim().toLowerCase();
  return n ? list.filter((o) => o.name.toLowerCase().includes(n) || (o.sub ?? "").toLowerCase().includes(n)) : list;
}

/**
 * Header location picker (Jimboy, 2026-10-21): a small label + chevron that opens a bottom sheet with
 * search, a scrolling list and a check on the selected one. Made for 10+ locations.
 */
export function LocationSwitcher({ value, options, allId, onChange, label, loading, className = "" }: {
  value: string; options: SwitcherOption[]; allId?: string; onChange: (id: string) => void; label: string; loading?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = filterLocations(options, q);
  const pick = (id: string) => { onChange(id); setOpen(false); setQ(""); };
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={`Location: ${label}. Change location`} onClick={() => setOpen(true)}
        className={`relative inline-flex min-w-0 items-center gap-0.5 after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] ${className}`}>
        <span className="truncate">{label}</span>
        {loading ? <Loader2 size={12} strokeWidth={2.4} className="flex-none animate-spin" aria-label="Loading" /> : <ChevronDown size={13} strokeWidth={2.2} className="flex-none" aria-hidden />}
      </button>
      {open ? (
        <BottomSheet title="Choose location" subtitle={`${options.length} location${options.length === 1 ? "" : "s"}`} onClose={() => { setOpen(false); setQ(""); }} tall={options.length > 6}>
          {options.length > 5 ? (
            <label className="sticky top-0 z-[1] flex h-11 items-center gap-2 rounded-pill bg-grey-100 px-3.5">
              <Search size={16} className="flex-none text-muted" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search locations" aria-label="Search locations" className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-muted" />
            </label>
          ) : null}
          <ul role="listbox" aria-label="Locations" className="mt-2 flex flex-col">
            {allId && !q.trim() ? <Row id={allId} name="All locations" sub="Every shop together" on={value === allId} onPick={pick} all /> : null}
            {list.map((o) => <Row key={o.id} id={o.id} name={o.name} sub={o.sub} on={value === o.id} onPick={pick} />)}
            {list.length === 0 ? <li className="px-2 py-6 text-center text-[13.5px] font-semibold text-muted">No location matches “{q.trim()}”.</li> : null}
          </ul>
        </BottomSheet>
      ) : null}
    </>
  );
}

function Row({ id, name, sub, on, onPick, all }: { id: string; name: string; sub?: string; on: boolean; onPick: (id: string) => void; all?: boolean }) {
  return (
    <li role="option" aria-selected={on}>
      <button type="button" onClick={() => onPick(id)} className={`flex w-full items-center gap-3 rounded-[16px] px-2.5 py-3 text-left ${on ? "bg-grey-100" : "active:bg-grey-50"}`}>
        <span aria-hidden className={`inline-flex size-9 flex-none items-center justify-center rounded-full ${all ? "bg-ink text-on-ink" : "bg-grey-100"}`}><MapPin size={16} strokeWidth={2.2} /></span>
        <span className="min-w-0 flex-1"><b className="block truncate text-[15px]">{name}</b>{sub ? <small className="block truncate text-[12.5px] font-semibold text-muted">{sub}</small> : null}</span>
        {on ? <Check size={20} strokeWidth={2.6} className="flex-none" aria-label="Selected" /> : null}
      </button>
    </li>
  );
}
