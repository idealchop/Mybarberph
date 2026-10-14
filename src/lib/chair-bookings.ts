"use client";

import { useEffect, useState } from "react";
import type { ChairRequest, ChairStatus } from "@/lib/booking-types";
import { cloudBookings, removeBooking, saveBooking, useCloud } from "@/lib/cloud";
import { chairLocation, loadChairs, occupyChair, occupyNextChair, vacateChair } from "@/lib/shop-chairs";
import { ALL_LOCATIONS, HOME_LOCATION_ID, inLocation, readLocationStore, useShopLocations } from "@/lib/shop-locations";

export type { ChairRequest, ChairStatus, Channel, PayWhere } from "@/lib/booking-types";

export const ACTIVE_BOOKING_KEY = "barbers.active-booking";

export function bookingUrl(origin: string, shopId: string, locationId?: string) {
  const base = `${origin}/book?shop=${encodeURIComponent(shopId)}`;
  if (!locationId) return base;
  return `${base}&loc=${encodeURIComponent(locationId)}`;
}

export function requestLocation(row: { locationId?: string }) {
  return row.locationId || HOME_LOCATION_ID;
}

function locationForNew(row?: { locationId?: string }) {
  if (row?.locationId) return row.locationId;
  const store = readLocationStore();
  if (!store.enabled || store.viewId === ALL_LOCATIONS) return HOME_LOCATION_ID;
  return store.viewId || HOME_LOCATION_ID;
}

export const HOW_IT_WORKS = [
  "Customers scan this one code and open the booking page.",
  "They choose a haircut and a time.",
  "They leave an email or a mobile number.",
  "They choose to pay online or at the chair.",
  "The request shows in Queue → Online. Accept it to start the visit.",
] as const;

export function mergeRequests(): ChairRequest[] {
  return [...cloudBookings()].sort((a, b) => b.createdAt - a.createdAt);
}

export function addWalkIn(booking: ChairRequest) {
  saveBooking(booking);
}

/** Adds a walk-in and sits them immediately. Returns the chair, or null when none is free. */
export function seatWalkIn(booking: ChairRequest): string | null {
  const locationId = locationForNew(booking);
  addWalkIn({ ...booking, locationId, status: "accepted" });
  const label = markInChair(booking.id);
  if (!label) removeBooking(booking.id);
  return label;
}

/** Adds a walk-in and sits them in this chair. Returns the chair, or null when it is taken. */
export function seatWalkInOnChair(booking: ChairRequest, chairLabel: string, locationId?: string): string | null {
  const loc = locationId || locationForNew(booking);
  if (usedChairs(loc).has(chairLabel)) return null;
  addWalkIn({ ...booking, locationId: loc, status: "accepted" });
  const label = acceptOnChair(booking.id, chairLabel, loc);
  if (!label) removeBooking(booking.id);
  return label;
}

function usedChairs(loc: string) {
  const used = new Set<string>();
  for (const item of mergeRequests()) {
    if (item.status === "in_chair" && item.chairLabel && requestLocation(item) === loc) used.add(item.chairLabel);
  }
  return used;
}

export function patchRequest(id: string, patch: Partial<ChairRequest>) {
  const row = mergeRequests().find((b) => b.id === id);
  if (!row) return;
  const next = { ...row, ...patch, id, updatedAt: Date.now() } as ChairRequest;
  for (const k of Object.keys(patch) as (keyof ChairRequest)[]) if (patch[k] === undefined) delete next[k];
  saveBooking(next);
}

export function setRequestStatus(id: string, status: ChairStatus) {
  patchRequest(id, { status });
}

/** Puts the visit in the first free seat from Services. Returns the chair label, or null when every seat is taken. */
export function markInChair(id: string): string | null {
  const row = mergeRequests().find((item) => item.id === id);
  const loc = locationForNew(row);
  const at = Date.now();
  // A shop without chairs set up (common for new Partner shops) can still serve the customer.
  if (!loadChairs().some((chair) => chairLocation(chair) === loc)) {
    patchRequest(id, { status: "in_chair", startedAt: at, locationId: loc });
    return "Chair";
  }
  const label = occupyNextChair(id, usedChairs(loc), at, loc);
  if (!label) return null;
  patchRequest(id, { status: "in_chair", chairLabel: label, seatLabel: label, startedAt: at, locationId: loc });
  return label;
}

/** Accept onto one barber’s chair and start their timer. Null when that chair is taken. */
export function acceptOnChair(id: string, chairLabel: string, locationId?: string): string | null {
  const row = mergeRequests().find((item) => item.id === id);
  const loc = locationId || locationForNew(row);
  if (usedChairs(loc).has(chairLabel)) return null;
  const at = Date.now();
  if (!occupyChair(chairLabel, id, at, loc)) return null;
  patchRequest(id, { status: "in_chair", chairLabel, seatLabel: chairLabel, startedAt: at, locationId: loc });
  return chairLabel;
}

export type DonePayment = { price: number; paid: boolean; method: "cash" | "gcash" };

/** Finishes the visit with the payment confirmed in the Complete popup. An online payment stays as the customer left it. */
export function markDone(id: string, pay?: DonePayment) {
  const row = mergeRequests().find((item) => item.id === id);
  if (row?.chairLabel) vacateChair(row.chairLabel, Date.now(), requestLocation(row));
  const onlinePaid = Boolean(row?.paid) && row?.payWhere === "online";
  patchRequest(id, {
    status: "done",
    ...(onlinePaid || !pay ? { paid: Boolean(row?.paid) } : pay.paid
      ? { price: pay.price, paid: true, payMethod: pay.method, payWhere: "shop" as const }
      : { price: pay.price, paid: false, payMethod: undefined }),
    completedAt: Date.now(),
    seatLabel: row?.seatLabel || row?.chairLabel,
    chairLabel: undefined,
  });
}

/** Today in Manila, from this shop's finished visits. */
export function todayFigures(rows: ChairRequest[]) {
  const today = manilaDay(Date.now());
  const extra = rows.filter((row) => row.status === "done" && manilaDay(row.completedAt ?? row.updatedAt) === today);
  return { sales: extra.reduce((sum, row) => sum + row.price, 0), cuts: extra.length, extra };
}

export function manilaDay(ms: number) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/** Queue, home, and history for the shop that is open. All locations keeps every shop. */
export function useScopedRequests() {
  const data = useChairRequests();
  const loc = useShopLocations();
  const rows = data.ready && loc.ready
    ? data.rows.filter((row) => inLocation(row.locationId, loc.enabled, loc.viewingAll, loc.scopeId))
    : [];
  return { rows, ready: data.ready && loc.ready };
}

export function useChairRequests() {
  const cloud = useCloud();
  const rows = [...cloud.bookings].sort((a, b) => b.createdAt - a.createdAt);
  return { rows, ready: cloud.ready };
}

/** Customer status page: polls the server for this one booking. */
export function usePublicBooking(id: string, shopId: string) {
  const [booking, setBooking] = useState<ChairRequest | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const pull = async () => {
      try {
        const res = await fetch(`/api/public/bookings/${encodeURIComponent(id)}?shop=${encodeURIComponent(shopId)}`, { cache: "no-store" });
        if (!live) return;
        if (res.status === 404) { setBooking(null); return; }
        const d = await res.json();
        if (live && d.booking) setBooking(d.booking as ChairRequest);
      } catch { /* keep the last status */ }
    };
    void pull();
    const timer = window.setInterval(pull, 5000);
    return () => { live = false; window.clearInterval(timer); };
  }, [id, shopId]);
  return booking;
}

/** One contact: an email, or a Philippine mobile. */
export function parseContact(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes("@")) {
    if (value.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
    return value.toLowerCase();
  }
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("63")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^9\d{9}$/.test(digits)) return null;
  return `0${digits}`;
}

export function refCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `BK-${s}`;
}

export function statusLabel(status: ChairStatus) {
  if (status === "requested") return "Sent";
  if (status === "accepted") return "Accepted";
  if (status === "in_chair") return "In chair";
  if (status === "done") return "Done";
  return "Declined";
}

/** Clock time saved on the finished visit. */
export function completionLabel(ms: number) {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

/** Elapsed time since Accept, as m:ss or h:mm:ss. */
export function elapsedLabel(from: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - from) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes % 60).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}
