"use client";

import { ChevronRight, MapPin, Plus, X } from "lucide-react";
import { Avatar } from "@river-apps/ui";
import { useState, type ReactNode } from "react";
import { peso } from "@/lib/format";
import { addableServices } from "@/lib/addable-services";

type Svc = { id: string; name: string; price: number };

/**
 * The black "Book a haircut" hero card holding the selected service(s) and + Add more.
 * Add more lists only the services that aren't picked yet. Used by Walk-in and Schedule.
 */
export function ServiceHero({ label, top, actions, selected, menu, locked = [], onAdd, onRemove, art }: {
  /** Accessible name of the card. */
  label: string;
  /** Shop profile block (avatar, greeting, name, reviews) shown on black. */
  top: ReactNode;
  /** Extra icon buttons next to + Add more (e.g. Schedule). */
  actions?: ReactNode;
  selected: Svc[]; menu: Svc[]; locked?: string[];
  onAdd: (id: string) => void; onRemove: (id: string) => void; art?: boolean;
}) {
  const [more, setMore] = useState(false);
  const others = addableServices(menu, selected.map((s) => s.id));
  return (
    <>
      <section aria-label={label} className="relative isolate mt-4 overflow-hidden rounded-banner bg-ink p-5 text-on-ink">
        <div className="flex items-start gap-3">
          <div className="relative z-10 min-w-0 flex-1 [&_.text-muted]:text-on-ink-muted [&_.text-subtle]:text-on-ink-muted">{top}</div>
          {art ? (
            <div aria-hidden className="pointer-events-none relative z-0 -mr-1 -mt-1 w-[88px] flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element -- same 3D pole + scissors art as the barber view */}
              <img src="/barber-hero.webp" alt="" width={88} height={84} className="h-auto w-[88px]" />
            </div>
          ) : null}
        </div>
        <div className="relative z-10 mt-6 flex items-end gap-3">
          <ul className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label="Selected services">
            {selected.length ? selected.map((s) => (
              <li key={s.id} className="flex min-h-7 min-w-0 items-center gap-2 text-[15.5px]">
                <b className="min-w-0 truncate">{s.name}</b>
                <span className="flex-none font-bold tabular-nums text-on-ink-muted">{s.price ? peso(s.price) : ""}</span>
                {locked.includes(s.id) ? null : (
                  <button type="button" onClick={() => onRemove(s.id)} aria-label={`Remove ${s.name}`} className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-white/15"><X size={13} strokeWidth={2.6} /></button>
                )}
              </li>
            )) : <li className="text-[13.5px] font-semibold text-on-ink-muted">Pick a service</li>}
          </ul>
          <div className="flex flex-none items-center gap-2">
            {others.length ? (
              <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-white px-4 text-[13.5px] font-bold text-ink">
                <Plus size={14} strokeWidth={2.4} /> Add more
              </button>
            ) : null}
            {actions}
          </div>
        </div>
      </section>
      {more && others.length ? (
        <ul className="mt-3 flex flex-col gap-2" aria-label="More services">
          {others.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => { onAdd(t.id); if (others.length === 1) setMore(false); }}
                className="flex w-full items-center gap-3 rounded-[16px] bg-surface px-3 py-2.5 text-left ring-1 ring-grey-200">
                <span className="min-w-0 flex-1 text-[14px] font-bold">{t.name}</span>
                <span className="text-[13px] font-semibold tabular-nums">{t.price ? `+${peso(t.price)}` : ""}</span>
                <span className="flex size-6 flex-none items-center justify-center rounded-full bg-grey-100"><Plus size={14} strokeWidth={2.6} /></span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** Shop profile for the hero card: avatar, small line, shop name with chevron, rating, location on its own line. */
export function HeroProfile({ name, logoUrl, line, meta, location, onClick, ariaLabel, lead }: {
  name: string; logoUrl?: string | null; line: string; meta: ReactNode; location?: string; onClick?: () => void; ariaLabel?: string; lead?: ReactNode;
}) {
  const body = (
    <>
      <Avatar name={name} src={logoUrl || undefined} preset="sky" size={48} decorative={false} className="mt-0.5 flex-none ring-1 ring-white/20" />
      <span className="min-w-0 leading-tight">
        <span className="block text-[12.5px] font-medium text-on-ink-muted">{line}</span>
        <span className="mt-0.5 flex items-center gap-1"><b className="truncate text-[20px] font-extrabold tracking-[-0.02em] text-on-ink">{name}</b>{onClick ? <ChevronRight size={17} className="flex-none text-on-ink-muted" aria-hidden /> : null}</span>
        <span className="mt-1.5 flex flex-col gap-1 text-on-ink">
          <span className="flex items-center">{meta}</span>
          {location ? <span className="flex items-center gap-1 text-[12.5px] font-semibold text-on-ink-muted"><MapPin size={13} strokeWidth={2.2} aria-hidden className="flex-none" />{location}</span> : null}
        </span>
      </span>
    </>
  );
  return (
    <div className="flex min-w-0 items-start gap-1">
      {lead}
      {onClick ? <button type="button" onClick={onClick} aria-label={ariaLabel} className="flex min-w-0 items-start gap-3 text-left">{body}</button> : <div className="flex min-w-0 items-start gap-3">{body}</div>}
    </div>
  );
}

/** Round icon button for the hero's bottom row (dark-on-white like + Add more). */
export function HeroIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-white text-ink">{children}</button>;
}
