"use client";

import { Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { peso } from "@/lib/format";
import { addableServices } from "@/lib/addable-services";

type Svc = { id: string; name: string; price: number };

/**
 * The black "Book a haircut" hero card holding the selected service(s) and + Add more.
 * Add more lists only the services that aren't picked yet. Used by Walk-in and Schedule.
 */
export function ServiceHero({ kicker, title = "Book a haircut", selected, menu, locked = [], onAdd, onRemove, art, children }: {
  kicker: string; title?: string; selected: Svc[]; menu: Svc[]; locked?: string[];
  onAdd: (id: string) => void; onRemove: (id: string) => void; art?: boolean; children?: ReactNode;
}) {
  const [more, setMore] = useState(false);
  const others = addableServices(menu, selected.map((s) => s.id));
  return (
    <>
      <section aria-label={title} className="relative isolate mt-4 overflow-hidden rounded-banner bg-ink px-4 py-4 text-on-ink">
        <div className="flex min-h-[96px] items-center">
          <div className="relative z-10 min-w-0 flex-1">
            <p className="text-[12px] font-medium text-on-ink-muted">{kicker}</p>
            <h2 className="mt-1 text-[24px] font-extrabold leading-[1.1] tracking-[-0.03em]">{title}</h2>
            {children}
          </div>
          {art ? (
            <div aria-hidden className="pointer-events-none relative z-0 -mr-2 w-[116px] flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element -- same 3D pole + scissors art as the barber view */}
              <img src="/barber-hero.webp" alt="" width={116} height={111} className="h-auto w-[116px]" />
            </div>
          ) : null}
        </div>
        <div className="relative z-10 mt-3 flex items-center gap-3">
          <ul className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label="Selected services">
            {selected.length ? selected.map((s) => (
              <li key={s.id} className="flex min-w-0 items-center gap-2 text-[15px]">
                <b className="min-w-0 truncate">{s.name}</b>
                <span className="flex-none font-bold tabular-nums text-on-ink-muted">{s.price ? peso(s.price) : ""}</span>
                {locked.includes(s.id) ? null : (
                  <button type="button" onClick={() => onRemove(s.id)} aria-label={`Remove ${s.name}`} className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-white/15"><X size={13} strokeWidth={2.6} /></button>
                )}
              </li>
            )) : <li className="text-[13.5px] font-semibold text-on-ink-muted">Pick a service</li>}
          </ul>
          {others.length ? (
            <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="inline-flex h-9 flex-none items-center gap-1 rounded-pill bg-white px-3.5 text-[13px] font-bold text-ink">
              <Plus size={14} strokeWidth={2.4} /> Add more
            </button>
          ) : null}
        </div>
      </section>
      {more && others.length ? (
        <ul className="mt-2 flex flex-col gap-2" aria-label="More services">
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
