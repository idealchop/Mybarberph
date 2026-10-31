"use client";
import { showWaitingAndHistory } from "@/lib/barber-home";
import { AppLoader } from "@/components/common/app-loader";
import { PoweredBy } from "@/components/qr/shop-brand";
import { completeCut } from "@/components/transactions/complete-flow";
import { TransactionSheet } from "@/components/transactions/transaction-sheet";

import { useWalkInAllowance } from "@/lib/walkin-limit";
import { BarberPerformanceView } from "./barber-self";
import { BarberProfileView } from "./barber-profile-view";
import { QrScanner } from "@/components/scan/qr-scanner";
import { parseTicketCode } from "@/lib/ticket-code";
import { Avatar, Input } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, History, Lock, Navigation, Plus, ScanLine, Smartphone } from "lucide-react";
import { cn } from "@river-apps/ui";
import { Icon3d, InstallPanel } from "@/components/pwa/install-panel";
import { useInstallHidden } from "@/lib/pwa";

import { useEffect, useRef, useState } from "react";
import { mapsLink } from "@/lib/home-service-model";
import { BarberIcon } from "@/components/art";
import { startBarberCloud, useCloud } from "@/lib/cloud";
import {
  acceptOnChair, elapsedLabel, patchRequest, refCode, requestLocation, seatWalkInOnChair, statusLabel, useChairRequests,
  type ChairRequest,
} from "@/lib/chair-bookings";
import { chairBarberName, useShopChairs } from "@/lib/shop-chairs";
import { countToday, cutBarberId, manilaYmd } from "@/lib/cut-count";
import { addDays, dayLabel, dayOf, earningsOf, historyRow } from "@/lib/barber-history";
import { ClaimTag, dayClaimState } from "@/components/transactions/claim-tag";
import { peso } from "@/lib/format";
import { customerName, tipOf, visitPct } from "@/lib/income-split";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useGreeting, useShopProfile } from "@/lib/shop-profile";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { addServicePatch, addedServices, newWalkIn, removeServicePatch, serviceLine } from "@/lib/walkin-visit";
import { useShopMenu, type ShopHaircut, type ShopTreatment } from "@/lib/shop-services";

/** Install view (Jimboy, 2026-10-20): barber-focused lines. */
const BARBER_FEATURES = [
  { art: <Icon3d src="/icons3d/barbers/128/customers.webp" />, text: "Take walk-ins in a tap" },
  { art: <Icon3d src="/icons3d/barbers/128/qr.webp" />, text: "Scan customer tickets" },
  { art: <Icon3d src="/icons3d/barbers/128/reports.webp" />, text: "See my sales and haircuts" },
];

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
  const chunks = (row.serviceName || "").split("·").map((part) => part.trim()).filter(Boolean);
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
      <Button className="mt-3" size="sm" fullWidth loading={busy} onClick={onAccept}>Accept</Button>
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
  const [picking, setPicking] = useState(false);
  const elapsed = row?.startedAt ? elapsedLabel(row.startedAt, now) : "";
  // No "Walk-in" label (Jimboy, 2026-10-21): show the name when there is one.
  const who = row ? (customerName(row) || row.contact || "Now serving") : "Ready for next customer";
  return (
    <>
    <section className={`relative isolate mt-5 flex min-h-[150px] items-center overflow-hidden rounded-banner px-4 py-4 text-on-ink ${row ? "live-hero" : "bg-ink"}`} aria-label="Current customer">
      <div className="relative z-10 min-w-0 flex-1">
        <p className="truncate text-[12px] leading-4 font-medium text-on-ink-muted">{who}</p>
        <h2 className="mt-1 flex items-center gap-2 text-[22px] font-extrabold leading-none tabular-nums tracking-[-0.03em]">{row ? <><span className="live-dot" aria-hidden />{elapsed}<span className="sr-only"> in progress</span><span className="rounded-pill bg-white/15 px-1.5 py-0.5 text-[10.5px] font-extrabold">Live</span></> : "Available"}</h2>
        <p className="mt-0.5 truncate text-[12.5px] font-medium text-on-ink-muted">{row && offer ? `${serviceLine(row, offer.label)} · ${row.ref}` : "Walk-in, or an online ticket"}</p>
        {row && picking ? <AddServiceSheet row={row} treatments={treatments} onClose={() => setPicking(false)} /> : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {row ? <Button variant="white" size="sm" className={PILL} onClick={() => completeCut(row)}>Complete</Button> : (
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
              {/* Icon only (Jimboy, 2026-10-27); 44px tap target. */}
              <button
                type="button"
                aria-label="Scan QR"
                title="Scan QR"
                onClick={onScan}
                className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-white/10 text-on-ink ring-1 ring-white/25 active:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ScanLine size={18} strokeWidth={2} aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
      <div aria-hidden className="pointer-events-none relative z-0 -mr-2 w-[116px] flex-none">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative pre-sized local WebP; next/image adds nothing here */}
            <img src="/barber-hero.webp" alt="" width={116} height={111} className="h-auto w-[116px]" /></div>
    </section>
    {/* Under the card, text + icon only (Jimboy, 2026-10-31). */}
    {row && !row.home && treatments.length ? (
      <button type="button" onClick={() => setPicking(true)} className="mt-2 inline-flex items-center gap-1 px-1 py-2 text-[13px] font-semibold text-muted hover:text-ink">
        <Plus size={15} strokeWidth={2.25} aria-hidden />
        Add other service
      </button>
    ) : null}
    </>
  );
}

/**
 * v1.0.31: shop services for the live visit. Tap one to add it (amount goes up by its menu price); added ones can be
 * removed before Complete. Same visit row, so it is still one haircut in every count.
 */
function AddServiceSheet({ row, treatments, onClose }: { row: ChairRequest; treatments: ShopTreatment[]; onClose: () => void }) {
  const [busy, setBusy] = useState("");
  const added = addedServices(row).map((n) => n.toLowerCase());
  const run = (id: string, patch: Partial<ChairRequest>) => {
    setBusy(id);
    patchRequest(row.id, patch);
    window.setTimeout(() => setBusy(""), 400);
  };
  return (
    <BottomSheet title="Add service" subtitle={`${serviceLine(row, "Haircut")} · ${peso(row.price || 0)}`} onClose={onClose}
      footer={<><Button fullWidth onClick={onClose}>Done</Button><Button className="mt-1" fullWidth variant="ghost" onClick={onClose}>Cancel</Button></>}>
      <ul className="flex flex-col gap-2">
        {treatments.map((svc) => {
          const on = added.includes(svc.name.toLowerCase());
          return (
            <li key={svc.id} className="flex items-center gap-3 rounded-[16px] bg-surface px-3 py-2.5 ring-1 ring-grey-200">
              <BarberIcon name={svc.icon} size={36} title={svc.name} />
              <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{svc.name}</b><small className="text-[12.5px] font-semibold text-muted">{svc.price ? `₱${svc.price}` : ""}</small></span>
              <Button size="sm" variant={on ? "secondary" : "primary"} loading={busy === svc.id}
                onClick={() => run(svc.id, on ? removeServicePatch(row, svc) : addServicePatch(row, svc))}>{on ? "Remove" : "Add"}</Button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
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
  const [scanning, setScanning] = useState(false);
  const [history, setHistory] = useState(false);
  const [perf, setPerf] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [install, setInstall] = useState(false);
  const installHidden = useInstallHidden(token);
  const shopsLoc = useShopLocations();
  const chair = chairPreview;
  const allowance = useWalkInAllowance(chair?.locationId || HOME_LOCATION_ID);
  useEffect(() => {
    const on = (e: Event) => setNote((e as CustomEvent<string>).detail);
    window.addEventListener("barbers-booking-gone", on);
    return () => window.removeEventListener("barbers-booking-gone", on);
  }, []);

  if (cloud.ready && cloud.error && !cloud.shopId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col bg-canvas px-5 pt-16">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">This link was replaced or turned off.</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">Ask the shop to send you your current barber link.</p>
      </main>
    );
  }
  if (!chairsReady || !ready || !cloud.ready) {
    return <AppLoader />;
  }
  if (!chair) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col bg-canvas px-5 pt-16">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">This link was replaced or turned off.</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">Ask the shop to send you your current barber link.</p>
      </main>
    );
  }

  const placeId = chair.locationId || HOME_LOCATION_ID;
  const here = (row: ChairRequest) => requestLocation(row) === placeId;
  const myId = chair.barberId || chair.id;
  // Same "whose cut" rule as the owner's Sales and Profit report (src/lib/cut-count.ts).
  const mine = (row: ChairRequest) => here(row) && cutBarberId(row, chairs) === myId;
  const current = rows.find((row) => row.status === "in_chair" && row.chairLabel === chair.label && here(row));
  const waiting = rows
    .filter((row) => here(row) && !row.home && (row.status === "requested" || row.status === "accepted") && !row.chairLabel)
    .sort((a, b) => a.createdAt - b.createdAt);
  const homeVisits = rows
    .filter((row) => here(row) && row.home && (row.status === "requested" || row.status === "accepted" || row.status === "in_chair") && (!row.barberId || row.barberId === myId))
    .sort((a, b) => (a.scheduledAt ?? a.createdAt) - (b.scheduledAt ?? b.createdAt));
  const done = rows
    .filter((row) => row.status === "done" && mine(row) && row.completedAt)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const doneToday = countToday(done);

  const placeName = shopsLoc.enabled ? shopsLoc.branches.find((b) => b.id === placeId)?.name ?? "" : "";
  if (install) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-4">
        <button type="button" onClick={() => setInstall(false)} aria-label="Back" className="inline-flex size-11 items-center justify-center rounded-full"><ChevronLeft size={22} /></button>
        <InstallPanel token={token} features={BARBER_FEATURES} />
      </main>
    );
  }
  // Install entry lives on My sales only (Jimboy, 2026-10-20); hidden once installed (standalone, or remembered for this link).
  const installCard = installHidden ? null : (
    <button type="button" onClick={() => setInstall(true)} className="mt-3 flex w-full items-center gap-3 rounded-[16px] bg-surface px-3.5 py-2.5 text-left shadow-card">
      <Smartphone size={18} className="flex-none" aria-hidden />
      <span className="min-w-0 flex-1"><b className="block text-[14px]">Install app</b><small className="block truncate text-[12px] font-semibold text-muted">Open your link from the home screen</small></span>
      <ChevronRight size={18} className="flex-none text-subtle" aria-hidden />
    </button>
  );
  if (perf && showProfile) return <BarberProfileView token={token} who={chairBarberName(chair)} place={placeName} onBack={() => setShowProfile(false)} />;
  if (perf) return <BarberPerformanceView onProfile={() => setShowProfile(true)} token={token} who={chairBarberName(chair)} place={placeName} onBack={() => setPerf(false)} extra={installCard} />;
  if (history) {
    return (
      <ChairHistory
        token={token}
        rows={done}
        now={now}
        who={chairBarberName(chair)}
        chairLabel={placeName}
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
          <p className="truncate text-[13px] font-semibold text-muted">{placeName}</p>
        </div>
        <button type="button" aria-label="My sales" title="My sales" onClick={() => setPerf(true)} className="ml-auto inline-flex size-11 flex-none items-center justify-center rounded-full bg-surface text-ink shadow-card"><BarChart3 size={20} strokeWidth={2} /></button>
      </header>

      {allowance.unlimited ? null : (
        <p className="mt-3 rounded-[12px] bg-grey-100 px-3 py-2 text-[12.5px] font-bold text-ink-2" aria-live="polite">
          {allowance.atLimit ? allowance.message : allowance.label}
        </p>
      )}
      {note && note !== allowance.label && note !== allowance.message ? <p className="mt-4 text-[13.5px] font-semibold">{note}</p> : null}

      {scanning ? (
        <OnlineScan
          rows={rows.filter((row) => here(row) && row.channel === "online")}
          onCancel={() => setScanning(false)}
          onSeat={(row) => {
            if (current) {
              setNote("Finish your current haircut first.");
              setScanning(false);
              return;
            }
            const sat = acceptOnChair(row.id, chair.label, placeId);
            if (!sat) {
              setNote(`You already have a customer.`);
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
            setNote("Finish your current haircut first.");
            return;
          }
          if (allowance.atLimit) { setNote(allowance.message); return; }
          // v1.0.31 (Jimboy): no picker or Accept step. The walk-in is created already in the chair with the
          // shop's Haircut and price, and the timer starts at once. More services are added from the card.
          const at = Date.now();
          const sat = seatWalkInOnChair(newWalkIn({ shopId: cloud.shopId ?? "", ref: refCode(), haircut, at }), chair.label, placeId);
          setNote(sat ? "" : "You already have a customer.");
          setScanning(false);
        }}
        onScan={() => {
          if (current) {
            setNote("Finish your current haircut first.");
            return;
          }
          setNote("");
          setScanning(true);
        }}
      />


      {homeVisits.length ? (
        <section className="mt-5">
          <h2 className="px-1 text-[12.5px] font-extrabold text-muted">Home visits</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {homeVisits.map((row) => <HomeVisitCard key={row.id} row={row} seat={chair.label} />)}
          </ul>
        </section>
      ) : null}

      {/* v1.0.28: hidden while a haircut is active; `current` is live (realtime rows), so this toggles without a reload. */}
      {showWaitingAndHistory(current) ? (<>
      <section className="mt-5">
        <h2 className="px-1 text-[12.5px] font-extrabold text-muted">Waiting</h2>
        {waiting.length === 0 ? (
          <div className="mt-2 flex flex-col items-center rounded-card bg-surface px-4 py-6 text-center shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons3d/barbers/128/waiting-area.webp" alt="" width={52} height={52} className="size-[52px] object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.12)]" />
            <b className="mt-2 text-[14.5px]">No one waiting</b>
            <span className="text-[12.5px] font-semibold text-muted">New walk-ins and online bookings show up here.</span>
          </div>
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
                    setNote("Finish your current haircut first.");
                    return;
                  }
                  const sat = acceptOnChair(row.id, chair.label, placeId);
                  setNote(sat ? "" : `You already have a customer.`);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <Button className="mt-6" fullWidth variant="secondary" leadingIcon={<History size={18} strokeWidth={1.75} />} onClick={() => setHistory(true)}>
        {/* Count = this barber's finished cuts TODAY (Manila), the same number as the owner's Sales > Today.
            It used to be every loaded finished cut, all days (v1.0.19 fix). */}
        History{doneToday ? ` · ${doneToday} today` : ""}
      </Button>
      </>) : null}
      <PoweredBy />
      </>
      )}
    </main>
  );
}

/** One home visit: address, Navigate, and On the way → Arrived → Done (the customer sees each step in River Mobile). */
function HomeVisitCard({ row, seat }: { row: ChairRequest; seat: string }) {
  const [busy, setBusy] = useState(false);
  const step = row.homeStatus === "arrived" ? 2 : row.homeStatus === "on_the_way" ? 1 : 0;
  const go = (patch: Partial<ChairRequest>) => { setBusy(true); patchRequest(row.id, patch); window.setTimeout(() => setBusy(false), 600); };
  const home = row.home!;
  return (
    <li className="rounded-card bg-surface px-4 py-3.5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <b className="truncate text-[15.5px]">{row.customerLabel || "Customer"}</b>
        <span className="inline-flex h-5 flex-none items-center rounded-pill bg-ink px-1.5 text-[10.5px] font-extrabold text-on-ink">Home</span>
      </div>
      <p className="mt-0.5 truncate text-[13px] font-medium text-muted">{row.serviceName} · {row.slotLabel}{row.price ? ` · ₱${(row.price / 100).toLocaleString("en-PH")}` : ""}</p>
      <p className="mt-2 rounded-[12px] bg-grey-100 px-3 py-2 text-[13px] font-semibold">{home.address}<span className="block text-[12px] text-muted">{home.distanceKm} km{home.notes ? ` · ${home.notes}` : ""}{row.contact ? ` · ${row.contact}` : ""}</span></p>
      <ol className="mt-3 flex items-center gap-1.5 text-[11.5px] font-bold" aria-label="Visit steps">
        {["On the way", "Arrived", "Done"].map((label, i) => <li key={label} className={`flex-1 rounded-pill py-1 text-center ${i < step ? "bg-ink text-on-ink" : i === step ? "bg-grey-200" : "bg-grey-100 text-muted"}`}>{label}</li>)}
      </ol>
      <div className="mt-3 flex gap-2">
        <a href={mapsLink(home.lat, home.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-pill bg-grey-100 text-[13.5px] font-bold"><Navigation size={15} strokeWidth={2.2} aria-hidden />Navigate</a>
        {step === 0 ? <Button size="sm" className="flex-1" loading={busy} onClick={() => go({ status: "accepted", homeStatus: "on_the_way" })}>On the way</Button>
          : step === 1 ? <Button size="sm" className="flex-1" loading={busy} onClick={() => go({ status: "in_chair", homeStatus: "arrived", startedAt: Date.now(), seatLabel: seat })}>Arrived</Button>
          : <Button size="sm" className="flex-1" onClick={() => completeCut(row)}>Done</Button>}
      </div>
    </li>
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
    ? rows.find((row) => row.ref.toLowerCase() === needle || (row.ref || "").toLowerCase().includes(needle))
    : undefined;
  const seatable = Boolean(match && (match.status === "requested" || match.status === "accepted") && !match.chairLabel);

  return (
    <section className="mt-5">
      <h2 className="px-1 text-[12.5px] font-extrabold text-muted">Scan</h2>
      <p className="mt-1 px-1 text-[13px] font-semibold text-muted">Point the camera at the QR on the customer’s ticket.</p>
      <QrScanner className="mt-3" paused={Boolean(match)} onResult={(text) => { const c = parseTicketCode(text); setCode(c); setQuery(c.toLowerCase()); }} />
      {match ? <Button className="mt-2" size="sm" variant="secondary" fullWidth onClick={() => { setCode(""); setQuery(""); }}>Scan another</Button> : null}
      <form className="mt-3" onSubmit={(e) => { e.preventDefault(); setQuery(code.trim().toLowerCase()); }}>
        <p className="mb-2 px-1 text-[12.5px] font-semibold text-muted">Or type the code</p>
        <Input label="Ticket" placeholder="BK-7K2Q9M" value={code} onChange={(e) => setCode(e.target.value)} />
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
          <Button className="mt-4" fullWidth onClick={() => onSeat(match)}>Accept</Button>
        </article>
      ) : null}
      <Button className="mt-1" fullWidth variant="ghost" onClick={onCancel}>Cancel</Button>
    </section>
  );
}

/** Server rows (complete for past days) plus the live link rows (just-finished cuts), by id. */
/**
 * Server rows (complete for past days) plus the live link rows (just-finished cuts), by id; the newer copy wins.
 * v1.0.21 fix: a failed fetch used to leave History on "Loading…" forever, and one raw row missing serviceName/ref
 * crashed the whole screen. Rows are normalised, errors show with a retry, and `reload` refreshes after an edit.
 */
function useHistoryRows(token: string, live: ChairRequest[], day: string) {
  const [server, setServer] = useState<{ key: string; rows: ChairRequest[]; pct: number | null; locked: string[] } | null>(null);
  const [failed, setFailed] = useState("");
  const [tick, setTick] = useState(0);
  const key = `${day}#${tick}`;
  useEffect(() => {
    let off = false;
    fetch(`/api/barber/${token}/history?date=${day}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { rows?: Partial<ChairRequest>[]; sharePct?: number | null; locked?: string[] }) => {
        if (off) return;
        setFailed("");
        setServer({ key, rows: (d.rows ?? []).map((r, i) => historyRow(`row-${i}`, r)), pct: d.sharePct ?? null, locked: d.locked ?? [] });
      })
      .catch(() => { if (!off) setFailed(key); });
    return () => { off = true; };
  }, [token, day, key]);
  const fresh = server?.key === key ? server : null;
  const byId = new Map<string, ChairRequest>();
  for (const r of fresh?.rows ?? []) byId.set(r.id, r);
  for (const r of live) { const s = byId.get(r.id); if (!s || (r.updatedAt || 0) >= (s.updatedAt || 0)) byId.set(r.id, historyRow(r.id, r)); }
  return {
    rows: [...byId.values()], pct: fresh?.pct ?? server?.pct ?? null, locked: new Set(fresh?.locked ?? []),
    loading: !fresh && failed !== key, error: failed === key, reload: () => setTick((t) => t + 1),
  };
}

/**
 * Barber link History, one day at a time (v1.0.19): a day changer row (prev/next) + a calendar to jump, with that
 * day's cuts and earnings. Every day uses the shared rule
 * (src/lib/cut-count.ts: Manila day, done + completedAt, own barberId, this link's location), so each day equals
 * the owner's Sales for this barber and day.
 */
function ChairHistory({
  token, rows: live, now, who, chairLabel, haircut, treatments, onBack,
}: {
  token: string;
  rows: ChairRequest[];
  now: number;
  who: string;
  chairLabel: string;
  haircut: ShopHaircut;
  treatments: ShopTreatment[];
  onBack: () => void;
}) {
  const today = manilaYmd(now);
  const [openRow, setOpenRow] = useState<ChairRequest | null>(null);
  const [day, setDay] = useState(today);
  const [query, setQuery] = useState("");
  const dateRef = useRef<HTMLInputElement>(null);
  const { rows, pct, loading, error, locked, reload } = useHistoryRows(token, live, day);
  const needle = query.trim().toLowerCase();
  const match = (row: ChairRequest) => {
    if (!needle) return true;
    const offer = visitOffer(row, haircut, treatments).label.toLowerCase();
    return (row.customerLabel || row.contact || "customer").toLowerCase().includes(needle) || offer.includes(needle) || row.ref.toLowerCase().includes(needle);
  };
  const picked = dayOf(day, rows, pct);

  const claimState = dayClaimState(picked.rows, (id) => locked.has(id));
  const green = claimState === "claimed";
  const cashOpen = picked.rows.filter((r) => Boolean(r.paid) && (r.price || 0) > 0 && !locked.has(r.id)).length; // cash and GCash (v1.0.25)
  const time = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
  const item = (row: ChairRequest) => {
    const offer = visitOffer(row, haircut, treatments);
    return (
      <li key={row.id}>
        <button type="button" aria-label={`Order details for ${row.customerLabel || row.contact || "customer"}`} onClick={() => setOpenRow(row)}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-grey-100">
          <span className="w-[3.6rem] flex-none text-[12.5px] font-semibold tabular-nums text-muted">{time(row.completedAt!)}</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[14.5px]">{row.customerLabel || row.contact || "Walk-in"}</b>
            <small className="block truncate text-[12px] font-semibold text-muted">{[offer.label, tipOf(row) ? `Tip ${peso(tipOf(row))}` : ""].filter(Boolean).join(" · ")}</small>
          </span>
          <ClaimTag r={row} claimed={locked.has(row.id)} />
          <b className="w-[3.6rem] flex-none text-right text-[15px] tabular-nums">{peso(earningsOf(row.price || 0, tipOf(row), visitPct(row, pct)))}</b>
          {locked.has(row.id) ? <Lock size={14} className="flex-none text-subtle" aria-label="Locked" /> : <ChevronRight size={16} className="flex-none text-subtle" aria-hidden />}
        </button>
      </li>
    );
  };
  const shownDay = picked.rows.filter(match);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-4 lg:max-w-[880px] lg:px-[30px]">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={onBack} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink">
          <ChevronLeft size={26} strokeWidth={1.75} />
        </button>
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">History</h1>
      </div>
      <p className="mt-0.5 pl-11 text-[14px] font-semibold text-muted">{[who, chairLabel].filter(Boolean).join(" · ")}</p>

      <section aria-label="Day summary" className={cn("mt-4 rounded-[22px] px-4 pb-4 pt-3.5", green ? "bg-[#0F7A45] text-white" : "bg-ink text-on-ink")}>
        <div className="flex items-center justify-between gap-3">
          <p className={cn("text-[12.5px] font-semibold", green ? "text-white/75" : "text-on-ink-muted")}>Your share</p>
          {green ? <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-white/20 px-2.5 text-[11.5px] font-bold text-white"><Check size={12} strokeWidth={3} aria-hidden />All claimed</span>
            : claimState === "open" ? <span className="inline-flex h-6 items-center gap-1.5 rounded-pill bg-[#FFF1D6] px-2.5 text-[11.5px] font-bold text-[#8A5A00]"><i aria-hidden className="size-1.5 rounded-full bg-[#D97706]" />{cashOpen} to claim</span> : null}
        </div>
        <b className="mt-1 block text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(picked.earnings)}</b>
        <p className={cn("mt-2 text-[12.5px] font-semibold tabular-nums", green ? "text-white/75" : "text-on-ink-muted")}>
          {loading && picked.cuts === 0 ? "Loading…" : [`${picked.cuts} haircut${picked.cuts === 1 ? "" : "s"}`, pct != null ? `your ${pct}%` : "", picked.tips ? `Tips ${peso(picked.tips)}` : ""].filter(Boolean).join(" · ")}
        </p>
      </section>

      <div className="mt-3 flex items-center gap-2">
        <div role="group" aria-label="Day" className="flex h-11 min-w-0 flex-1 items-center justify-between rounded-pill bg-surface shadow-card">
          <button type="button" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}
            className="inline-flex size-11 flex-none items-center justify-center rounded-full text-ink active:bg-grey-100"><ChevronLeft size={18} strokeWidth={2.4} /></button>
          <span aria-live="polite" className="min-w-0 truncate whitespace-nowrap text-[14px] font-bold tabular-nums">{dayLabel(day, now)}</span>
          <button type="button" aria-label="Next day" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}
            className="inline-flex size-11 flex-none items-center justify-center rounded-full text-ink active:bg-grey-100 disabled:opacity-30"><ChevronRight size={18} strokeWidth={2.4} /></button>
        </div>
        <label className="relative inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-full bg-surface text-ink shadow-card" title="Pick a date">
          <CalendarDays size={18} strokeWidth={2.2} aria-hidden />
          <span className="sr-only">Pick a date</span>
          <input ref={dateRef} type="date" max={today} value={day}
            onClick={() => { try { dateRef.current?.showPicker?.(); } catch { /* not supported */ } }}
            onChange={(e) => { if (e.target.value) setDay(e.target.value > today ? today : e.target.value); }}
            className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
      <div className="mt-3 overflow-hidden rounded-[16px] bg-surface shadow-card">
        <Input aria-label="Find a haircut" placeholder="Find a haircut: customer, service, ticket" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {openRow ? <TransactionSheet row={openRow} barber locked={locked.has(openRow.id)} onClose={() => { setOpenRow(null); reload(); }} /> : null}
      {error ? (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card">
          <p className="text-[13.5px] font-semibold text-ink-2">Couldn’t load this day.</p>
          <Button size="sm" pill className="flex-none" onClick={reload}>Retry</Button>
        </div>
      ) : null}
      {shownDay.length === 0 ? (
        <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">{loading ? "Loading…" : needle ? "No haircuts match." : "No finished haircuts this day."}</p>
      ) : (
        <>
          <div className="mt-5 flex items-baseline justify-between px-1">
            <b className="text-[15px]">Haircuts</b>
            <small className="text-[12px] font-semibold text-muted">{shownDay.length} · tap to view or edit</small>
          </div>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">{shownDay.map(item)}</ul>
        </>
      )}
    </main>
  );
}
