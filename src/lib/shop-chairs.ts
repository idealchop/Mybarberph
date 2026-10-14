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
  /** Set while someone is in the seat. */
  occupiedAt?: number;
  ticketId?: string;
  /** When the current or last sit started. Kept after the seat is vacant. */
  lastUsedAt?: number;
  /** When the seat last became vacant. */
  vacantAt?: number;
  /** Private code in the link the owner sends this barber. */
  linkToken?: string;
  /** When that link stops working. A new link is needed each month. */
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
    let stamped = false;
    const list = parsed
      .filter((c) => c && c.id && c.label && (c.barberName?.trim() || c.barberId))
      .map((c) => {
        if (c.linkToken && !c.linkExpiresAt) {
          stamped = true;
          return { ...c, linkExpiresAt: monthFrom(Date.now()) };
        }
        return c;
      })
      .sort((a, b) => a.number - b.number);
    if (stamped) writeChairs(list);
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

/** One month after the link was sent. */
export function monthFrom(at: number) {
  const next = new Date(at);
  next.setMonth(next.getMonth() + 1);
  return next.getTime();
}

export function linkExpiryLabel(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function chairLinkExpired(chair: Pick<ShopChair, "linkExpiresAt">, now = Date.now()) {
  return Boolean(chair.linkExpiresAt && chair.linkExpiresAt <= now);
}

/** Returns this chair’s barber link. An expired link is replaced with a new month. */
export function ensureChairLink(id: string): string {
  const cur = readChairs();
  const chair = cur.find((c) => c.id === id);
  if (!chair) return "";
  if (chair.linkToken && !chairLinkExpired(chair)) {
    if (!chair.linkExpiresAt) {
      writeChairs(cur.map((c) => c.id === id ? { ...c, linkExpiresAt: monthFrom(Date.now()) } : c));
    }
    return chairLinkPath(chair.linkToken);
  }
  const linkToken = newLinkToken();
  const linkExpiresAt = monthFrom(Date.now());
  writeChairs(cur.map((c) => c.id === id ? { ...c, linkToken, linkExpiresAt } : c));
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
  const linkExpiresAt = linkToken === prev?.linkToken && prev?.linkExpiresAt ? prev.linkExpiresAt : monthFrom(Date.now());
  const saved: ShopChair = {
    ...chair,
    barberName: name,
    barberId: chair.barberId || prev?.barberId || `b-${chair.id}`,
    photoUrl: chair.photoUrl || undefined,
    linkToken,
    linkExpiresAt,
    locationId,
  };
  const exists = Boolean(prev);
  const next = exists
    ? cur.map((c) => c.id === chair.id
      ? { ...c, label: saved.label, number: saved.number, barberId: saved.barberId, barberName: saved.barberName, photoUrl: saved.photoUrl, linkToken: saved.linkToken, linkExpiresAt: saved.linkExpiresAt, locationId: saved.locationId }
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

/** Sit someone in a chosen seat. Returns false when that seat is already taken. */
export function occupyChair(label: string, ticketId: string, at = Date.now(), locationId = HOME_LOCATION_ID): boolean {
  const list = readChairs();
  const chair = list.find((c) => c.label === label && chairLocation(c) === locationId);
  if (!chair || chair.occupiedAt) return false;
  writeChairs(list.map((c) => c.id === chair.id
    ? { ...c, occupiedAt: at, lastUsedAt: at, ticketId, vacantAt: undefined }
    : c));
  return true;
}

/** Sit someone down. Returns the chair label, or null when every created seat is taken. */
export function occupyNextChair(ticketId: string, taken: Set<string>, at = Date.now(), locationId = HOME_LOCATION_ID): string | null {
  const list = readChairs();
  const free = list.find((c) => chairLocation(c) === locationId && !taken.has(c.label));
  if (!free) return null;
  writeChairs(list.map((c) => c.id === free.id
    ? { ...c, occupiedAt: at, lastUsedAt: at, ticketId, vacantAt: undefined }
    : c));
  return free.label;
}

export function vacateChair(label: string, at = Date.now(), locationId = HOME_LOCATION_ID) {
  writeChairs(readChairs().map((c) => c.label === label && chairLocation(c) === locationId
    ? { ...c, lastUsedAt: c.occupiedAt ?? c.lastUsedAt, occupiedAt: undefined, ticketId: undefined, vacantAt: at }
    : c));
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
