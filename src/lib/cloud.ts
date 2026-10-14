"use client";
/**
 * The shop's live data, loaded from the server (Firestore via /api/shop) and kept in memory.
 * Stores read and write through `cloudStorage`, which has the same shape as localStorage,
 * so screens stay synchronous while every change is saved to the server in the background.
 * Guests have an empty store: nothing is saved until they sign in.
 */
import { useSyncExternalStore } from "react";
import type { ChairRequest } from "@/lib/booking-types";
import { hydrateSession, idToken, sessionSnapshot, subscribeSession } from "@/lib/session";

export interface CloudShop {
  id: string;
  name: string;
  address: string;
  area: string;
  phone: string;
  location: { lat: number; lng: number; formattedAddress: string } | null;
  photoUrls: string[];
  logoUrl: string | null;
  plan: import("@/lib/plans").PlanId;
  planStatus?: string;
  planRenewsAt?: number | null;
  services: { id: string; name: string; durationMins: number; price: number; kind: string }[];
}

type Mode = { kind: "owner" } | { kind: "barber"; token: string };

interface Snap {
  ready: boolean;
  loading: boolean;
  error: string | null;
  mode: Mode["kind"] | "guest";
  shopId: string | null;
  chairId: string | null;
  shop: CloudShop | null;
  values: Record<string, string>;
  bookings: ChairRequest[];
}

const EMPTY: Snap = { ready: false, loading: false, error: null, mode: "guest", shopId: null, chairId: null, shop: null, values: {}, bookings: [] };
let snap: Snap = EMPTY;
let mode: Mode | null = null;
let uid: string | null = null;
let started = false;
let pending = 0;
let pollTimer: number | undefined;
const listeners = new Set<() => void>();
/** Events the older stores listen for. */
const EVENTS = ["barbers-chairs", "barbers-bookings", "barbers-locations", "barbers-services", "barbers-profile"];

function set(next: Partial<Snap>) {
  snap = { ...snap, ...next };
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") EVENTS.forEach((e) => window.dispatchEvent(new Event(e)));
}

export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body && typeof init.body === "string") headers.set("content-type", "application/json");
  if (mode?.kind !== "barber") {
    const t = await idToken();
    if (t) headers.set("authorization", `Bearer ${t}`);
  }
  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { status: res.status, body });
  return body;
}

function base() {
  return mode?.kind === "barber" ? `/api/barber/${mode.token}` : "/api/shop";
}

async function load(quiet = false) {
  if (!mode) return;
  if (!quiet) set({ loading: true, error: null });
  try {
    const d = await api(base());
    if (pending > 0 && quiet) return; // don't clobber unsaved local edits
    set({ ready: true, loading: false, error: null, mode: mode.kind, shopId: d.shopId, chairId: d.chairId ?? null, shop: d.shop, values: d.values ?? {}, bookings: d.bookings ?? [] });
  } catch (e) {
    set({ ready: true, loading: false, error: (e as Error).message });
  }
}

function poll() {
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => { if (document.visibilityState === "visible") void load(true); }, 15_000);
}

/** Starts following the signed-in owner. Called by the shop shell. */
export function startCloud() {
  if (started || typeof window === "undefined") return;
  started = true;
  hydrateSession();
  const sync = () => {
    if (mode?.kind === "barber") return;
    const s = sessionSnapshot();
    if (!s.ready) return;
    const next = s.user?.uid ?? null;
    if (next === uid && snap.ready) return;
    uid = next;
    if (!next) { mode = null; window.clearInterval(pollTimer); set({ ...EMPTY, ready: true }); return; }
    mode = { kind: "owner" };
    void load().then(poll);
  };
  subscribeSession(sync);
  sync();
}

/** Opens the store for a barber's chair link. */
export function startBarberCloud(token: string) {
  mode = { kind: "barber", token };
  started = true;
  void load().then(poll);
}

export function refreshCloud() { return load(true); }

async function track<T>(p: Promise<T>) {
  pending++;
  try { return await p; } catch (e) { set({ error: (e as Error).message }); throw e; } finally { pending--; }
}

const timers = new Map<string, number>();

/** localStorage-shaped access to the shop's saved state. */
export const cloudStorage = {
  getItem(key: string): string | null {
    return snap.values[key] ?? null;
  },
  setItem(key: string, value: string) {
    if (!mode) return;
    set({ values: { ...snap.values, [key]: value } });
    // One pending count per key: a re-edit inside the debounce window must not leak a count,
    // or polling stops forever and new online bookings never show up until a reload.
    const prev = timers.get(key);
    if (prev !== undefined) window.clearTimeout(prev);
    else pending++;
    timers.set(key, window.setTimeout(() => {
      timers.delete(key);
      pending--;
      void track(api(`${base()}/state/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ value: snap.values[key] }) })).then(() => {
        if (key === "barbers.shop-profile" || key === "barbers.shop-menu") void load(true);
      }).catch(() => undefined);
    }, 400));
  },
  removeItem(key: string) { this.setItem(key, "null"); },
};

export function cloudBookings(): ChairRequest[] { return snap.bookings; }

export function saveBooking(row: ChairRequest) {
  if (!mode) return;
  const rest = snap.bookings.filter((b) => b.id !== row.id);
  set({ bookings: [row, ...rest].sort((a, b) => b.createdAt - a.createdAt) });
  void track(api(`${base()}/bookings/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ booking: row }) })).catch((e: Error & { status?: number }) => {
    // Over the Partner walk-in limit: take the optimistic row back out and tell the screen.
    if (e.status === 402) {
      set({ bookings: snap.bookings.filter((b) => b.id !== row.id) });
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("barbers-walkin-limit", { detail: e.message }));
    }
  });
}

export function removeBooking(id: string) {
  if (!mode) return;
  set({ bookings: snap.bookings.filter((b) => b.id !== id) });
  if (mode.kind === "owner") void track(api(`/api/shop/bookings/${encodeURIComponent(id)}`, { method: "DELETE" })).catch(() => undefined);
}

function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

export function useCloud() {
  return useSyncExternalStore(subscribe, () => snap, () => EMPTY);
}

export function cloudSnapshot() { return snap; }
