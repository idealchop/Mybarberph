"use client";

import { useWalkInAllowance } from "@/lib/walkin-limit";
import { Avatar, Button, Input } from "@river-apps/ui";
import { ChevronLeft, History, Plus, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import { BarberChair, BarberIcon } from "@/components/art";
import { startBarberCloud, useCloud } from "@/lib/cloud";
import {
  acceptOnChair, completionLabel, elapsedLabel, markDone, refCode, requestLocation, seatWalkInOnChair, statusLabel, useChairRequests,
  type ChairRequest,
} from "@/lib/chair-bookings";
import { chairBarberName, chairLinkExpired, linkExpiryLabel, useShopChairs } from "@/lib/shop-chairs";
import { HOME_LOCATION_ID } from "@/lib/shop-locations";
import { useGreeting, useShopProfile } from "@/lib/shop-profile";
import { useShopMenu, type ShopHaircut, type ShopTreatment } from "@/lib/shop-services";

const PILL = "relative h-8 gap-1 rounded-pill px-3 text-[13px] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']";

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Online booking is one haircut plus any treatments. Older cut names show as that haircut. */
function visitOffer(row: ChairRequest, haircut: ShopHaircut, treatments: ShopTreatment[]) {
  const chunks = row.serviceName.split("·").map((part) => part.trim()).filter(Boolean);
  const extras = treatments.filter((treatment) => chunks.some((part) => part.toLowerCase() === treatment.name.toLowerCase()));
  return {
    label: extras.length ? `${haircut.name} · ${extras.map((treatment) => treatment.name).join(" · ")}` : haircut.name,
    extras,
  };
}

function OfferIcons({ haircut, extras, onDark }: { haircut: ShopHaircut; extras: ShopTreatment[]; onDark?: boolean }) {
  return (
    <span className="flex shrink-0 items-center">
      <BarberIcon name={haircut.icon} size={44} title={haircut.name} />
      {extras.map((treatment) => (
        <span key={treatment.id} className={onDark ? "-ml-2 rounded-full bg-ink" : "-ml-2 rounded-full bg-surface"}>
          <BarberIcon name={treatment.icon} size={32} title={treatment.name} />
        </span>
      ))}
    </span>
  );
}

function WaitingCard({
  row, busy, haircut, treatments, onAccept,
}: {
  row: ChairRequest;
  busy: boolean;
  haircut: ShopHaircut;
  treatments: ShopTreatment[];
  onAccept: () => void;
}) {
  const offer = visitOffer(row, haircut, treatments);
  return (
    <li className="rounded-card bg-surface px-3 py-3 shadow-card">
      <div className="flex items-center gap-3">
        <OfferIcons haircut={haircut} extras={offer.extras} />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[16px]">{row.customerLabel || row.contact || "Customer"}</b>
          <p className="mt-0.5 truncate text-[13px] font-medium text-muted">{offer.label} · {row.slotLabel}</p>
          <p className="mt-0.5 text-[12.5px] font-semibold text-muted">{row.ref}</p>
        </div>
      </div>
      <Button className="mt-3" size="sm" fullWidth disabled={busy} onClick={onAccept}>Accept</Button>
    </li>
  );
}

function ActiveCard({
  row, now, haircut, treatments, onWalkIn, onScan,
}: {
  row?: ChairRequest;
  now: number;
  haircut: ShopHaircut;
  treatments: ShopTreatment[];
  onWalkIn: () => void;
  onScan: () => void;
}) {
  const offer = row ? visitOffer(row, haircut, treatments) : null;
  const elapsed = row?.startedAt ? elapsedLabel(row.startedAt, now) : "";
  const who = row ? (row.customerLabel || row.contact || "Customer") : "No one seated";
  return (
    <section className="relative isolate mt-5 flex min-h-[150px] items-center overflow-hidden rounded-banner bg-ink px-4 py-4 text-on-ink" aria-label="In the chair">
      <div className="relative z-10 min-w-0 flex-1">
        <p className="truncate text-[12px] leading-4 font-medium text-on-ink-muted">{who}</p>
        <h2 className="mt-1 text-[22px] font-extrabold leading-none tabular-nums tracking-[-0.03em]">{row ? elapsed : "Open"}</h2>
        <p className="mt-0.5 truncate text-[12.5px] font-medium text-on-ink-muted">{row && offer ? `${offer.label} · ${row.ref}` : "Walk-in, or an online ticket"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {row ? <Button variant="white" size="sm" className={PILL} onClick={() => markDone(row.id)}>Complete</Button> : (
            <>
              <Button
                variant="white"
                size="sm"
                className={PILL}
                aria-label="Walk-in"
                leadingIcon={<Plus size={14} strokeWidth={2} />}
                onClick={onWalkIn}
              >
                Walk-in
              </Button>
              <Button
                variant="ghost-inverse"
                size="sm"
                className={PILL}
                aria-label="Scan QR"
                leadingIcon={<ScanLine size={14} strokeWidth={1.9} />}
                onClick={onScan}
              >
                Scan QR
              </Button>
            </>
          )}
        </div>
      </div>
      <div aria-hidden className="relative z-0 w-[88px] flex-none"><BarberChair size={88} /></div>
    </section>
  );
}

/** The page a barber opens from the link. No account. */
export function BarberLinkScreen({ token }: { token: string }) {
  useEffect(() => { startBarberCloud(token); }, [token]);
  const cloud = useCloud();
  const { profile } = useShopProfile();
  const greeting = useGreeting();
  const { chairs, ready: chairsReady } = useShopChairs({ all: true });
  const { rows, ready } = useChairRequests();
  const chairPreview = chairs.find((item) => item.linkToken === token);
  const { haircut, treatments } = useShopMenu(chairPreview?.locationId || HOME_LOCATION_ID);
  const now = useNow();
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [history, setHistory] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const chair = chairPreview;
  const allowance = useWalkInAllowance(chair?.locationId || HOME_LOCATION_ID);

  if (cloud.ready && cloud.error && !cloud.shopId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col bg-canvas px-5 pt-16">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">This link is not active</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">Ask the shop to send a new chair link. Each link expires after one month.</p>
      </main>
    );
  }
  if (!chairsReady || !ready || !cloud.ready) {
    return <main className="mx-auto min-h-dvh max-w-[402px] bg-canvas px-4 pt-8"><p className="text-[14px] font-semibold text-muted">Loading…</p></main>;
  }
  if (!chair || chairLinkExpired(chair)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col bg-canvas px-5 pt-16">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">{chair ? "This link expired" : "This link is not active"}</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">
          {chair
            ? `It stopped on ${linkExpiryLabel(chair.linkExpiresAt!)}. Chair links expire each month. Ask the shop to send a new one.`
            : "Ask the shop to send a new chair link. Each link expires after one month."}
        </p>
      </main>
    );
  }

  const placeId = chair.locationId || HOME_LOCATION_ID;
  const here = (row: ChairRequest) => requestLocation(row) === placeId;
  const mine = (row: ChairRequest) => here(row) && (row.seatLabel === chair.label || row.chairLabel === chair.label);
  const current = rows.find((row) => row.status === "in_chair" && row.chairLabel === chair.label && here(row));
  const waiting = rows
    .filter((row) => here(row) && (row.status === "requested" || row.status === "accepted") && !row.chairLabel)
    .sort((a, b) => a.createdAt - b.createdAt);
  const done = rows
    .filter((row) => row.status === "done" && mine(row) && row.completedAt)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  if (history) {
    return (
      <ChairHistory
        rows={done}
        now={now}
        who={chairBarberName(chair)}
        chairLabel={chair.label}
        haircut={haircut}
        treatments={treatments}
        onBack={() => setHistory(false)}
      />
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <header className="flex min-w-0 items-center gap-2.5">
        <Avatar name={profile.name} src={profile.logoUrl || undefined} preset="sky" size={44} />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-muted">{greeting}, {chairBarberName(chair)}</p>
          <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-[-0.02em]">{profile.name}</h1>
          <p className="truncate text-[13px] font-semibold text-muted">{chairBarberName(chair)} · {chair.label}</p>
        </div>
      </header>

      {note ? <p className="mt-4 text-[13.5px] font-semibold">{note}</p> : null}

      {adding ? (
        <section className="mt-5">
          <h2 className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">Walk-in</h2>
          <div className="mt-2 flex items-center gap-3 rounded-[16px] bg-ink px-3 py-2.5 text-on-ink">
            <BarberIcon name={haircut.icon} size={40} title={haircut.name} />
            <span className="min-w-0 flex-1">
              <b className="block">{haircut.name}</b>
              <small className="text-[12.5px] font-semibold text-on-ink/70">{haircut.price ? `₱${haircut.price}` : ""}</small>
            </span>
          </div>
          {treatments.length ? (
            <>
              <p className="mt-4 px-1 text-[13px] font-bold">Other services</p>
              <div className="mt-2 flex flex-col gap-2">
                {treatments.map((service) => {
                  const on = picked.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked((cur) => on ? cur.filter((id) => id !== service.id) : [...cur, service.id])}
                      className={`flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-left ${on ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200"}`}
                    >
                      <BarberIcon name={service.icon} size={40} title={service.name} />
                      <span className="min-w-0 flex-1 font-bold">{service.name}</span>
                      <span className="text-[13px] font-semibold">{service.price ? `₱${service.price}` : ""}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
          <div className="mt-4">
            <Input label="Name" placeholder="Optional" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button className="mt-4" fullWidth onClick={() => {
            if (current) {
              setNote("Finish the cut in your chair first.");
              return;
            }
            if (allowance.atLimit) { setNote(allowance.message); return; }
            const nowAt = Date.now();
            const chosen = treatments.filter((service) => picked.includes(service.id));
            const sat = seatWalkInOnChair({
              id: `wk-${nowAt}`,
              shopId: cloud.shopId ?? "",
              ref: refCode(),
              channel: "walk-in",
              status: "accepted",
              contact: "",
              customerLabel: name.trim() || "Walk-in",
              serviceId: "haircut",
              serviceName: [haircut.name, ...chosen.map((service) => service.name)].join(" · "),
              price: Math.round(((haircut.price ?? 0) + chosen.reduce((sum, service) => sum + (service.price ?? 0), 0)) * 100),
              slotLabel: "Now",
              payWhere: "shop",
              paid: true,
              payMethod: "cash",
              createdAt: nowAt,
              updatedAt: nowAt,
            }, chair.label, placeId);
            if (!sat) {
              setNote(`${chair.label} is taken.`);
              return;
            }
            setAdding(false);
            setName("");
            setPicked([]);
            setNote("");
          }}>Seat them</Button>
          <Button className="mt-2" fullWidth variant="secondary" onClick={() => { setAdding(false); setName(""); setPicked([]); }}>Cancel</Button>
        </section>
      ) : scanning ? (
        <OnlineScan
          rows={rows.filter((row) => here(row) && row.channel === "online")}
          onCancel={() => setScanning(false)}
          onSeat={(row) => {
            if (current) {
              setNote("Finish the cut in your chair first.");
              setScanning(false);
              return;
            }
            const sat = acceptOnChair(row.id, chair.label, placeId);
            if (!sat) {
              setNote(`${chair.label} is taken.`);
              return;
            }
            setScanning(false);
            setNote("");
          }}
        />
      ) : (
      <>
      <ActiveCard
        row={current}
        now={now}
        haircut={haircut}
        treatments={treatments}
        onWalkIn={() => {
          if (current) {
            setNote("Finish the cut in your chair first.");
            return;
          }
          if (allowance.atLimit) { setNote(allowance.message); return; }
          setNote(allowance.label);
          setAdding(true);
          setScanning(false);
        }}
        onScan={() => {
          if (current) {
            setNote("Finish the cut in your chair first.");
            return;
          }
          setNote("");
          setScanning(true);
          setAdding(false);
        }}
      />

      <section className="mt-5">
        <h2 className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">Waiting</h2>
        {current ? <p className="mt-1 px-1 text-[13px] font-semibold text-muted">Finish the cut in your chair before you accept the next one.</p> : null}
        {waiting.length === 0 ? (
          <p className="mt-2 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No one waiting.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {waiting.map((row) => (
              <WaitingCard
                key={row.id}
                row={row}
                busy={Boolean(current)}
                haircut={haircut}
                treatments={treatments}
                onAccept={() => {
                  if (current) {
                    setNote("Finish the cut in your chair first.");
                    return;
                  }
                  const sat = acceptOnChair(row.id, chair.label, placeId);
                  setNote(sat ? "" : `${chair.label} is taken.`);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <Button className="mt-6" fullWidth variant="secondary" leadingIcon={<History size={18} strokeWidth={1.75} />} onClick={() => setHistory(true)}>
        History{done.length ? ` · ${done.length}` : ""}
      </Button>
      </>
      )}
    </main>
  );
}

/** Looks up an online ticket and seats it in this chair. */
function OnlineScan({
  rows, onCancel, onSeat,
}: {
  rows: ChairRequest[];
  onCancel: () => void;
  onSeat: (row: ChairRequest) => void;
}) {
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const match = needle
    ? rows.find((row) => row.ref.toLowerCase() === needle || row.ref.toLowerCase().includes(needle))
    : undefined;
  const seatable = Boolean(match && (match.status === "requested" || match.status === "accepted") && !match.chairLabel);

  return (
    <section className="mt-5">
      <h2 className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">Scan</h2>
      <p className="mt-1 px-1 text-[13px] font-semibold text-muted">The ticket on the customer’s phone, from an online booking.</p>
      <form className="mt-3" onSubmit={(e) => { e.preventDefault(); setQuery(code.trim().toLowerCase()); }}>
        <Input label="Ticket" placeholder="RM-48213" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button className="mt-3" type="submit" fullWidth>Find</Button>
      </form>
      {needle && !match ? <p className="mt-4 text-[14px] font-semibold">No online ticket matches {code.trim()}.</p> : null}
      {match && !seatable ? (
        <p className="mt-4 text-[14px] font-semibold">{match.customerLabel || "That customer"} is already {statusLabel(match.status).toLowerCase()}.</p>
      ) : null}
      {match && seatable ? (
        <article className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
          <b className="block text-[18px]">{match.customerLabel || match.contact || "Customer"}</b>
          <p className="mt-1 text-[14px] font-medium text-muted">{match.serviceName} · {match.ref}</p>
          <p className="mt-1 text-[13px] font-semibold text-muted">Online · {match.slotLabel}</p>
          <Button className="mt-4" fullWidth onClick={() => onSeat(match)}>Seat them</Button>
        </article>
      ) : null}
      <Button className="mt-2" fullWidth variant="secondary" onClick={onCancel}>Cancel</Button>
    </section>
  );
}

type HistoryRange = "all" | "today" | "week" | "month";

const HISTORY_RANGES: { id: HistoryRange; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "week", label: "7 days" },
  { id: "month", label: "30 days" },
];

function manilaDay(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function manilaDayStart(ms: number) {
  return new Date(`${manilaDay(ms)}T00:00:00+08:00`).getTime();
}

/** Finished cuts for this chair, opened from History on the barber link. */
function ChairHistory({
  rows, now, who, chairLabel, haircut, treatments, onBack,
}: {
  rows: ChairRequest[];
  now: number;
  who: string;
  chairLabel: string;
  haircut: ShopHaircut;
  treatments: ShopTreatment[];
  onBack: () => void;
}) {
  const [range, setRange] = useState<HistoryRange>("all");
  const [day, setDay] = useState("");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = rows.filter((row) => {
    const at = row.completedAt ?? 0;
    if (day) {
      if (manilaDay(at) !== day) return false;
    } else if (range === "today") {
      if (manilaDay(at) !== manilaDay(now)) return false;
    } else if (range === "week") {
      if (at < manilaDayStart(now) - 6 * 86_400_000) return false;
    } else if (range === "month") {
      if (at < manilaDayStart(now) - 29 * 86_400_000) return false;
    }
    if (!needle) return true;
    const offer = visitOffer(row, haircut, treatments).label.toLowerCase();
    return (row.customerLabel || row.contact || "customer").toLowerCase().includes(needle) || offer.includes(needle) || row.ref.toLowerCase().includes(needle);
  });

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-4">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={onBack} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink">
          <ChevronLeft size={26} strokeWidth={1.75} />
        </button>
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">History</h1>
      </div>
      <p className="mt-0.5 pl-11 text-[14px] font-semibold text-muted">{who} · {chairLabel}</p>

      <div className="mt-4 flex gap-2 overflow-x-auto" role="group" aria-label="Date filter">
        {HISTORY_RANGES.map((item) => {
          const on = !day && range === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              onClick={() => { setRange(item.id); setDay(""); }}
              className={`h-9 flex-none rounded-pill px-3 text-[13px] font-bold ${on ? "bg-ink text-on-ink" : "bg-grey-100 text-ink"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <label className="mt-3 block">
        <span className="px-1 text-[13px] font-bold">Date</span>
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="mt-1 h-11 w-full rounded-[16px] bg-surface px-3 text-[15px] font-semibold text-ink ring-1 ring-grey-200"
        />
      </label>
      <div className="mt-3">
        <Input label="Find a cut" placeholder="Customer, service, or ticket" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No finished cuts for this filter.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {shown.map((row) => (
            <li key={row.id} className="flex items-center gap-3 rounded-card bg-surface px-3 py-3 shadow-card">
              <OfferIcons haircut={haircut} extras={visitOffer(row, haircut, treatments).extras} />
              <span className="min-w-0">
                <b className="block truncate text-[15px]">{row.customerLabel || row.contact || "Customer"}</b>
                <p className="mt-0.5 truncate text-[13px] font-medium text-muted">{visitOffer(row, haircut, treatments).label}</p>
                <p className="mt-1 text-[12.5px] font-semibold text-muted">Completed {completionLabel(row.completedAt!)}</p>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
