"use client";

import { useEffect, useState } from "react";
import { chairs, incomingBookings, salesSummary, services, shop, tickets } from "@/data";
import { occupyChair, occupyNextChair, vacateChair } from "@/lib/shop-chairs";
import { ALL_LOCATIONS, HOME_LOCATION_ID, inLocation, readLocationStore, useShopLocations } from "@/lib/shop-locations";
import type { Ticket, TicketStatus } from "@/data";
import { clock, peso } from "@/lib/format";

/** The one sample shop encoded in the shop QR. */
export const SAMPLE_SHOP_ID = shop.id;

export type ChairStatus = "requested" | "accepted" | "in_chair" | "done" | "declined";
export type PayWhere = "online" | "shop";
export type Channel = "walk-in" | "online";

export interface ChairRequest {
  id: string;
  shopId: string;
  ref: string;
  channel: Channel;
  status: ChairStatus;
  contact: string;
  customerLabel: string;
  serviceId: string;
  serviceName: string;
  price: number;
  slotLabel: string;
  payWhere: PayWhere;
  /** Set while the customer is in a chair. Cleared when the cut is finished. */
  chairLabel?: string;
  /** Chair that finished the visit. Kept after the seat is free. */
  seatLabel?: string;
  /** When Accept sat them down. The barber timer starts here. */
  startedAt?: number;
  /** When the cut was marked done. */
  completedAt?: number;
  /** Shop this visit belongs to. Missing means the first shop. */
  locationId?: string;
  /** Online visits are paid from the status page. Pay-at-the-chair visits are paid when the shop taps Done. */
  paid?: boolean;
  createdAt: number;
  updatedAt: number;
}

const PUBLIC_KEY = "barbers.public-bookings";
const ACTIVE_KEY = "barbers.active-booking";
const OVERRIDES_KEY = "barbers.booking-overrides";
const WALKINS_KEY = "barbers.walk-ins";
const EVENT = "barbers-bookings";

export function bookingUrl(origin: string, shopId = SAMPLE_SHOP_ID, locationId?: string) {
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

const BOOKABLE = services.filter((s) => s.active && s.category !== "addon");
export const bookableServices = BOOKABLE;

export function servicePrice(id: string) {
  return services.find((s) => s.id === id)?.price ?? 0;
}

function ticketStatus(status: TicketStatus): ChairStatus {
  if (status === "in_service" || status === "awaiting_confirmation") return "in_chair";
  if (status === "paid" || status === "completed") return "done";
  if (status === "cancelled" || status === "rejected" || status === "no_show") return "declined";
  return "accepted";
}

function chairName(id?: string) {
  return chairs.find((c) => c.id === id)?.label;
}

function fromTicket(t: Ticket): ChairRequest {
  const created = new Date(t.createdAt).getTime();
  const online = t.source === "partner";
  const status = ticketStatus(t.status);
  return {
    id: t.id,
    shopId: SAMPLE_SHOP_ID,
    ref: t.referenceId,
    channel: online ? "online" : "walk-in",
    status,
    contact: "",
    customerLabel: t.customerName,
    serviceId: t.serviceIds[0] ?? "",
    serviceName: t.serviceLabel,
    price: servicePrice(t.serviceIds[0] ?? ""),
    slotLabel: clock(t.createdAt),
    payWhere: online ? "online" : "shop",
    chairLabel: status === "in_chair" ? chairName(t.chairId) : undefined,
    seatLabel: chairName(t.chairId),
    startedAt: t.startedAt ? new Date(t.startedAt).getTime() : undefined,
    completedAt: status === "done" && t.completedAt ? new Date(t.completedAt).getTime() : undefined,
    paid: status === "done" ? true : undefined,
    createdAt: created,
    updatedAt: created,
  };
}

function fromIncoming(): ChairRequest[] {
  return incomingBookings.map((b) => {
    const created = new Date(b.arrivingAt).getTime();
    return {
      id: b.id,
      shopId: SAMPLE_SHOP_ID,
      ref: b.referenceId,
      channel: "online" as const,
      status: b.status === "pending" ? "requested" as const : "accepted" as const,
      contact: "",
      customerLabel: b.customerName,
      serviceId: "",
      serviceName: b.serviceLabel,
      price: b.price,
      slotLabel: b.arrivingLabel,
      payWhere: "online" as const,
      createdAt: created,
      updatedAt: created,
    };
  });
}

const SEED: ChairRequest[] = [
  ...tickets.map(fromTicket),
  ...fromIncoming(),
];

/** Visits already counted in the sample day's sales. New completions add on top. */
const ORIGINAL_DONE = new Set(SEED.filter((row) => row.status === "done").map((row) => row.id));

function isRequest(v: unknown): v is ChairRequest {
  if (!v || typeof v !== "object") return false;
  const b = v as ChairRequest;
  return typeof b.id === "string" && typeof b.ref === "string" && typeof b.status === "string";
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function emit() {
  window.dispatchEvent(new Event(EVENT));
}

export function readPublicBookings(): ChairRequest[] {
  const parsed = readJson<unknown>(PUBLIC_KEY, []);
  return Array.isArray(parsed) ? parsed.filter(isRequest) : [];
}

export function writePublicBooking(booking: ChairRequest) {
  const next = [booking, ...readPublicBookings().filter((b) => b.id !== booking.id)].slice(0, 40);
  window.localStorage.setItem(PUBLIC_KEY, JSON.stringify(next));
  emit();
}

export function readPublicBooking(id: string) {
  return readPublicBookings().find((b) => b.id === id) ?? null;
}

export const ACTIVE_BOOKING_KEY = ACTIVE_KEY;

function readOverrides(): Record<string, Partial<ChairRequest>> {
  const parsed = readJson<unknown>(OVERRIDES_KEY, {});
  return parsed && typeof parsed === "object" ? parsed as Record<string, Partial<ChairRequest>> : {};
}

function readWalkIns(): ChairRequest[] {
  const parsed = readJson<unknown>(WALKINS_KEY, []);
  return Array.isArray(parsed) ? parsed.filter(isRequest) : [];
}

export function addWalkIn(booking: ChairRequest) {
  const next = [booking, ...readWalkIns().filter((b) => b.id !== booking.id)].slice(0, 40);
  window.localStorage.setItem(WALKINS_KEY, JSON.stringify(next));
  emit();
}

/** Adds a walk-in and sits them immediately. Returns the chair, or null when none is free. */
export function seatWalkIn(booking: ChairRequest): string | null {
  const locationId = locationForNew(booking);
  addWalkIn({ ...booking, locationId, status: "accepted" });
  const label = markInChair(booking.id);
  if (!label) dropWalkIn(booking.id);
  return label;
}

/** Adds a walk-in and sits them in this chair. Returns the chair, or null when it is taken. */
export function seatWalkInOnChair(booking: ChairRequest, chairLabel: string, locationId?: string): string | null {
  const loc = locationId || locationForNew(booking);
  addWalkIn({ ...booking, locationId: loc, status: "accepted" });
  const label = acceptOnChair(booking.id, chairLabel, loc);
  if (!label) dropWalkIn(booking.id);
  return label;
}

function dropWalkIn(id: string) {
  window.localStorage.setItem(WALKINS_KEY, JSON.stringify(readWalkIns().filter((b) => b.id !== id)));
  emit();
}

function applyOverride(row: ChairRequest, overrides: Record<string, Partial<ChairRequest>>): ChairRequest {
  const patch = overrides[row.id];
  return patch ? { ...row, ...patch, id: row.id } : row;
}

export function mergeRequests(local = readLocal()): ChairRequest[] {
  const seeded = SEED.map((row) => applyOverride(row, local.overrides));
  const ids = new Set(seeded.map((row) => row.id));
  const extras = [...local.walkins, ...local.public].filter((row) => !ids.has(row.id));
  return [...extras, ...seeded].sort((a, b) => b.createdAt - a.createdAt);
}

function readLocal() {
  return { public: readPublicBookings(), walkins: readWalkIns(), overrides: readOverrides() };
}

export function patchRequest(id: string, patch: Partial<ChairRequest>) {
  const now = Date.now();
  const next = { ...patch, updatedAt: now };
  const apply = (row: ChairRequest) => row.id === id ? { ...row, ...next } : row;
  const pub = readPublicBookings();
  if (pub.some((b) => b.id === id)) {
    window.localStorage.setItem(PUBLIC_KEY, JSON.stringify(pub.map(apply)));
    emit();
    return;
  }
  const walks = readWalkIns();
  if (walks.some((b) => b.id === id)) {
    window.localStorage.setItem(WALKINS_KEY, JSON.stringify(walks.map(apply)));
    emit();
    return;
  }
  const overrides = readOverrides();
  overrides[id] = { ...(overrides[id] ?? {}), ...next };
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  emit();
}

export function setRequestStatus(id: string, status: ChairStatus) {
  patchRequest(id, { status });
}

/** Puts the visit in the first free seat from Services. Returns the chair label, or null when every seat is taken. */
export function markInChair(id: string): string | null {
  const row = mergeRequests().find((item) => item.id === id);
  const loc = locationForNew(row);
  const used = new Set<string>();
  for (const item of mergeRequests()) {
    if (item.status === "in_chair" && item.chairLabel && requestLocation(item) === loc) used.add(item.chairLabel);
  }
  const at = Date.now();
  const label = occupyNextChair(id, used, at, loc);
  if (!label) return null;
  patchRequest(id, { status: "in_chair", chairLabel: label, seatLabel: label, startedAt: at, locationId: loc });
  return label;
}

/** Accept onto one barber’s chair and start their timer. Null when that chair is taken. */
export function acceptOnChair(id: string, chairLabel: string, locationId?: string): string | null {
  const row = mergeRequests().find((item) => item.id === id);
  const loc = locationId || locationForNew(row);
  const used = new Set<string>();
  for (const item of mergeRequests()) {
    if (item.status === "in_chair" && item.chairLabel && requestLocation(item) === loc) used.add(item.chairLabel);
  }
  if (used.has(chairLabel)) return null;
  const at = Date.now();
  if (!occupyChair(chairLabel, id, at, loc)) return null;
  patchRequest(id, { status: "in_chair", chairLabel, seatLabel: chairLabel, startedAt: at, locationId: loc });
  return chairLabel;
}

/** Finishes the visit. Cash is collected here. An online payment stays as the customer left it. */
export function markDone(id: string) {
  const row = mergeRequests().find((item) => item.id === id);
  if (row?.chairLabel) vacateChair(row.chairLabel, Date.now(), requestLocation(row));
  patchRequest(id, {
    status: "done",
    paid: row?.payWhere === "shop" ? true : Boolean(row?.paid),
    completedAt: Date.now(),
    seatLabel: row?.seatLabel || row?.chairLabel,
    chairLabel: undefined,
  });
}

export function markPaid(id: string) {
  patchRequest(id, { paid: true });
}

export function todayFigures(rows: ChairRequest[], includeSeed = true) {
  const extra = rows.filter((row) => row.status === "done" && !ORIGINAL_DONE.has(row.id));
  return {
    sales: (includeSeed ? salesSummary.sales : 0) + extra.reduce((sum, row) => sum + row.price, 0),
    cuts: (includeSeed ? salesSummary.transactions : 0) + extra.length,
    extra,
  };
}

/** Queue, home, and history for the shop that is open. All locations keeps every shop. */
export function useScopedRequests() {
  const data = useChairRequests();
  const loc = useShopLocations();
  const rows = data.ready && loc.ready
    ? data.rows.filter((row) => inLocation(row.locationId, loc.enabled, loc.viewingAll, loc.scopeId))
    : [];
  const includeSeed = !loc.enabled || loc.viewingAll || loc.scopeId === HOME_LOCATION_ID;
  return { rows, ready: data.ready && loc.ready, includeSeed };
}

const EMPTY_LOCAL = { public: [] as ChairRequest[], walkins: [] as ChairRequest[], overrides: {} as Record<string, Partial<ChairRequest>> };

export function useChairRequests() {
  const [ready, setReady] = useState(false);
  const [local, setLocal] = useState(EMPTY_LOCAL);
  useEffect(() => {
    const pull = () => setLocal(readLocal());
    pull();
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === PUBLIC_KEY || e.key === WALKINS_KEY || e.key === OVERRIDES_KEY || e.key === null) pull();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, pull);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, pull);
    };
  }, []);
  return { rows: ready ? mergeRequests(local) : [], ready };
}

export function usePublicBooking(id: string) {
  const [booking, setBooking] = useState<ChairRequest | null | undefined>(undefined);
  useEffect(() => {
    const pull = () => setBooking(readPublicBooking(id));
    pull();
    const onStorage = () => pull();
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, pull);
    const timer = window.setInterval(pull, 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, pull);
      window.clearInterval(timer);
    };
  }, [id]);
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
