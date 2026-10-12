"use client";

import { BarberIcon } from "@/components/art";
import { chairBarberName, seatTime, type ShopChair } from "@/lib/shop-chairs";

/** The chair’s own mark. A barber photo never replaces this. */
export function ChairMark({ label, size = 44 }: { label: string; size?: number }) {
  return <BarberIcon name="pole" size={size} title={label} />;
}

/** Portrait of the barber on this seat. Shown online when customers book. */
export function BarberPortrait({ chair, size = 44 }: { chair: ShopChair; size?: number }) {
  const name = chairBarberName(chair);
  if (chair.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={chair.photoUrl}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-grey-100 font-bold text-ink"
      style={{ width: size, height: size, fontSize: Math.max(13, Math.round(size * 0.38)) }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function detail(chair: ShopChair, holder?: string) {
  if (holder || chair.occupiedAt) {
    const since = chair.occupiedAt ? `In use since ${seatTime(chair.occupiedAt)}` : "In use";
    return holder ? `${holder} · ${since}` : since;
  }
  const vacant = chair.vacantAt ? `Vacant since ${seatTime(chair.vacantAt)}` : "Vacant";
  return chair.lastUsedAt ? `${vacant} · Last used ${seatTime(chair.lastUsedAt)}` : vacant;
}

/** One row per created seat: the barber, who is in it, and when it was used or vacant. */
export function SeatList({ chairs, holders }: { chairs: ShopChair[]; holders: Record<string, string> }) {
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {chairs.map((chair) => {
        const holder = holders[chair.label];
        const used = Boolean(holder || chair.occupiedAt);
        return (
          <li key={chair.id} className="flex items-center gap-3 rounded-card bg-surface px-3 py-3 shadow-card">
            <ChairMark label={chair.label} />
            <span className="min-w-0">
              <b className="block text-[15.5px]">{chair.label}</b>
              <small className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
                <BarberPortrait chair={chair} size={18} />
                {chairBarberName(chair)}
              </small>
              <small className="block text-[12.5px] font-semibold text-muted">{detail(chair, holder)}</small>
            </span>
            <span className={`ml-auto flex-none rounded-pill px-3 py-1 text-[12px] font-bold ${used ? "bg-ink text-on-ink" : "bg-grey-100 text-ink"}`}>
              {used ? "In use" : "Vacant"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
