"use client";
import { cn } from "@river-apps/ui";
import { useState } from "react";
import { DAYS, DAY_LABEL, PRESETS, TIME_STEPS, formatHours, timeLabel, week, type Day, type WeekHours } from "@/lib/shop-hours";

function TimeSelect({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[12px] font-bold text-muted">{label}</span>
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-[12px] bg-grey-100 px-2.5 text-[14.5px] font-semibold">
        {TIME_STEPS.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
      </select>
    </label>
  );
}

/** Rows show two chips fully and a faded third peeking, so it reads as "swipe for more". */
const PEEK = "-mx-1 flex snap-x gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const FADE = { maskImage: "linear-gradient(to right, #000 78%, transparent)", WebkitMaskImage: "linear-gradient(to right, #000 78%, transparent)" } as const;

/** Opening hours by tapping: presets, day chips, and 30-minute open/close pickers (same for every day, or per day). */
export function HoursPicker({ value, onChange, disabled }: { value: WeekHours | null; onChange: (w: WeekHours) => void; disabled?: boolean }) {
  const w = value ?? week(["mon", "tue", "wed", "thu", "fri", "sat"]);
  const openDays = DAYS.filter((d) => w[d].open);
  const first = w[openDays[0] ?? "mon"];
  const uniform = openDays.every((d) => w[d].from === first.from && w[d].to === first.to);
  const [perDay, setPerDay] = useState(!uniform);
  const setDay = (d: Day, patch: Partial<WeekHours[Day]>) => onChange({ ...w, [d]: { ...w[d], ...patch } });
  const setAll = (patch: { from?: string; to?: string }) => onChange(Object.fromEntries(DAYS.map((d) => [d, { ...w[d], ...patch }])) as WeekHours);
  return (
    <fieldset className="grid gap-3 rounded-card bg-surface p-3.5 ring-1 ring-line" disabled={disabled}>
      <legend className="mb-2 px-1 text-[14px] font-bold">Opening hours</legend>
      <div className={PEEK} aria-label="Presets" role="group" style={FADE}>
        {PRESETS.map((p) => {
          const on = formatHours(p.hours) === formatHours(w);
          return (
            <button key={p.id} type="button" aria-pressed={on} onClick={() => { onChange(p.hours); setPerDay(false); }}
              className={cn("h-9 w-[42%] flex-none snap-start truncate rounded-pill px-3 text-[13px] font-bold", on ? "bg-ink text-on-ink" : "bg-grey-100 text-ink")}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div className={PEEK} role="group" aria-label="Open days" style={FADE}>
        {DAYS.map((d) => (
          <button key={d} type="button" aria-pressed={w[d].open} onClick={() => setDay(d, { open: !w[d].open })}
            className={cn("h-10 w-[42%] flex-none snap-start rounded-[12px] px-2 text-[13px] font-bold", w[d].open ? "bg-ink text-on-ink" : "bg-grey-100 text-muted line-through")}>
            {DAY_LABEL[d]}
          </button>
        ))}
      </div>
      {!perDay ? (
        <div className="flex gap-2">
          <TimeSelect label="Opens" value={first.from} onChange={(v) => setAll({ from: v })} />
          <TimeSelect label="Closes" value={first.to} onChange={(v) => setAll({ to: v })} />
        </div>
      ) : (
        <ul className="grid gap-2">
          {openDays.map((d) => (
            <li key={d} className="flex items-end gap-2">
              <b className="w-10 pb-3 text-[13px]">{DAY_LABEL[d]}</b>
              <TimeSelect label={`${DAY_LABEL[d]} opens`} value={w[d].from} onChange={(v) => setDay(d, { from: v })} />
              <TimeSelect label={`${DAY_LABEL[d]} closes`} value={w[d].to} onChange={(v) => setDay(d, { to: v })} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[12.5px] font-semibold text-muted" aria-live="polite">{formatHours(w)}</p>
        <button type="button" onClick={() => { if (perDay) setAll({ from: first.from, to: first.to }); setPerDay(!perDay); }} className="flex-none text-[12.5px] font-bold underline decoration-grey-300 underline-offset-[3px]">
          {perDay ? "Same hours every day" : "Different hours per day"}
        </button>
      </div>
    </fieldset>
  );
}
