"use client";
import { cloudStorage } from "@/lib/cloud";

import { useEffect, useState } from "react";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";

/** A seat the shop created. Times are unix milliseconds. */
export interface ShopChair {
  id: string;
  number: number;
  label: string;
  barberId: string;
  /** Name the shop typed for the barber on this seat. */
  barberName?: string;
  /** Portrait of that barber, stored as a compressed data URL. */
  photoUrl?: string;
  /** Optional contact for alerts (new online bookings). */
  phone?: string;
  email?: string;
  /** false = barber is off (not offered for new walk-ins/bookings). Missing = active. */
  active?: boolean;
  /** Set while someone is in the seat. */
  occupiedAt?: number;
  ticketId?: string;
  /** When the current or last sit started. Kept after the seat is vacant. */
  lastUsedAt?: number;
  /** When the seat last became vacant. */
  vacantAt?: number;
  /** Private code in the link the owner sends this barber. */
  linkToken?: string;
  /**
   * When the owner is next asked "Keep this link active?" (every 6 months). A nudge only:
   * barber links never expire. Confirm moves it 6 months on; ignoring it changes nothing.
   */
  linkReviewAt?: number;
  /** Legacy (monthly expiry, before Oct 2026). Read once as the review date, never written again. */
  linkExpiresAt?: number;
  /** Shop this chair belongs to. Missing means the first shop. */
  locationId?: string;
}

/** Barbers are named on their chair; there is no separate barber list. */
export const shopBarbers: { id: string; name: string }[] = [];

const KEY = "barbers.shop-chairs";
const EVENT = "barbers-chairs";

export function barberName(id: string) {
  return shopBarbers.find((b) => b.id === id)?.name ?? "No barber";
}

/** The name shown for a chair: the one the shop typed, otherwise the saved barber. */
export function chairBarberName(chair: Pick<ShopChair, "barberId" | "barberName">) {
  const typed = chair.barberName?.trim();
  if (typed) return typed;
  return barberName(chair.barberId);
}

function readChairs(): ShopChair[] {
  try {
    const raw = cloudStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShopChair[];
    if (!Array.isArray(parsed)) return [];
    const list = parsed
      .filter((c) => c && c.id && c.label && (c.barberName?.trim() || c.barberId))
      // Old saved occupancy is ignored (see occupyChair); seats show as used from their booking.
      .map(({ occupiedAt: _o, ticketId: _t, ...c }) => c as ShopChair)
      // Old monthly expiry becomes the review date (in memory; saved on the next owner save). No link breaks.
      .map(({ linkExpiresAt, ...c }) => (c.linkToken && !c.linkReviewAt && linkExpiresAt ? { ...c, linkReviewAt: linkExpiresAt } : c) as ShopChair)
      .sort((a, b) => a.number - b.number);
    return list;
  } catch {
    return [];
  }
}

function writeChairs(next: ShopChair[]) {
  cloudStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

export function loadChairs() {
  return readChairs();
}

export function seatTime(ms?: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}

export function chairLocation(chair: Pick<ShopChair, "locationId">) {
  return chair.locationId || HOME_LOCATION_ID;
}

export function nextChairNumber(locationId = HOME_LOCATION_ID) {
  const list = readChairs().filter((c) => chairLocation(c) === locationId);
  return list.reduce((max, c) => Math.max(max, c.number), 0) + 1;
}

function newLinkToken() {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  let token = "";
  for (let i = 0; i < 12; i++) token += alphabet[Math.floor(Math.random() * alphabet.length)];
  return token;
}

export function chairLinkPath(token: string) {
  return `/b/${token}`;
}

/** How often the owner is asked to confirm each barber link. */
export const LINK_REVIEW_MONTHS = 6;

/** The next review date, LINK_REVIEW_MONTHS after `at`. */
export function reviewFrom(at: number) {
  const next = new Date(at);
  next.setMonth(next.getMonth() + LINK_REVIEW_MONTHS);
  return next.getTime();
}

/** True when the owner should be asked "Keep this link active?". The link works either way. */
export function linkReviewDue(chair: Pick<ShopChair, "linkToken" | "linkReviewAt" | "active">, now = Date.now()) {
  return Boolean(chair.linkToken && chair.active !== false && chair.linkReviewAt && chair.linkReviewAt <= now);
}

/** Returns this chair’s barber link. The token never expires; a new one is made only on first share or Reset. */
export function ensureChairLink(id: string): string {
  const cur = readChairs();
  const chair = cur.find((c) => c.id === id);
  if (!chair) return "";
  if (chair.linkToken) {
    if (!chair.linkReviewAt) writeChairs(cur.map((c) => c.id === id ? { ...c, linkReviewAt: reviewFrom(Date.now()) } : c));
    return chairLinkPath(chair.linkToken);
  }
  const linkToken = newLinkToken();
  writeChairs(cur.map((c) => c.id === id ? { ...c, linkToken, linkReviewAt: reviewFrom(Date.now()) } : c));
  return chairLinkPath(linkToken);
}

/** Owner confirms the link should stay active: next review in 6 months. Nothing else changes. */
export function confirmChairLink(id: string) {
  const cur = readChairs();
  if (!cur.some((c) => c.id === id)) return;
  writeChairs(cur.map((c) => c.id === id ? { ...c, linkReviewAt: reviewFrom(Date.now()) } : c));
}

/** Owner replaces the link: the old one stops working at once, the barber needs the new one. */
export function resetChairLink(id: string): string {
  const cur = readChairs();
  if (!cur.some((c) => c.id === id)) return "";
  const linkToken = newLinkToken();
  writeChairs(cur.map((c) => c.id === id ? { ...c, linkToken, linkReviewAt: reviewFrom(Date.now()) } : c));
  return chairLinkPath(linkToken);
}

/** Saves a created chair. A barber can sit on one chair. */
export function saveChair(chair: ShopChair): string {
  const name = chair.barberName?.trim() ?? "";
  if (!name) return "Enter the barber’s name.";
  const cur = readChairs();
  const prev = cur.find((c) => c.id === chair.id);
  const locationId = chair.locationId || prev?.locationId || HOME_LOCATION_ID;
  const taken = cur.find((c) => c.id !== chair.id && chairLocation(c) === locationId && chairBarberName(c).toLowerCase() === name.toLowerCase());
  if (taken) return `${name} is already on ${taken.label}.`;
  const linkToken = chair.linkToken || prev?.linkToken || newLinkToken();
  const linkReviewAt = linkToken === prev?.linkToken && prev?.linkReviewAt ? prev.linkReviewAt : reviewFrom(Date.now());
  const saved: ShopChair = {
    ...chair,
    barberName: name,
    // Barbers are the unit now: the seat label follows the barber's name (id + link token unchanged).
    label: name,
    barberId: chair.barberId || prev?.barberId || `b-${chair.id}`,
    photoUrl: chair.photoUrl || undefined,
    phone: chair.phone?.trim() || undefined,
    email: chair.email?.trim() || undefined,
    linkToken,
    linkReviewAt,
    locationId,
  };
  const exists = Boolean(prev);
  const next = exists
    ? cur.map((c) => c.id === chair.id
      ? { ...c, label: saved.label, number: saved.number, barberId: saved.barberId, barberName: saved.barberName, photoUrl: saved.photoUrl, phone: saved.phone, email: saved.email, active: saved.active, linkToken: saved.linkToken, linkReviewAt: saved.linkReviewAt, locationId: saved.locationId }
      : c)
    : [...cur, saved];
  try {
    writeChairs(next.sort((a, b) => a.number - b.number));
  } catch {
    return "That photo is too large. Try a smaller one.";
  }
  return "";
}

export function removeChair(id: string): string {
  const cur = readChairs();
  const chair = cur.find((c) => c.id === id);
  if (!chair) return "";
  if (chair.occupiedAt) return `${chair.label} is in use. Finish that cut before removing it.`;
  writeChairs(cur.filter((c) => c.id !== id));
  return "";
}

/*
 * Who is in a chair comes from the bookings (status "in_chair" + chairLabel), never from the chairs list.
 * The chairs list is one shared document: writing occupancy into it from several phones (owner and each
 * chair link) raced and left chairs stuck "in use" or wiped another barber's seat and link.
 */

/** Sit someone in a chosen seat. Returns false when that seat doesn't exist at this shop. */
export function occupyChair(label: string, _ticketId: string, _at = Date.now(), locationId = HOME_LOCATION_ID): boolean {
  return readChairs().some((c) => c.label === label && chairLocation(c) === locationId);
}

/** The first free seat. Returns the chair label, or null when every created seat is taken. */
export function occupyNextChair(_ticketId: string, taken: Set<string>, _at = Date.now(), locationId = HOME_LOCATION_ID): string | null {
  return readChairs().find((c) => chairLocation(c) === locationId && c.active !== false && !taken.has(c.label))?.label ?? null;
}

/** Kept for callers; the seat frees itself when its booking is done. */
export function vacateChair(_label: string, _at = Date.now(), _locationId = HOME_LOCATION_ID) {}

/** The chair (and so the barber) for a seat label at a shop. */
export function chairByLabel(label: string | undefined, locationId = HOME_LOCATION_ID) {
  return label ? readChairs().find((c) => c.label === label && chairLocation(c) === locationId) : undefined;
}

/** Drops every free chair at one shop. Occupied chairs are left in place. */
export function removeChairsAt(locationId: string) {
  writeChairs(readChairs().filter((c) => chairLocation(c) !== locationId || c.occupiedAt));
}

export function useShopChairs(options?: { all?: boolean; locationId?: string }) {
  const loc = useShopLocations();
  const [chairs, setChairs] = useState<ShopChair[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const pull = () => setChairs(readChairs());
    pull();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial sync from the shared client store; later updates arrive via the subscribed events
    setReady(true);
    window.addEventListener(EVENT, pull);
    window.addEventListener("storage", pull);
    return () => {
      window.removeEventListener(EVENT, pull);
      window.removeEventListener("storage", pull);
    };
  }, []);
  const locationId = options?.locationId ?? loc.scopeId ?? undefined;
  const filtered = options?.all || locationId == null
    ? chairs
    : chairs.filter((c) => chairLocation(c) === locationId);
  const settled = options?.all ? ready : ready && loc.ready;
  return { chairs: settled ? filtered : [], ready: settled };
}
