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
import { setSwrScope } from "@/lib/swr";
import { createQueue, drainQueue, isNetworkError, type OfflineQueue } from "@/lib/offline-queue";

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
  /** v1.0.38: visit ids saved on this device and still waiting to reach the server (offline queue, in order). */
  queued: string[];
}

const EMPTY: Snap = { ready: false, loading: false, error: null, mode: "guest", shopId: null, chairId: null, shop: null, values: {}, bookings: [], queued: [] };
let snap: Snap = EMPTY;
let mode: Mode | null = null;
let uid: string | null = null;
let started = false;
let pending = 0;
/** Bumped on every local write; a poll that started before a write is stale and is dropped. */
let writeEpoch = 0;
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
  // Never hang a screen on a stuck request: give up after 15 s (the screen shows its error / retry state).
  const res = await fetch(path, { ...init, headers, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(15_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { status: res.status, body });
  return body;
}

/**
 * Last good owner snapshot, per uid, on this device (fast launch). Rendered at once on the next open and
 * replaced by the server's copy a moment later. Cleared on sign-out or when another account signs in.
 */
const cacheKey = (id: string) => `bp.cloud.${id}`;
type Cached = Pick<Snap, "shopId" | "chairId" | "shop" | "values" | "bookings">;
function readCache(id: string): Cached | null {
  try { const raw = localStorage.getItem(cacheKey(id)); return raw ? (JSON.parse(raw) as Cached) : null; } catch { return null; }
}
function writeCache(id: string, c: Cached) {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(c)); } catch { /* full or blocked: just no fast launch */ }
}
function dropCaches(keep?: string) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("bp.cloud.") && k !== (keep ? cacheKey(keep) : "")) localStorage.removeItem(k);
  } catch { /* blocked */ }
}

const barberCacheKey = (token: string) => `bp.barber.${token}`;
function readBarberCache(token: string): Cached | null {
  try { const raw = localStorage.getItem(barberCacheKey(token)); return raw ? (JSON.parse(raw) as Cached) : null; } catch { return null; }
}
function writeBarberCache(token: string, c: Cached) {
  try { localStorage.setItem(barberCacheKey(token), JSON.stringify(c)); } catch { /* full or blocked */ }
}

/* ---- v1.0.38 offline queue (visit saves only) ---- */
let queue: OfflineQueue<ChairRequest> | null = null;
let draining: Promise<void> | null = null;
let queueTimer: number | undefined;
let queueWired = false;
const browserStore = () => { try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; } };
const queueKey = () => (mode?.kind === "barber" ? `bp.offline.b.${mode.token}` : mode?.kind === "owner" && uid ? `bp.offline.o.${uid}` : null);
function openQueue() {
  const key = queueKey();
  if (!key) { queue = null; return; }
  if (queue?.key !== key) queue = createQueue<ChairRequest>(browserStore(), key);
  wireQueue();
}
function publishQueue() { set({ queued: queue?.ids() ?? [] }); }
/** Server rows with this phone's waiting saves on top (they are newer), so a reload never hides them. */
function withQueued(rows: ChairRequest[]) {
  const q = queue?.list() ?? [];
  if (!q.length) return rows;
  const mine = new Map(q.map((x) => [x.id, x.row]));
  return [...q.map((x) => x.row).filter((r) => !rows.some((b) => b.id === r.id)), ...rows.map((b) => mine.get(b.id) ?? b)].sort((a, b) => b.createdAt - a.createdAt);
}
const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;
function enqueue(row: ChairRequest) {
  if (!queue) openQueue();
  if (!queue) return;
  queue.put(row);
  publishQueue();
}
/** Sends waiting saves in order (on "online", on focus, and every 20 s). One run at a time. */
export function syncOfflineQueue(): Promise<void> {
  if (!queue || !queue.size() || offline()) return Promise.resolve();
  if (draining) return draining;
  pending++;
  draining = drainQueue(queue, (row) => api(`${base()}/bookings/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ booking: row }) }), {
    onSent: (row, res) => {
      const saved = (res as { booking?: ChairRequest })?.booking;
      if (saved && !queue?.has(row.id)) set({ bookings: snap.bookings.map((b) => (b.id === row.id ? saved : b)) });
    },
    onRefused: (row, e) => refused(row, e as Error & { status?: number }),
  }).then(() => undefined, () => undefined).finally(() => { draining = null; pending--; writeEpoch++; publishQueue(); });
  publishQueue();
  return draining;
}
function wireQueue() {
  if (queueWired || typeof window === "undefined") return;
  queueWired = true;
  const kick = () => { void syncOfflineQueue(); };
  window.addEventListener("online", kick);
  window.addEventListener("focus", kick);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") kick(); });
  queueTimer = window.setInterval(kick, 20_000);
  void queueTimer;
}

function base() {
  return mode?.kind === "barber" ? `/api/barber/${mode.token}` : "/api/shop";
}

async function load(quiet = false) {
  if (!mode) return;
  if (!quiet) set({ loading: true, error: null });
  try {
    const epoch = writeEpoch;
    const d = await api(base());
    // Don't clobber unsaved local edits, or anything written while this request was in flight.
    if ((pending > 0 || epoch !== writeEpoch) && quiet) return;
    const data: Cached = { shopId: d.shopId, chairId: d.chairId ?? null, shop: d.shop, values: d.values ?? {}, bookings: d.bookings ?? [] };
    set({ ready: true, loading: false, error: null, mode: mode.kind, ...data, bookings: withQueued(data.bookings) });
    if (mode.kind === "owner" && uid) writeCache(uid, data);
    if (mode.kind === "barber") writeBarberCache(mode.token, data);
  } catch (e) {
    // v1.0.38: offline on a barber link: open the last copy saved on this phone (plus visits waiting to sync).
    const cached = mode.kind === "barber" && isNetworkError(e) && !snap.shopId ? readBarberCache(mode.token) : null;
    if (cached) set({ ready: true, loading: false, error: null, mode: "barber", ...cached, bookings: withQueued(cached.bookings) });
    else if (snap.shopId && isNetworkError(e)) set({ ready: true, loading: false });
    else set({ ready: true, loading: false, error: (e as Error).message });
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
    // Still finishing a Google redirect: stay "not ready" so screens show skeletons, not the guest view.
    if (!s.ready || s.signingIn) return;
    const next = s.user?.uid ?? null;
    if (next === uid && snap.ready) return;
    uid = next;
    setSwrScope(next);
    if (!next) { mode = null; window.clearInterval(pollTimer); dropCaches(); set({ ...EMPTY, ready: true }); return; }
    mode = { kind: "owner" };
    openQueue();
    dropCaches(next);
    const cached = readCache(next);
    if (cached) {
      // Fast launch: show the last saved copy now, refresh from the server in the background.
      set({ ...EMPTY, ...cached, bookings: withQueued(cached.bookings), queued: queue?.ids() ?? [], ready: true, loading: false, mode: "owner" });
      void syncOfflineQueue();
      void load(true).then(poll);
      return;
    }
    // New owner (e.g. just signed in): drop the guest snapshot so nothing empty flashes before their data loads.
    set({ ...EMPTY, ready: false, loading: true });
    void load().then(poll);
  };
  subscribeSession(sync);
  sync();
}

/** Opens the store for a barber's chair link. */
export function startBarberCloud(token: string) {
  mode = { kind: "barber", token };
  started = true;
  openQueue();
  publishQueue();
  void syncOfflineQueue();
  void load().then(poll);
}

export function refreshCloud() { return load(true); }

async function track<T>(p: Promise<T>) {
  pending++;
  writeEpoch++;
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
    writeEpoch++;
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

/** One save in flight per booking; edits made meanwhile are coalesced and sent after it, in order. */
const inflight = new Map<string, { next: ChairRequest | null }>();

function sendBooking(row: ChairRequest) {
  const slot = { next: null as ChairRequest | null };
  inflight.set(row.id, slot);
  void track(api(`${base()}/bookings/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ booking: row }) }))
    .then((res: { booking?: ChairRequest }) => {
      // The server's copy wins (price filled in, out-of-order write refused, barber stamped).
      if (!slot.next && res?.booking) set({ bookings: snap.bookings.map((b) => (b.id === row.id ? res.booking! : b)) });
    })
    .catch((e: Error & { status?: number }) => {
      // v1.0.38: no network: keep it on this phone (latest copy) and send it later, in order.
      if (isNetworkError(e)) { enqueue(slot.next ?? row); slot.next = null; set({ error: null }); return; }
      refused(row, e);
      if (e.status === 402 || e.status === 404) slot.next = null;
    })
    .finally(() => {
      inflight.delete(row.id);
      if (slot.next) { if (queue?.has(row.id) || offline()) { enqueue(slot.next); void syncOfflineQueue(); } else sendBooking(slot.next); }
    });
}

/** The server refused a save (not a network problem): undo it here and tell the screen. */
function refused(row: ChairRequest, e: Error & { status?: number }) {
      // Over the Partner walk-in limit: take the optimistic row back out and tell the screen.
      if (e.status === 402) {
        set({ bookings: snap.bookings.filter((b) => b.id !== row.id) });
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("barbers-walkin-limit", { detail: e.message }));
      }
      // Barber link: the server only lets a barber work their own visits. If another barber took this one first,
      // drop it here and let the screen say so; the next poll shows the server's view.
      if (e.status === 404 && mode?.kind === "barber") {
        set({ bookings: snap.bookings.filter((b) => b.id !== row.id) });
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("barbers-booking-gone", { detail: "Another barber already has this customer." }));
      }
}

export function saveBooking(row: ChairRequest) {
  if (!mode) return;
  const rest = snap.bookings.filter((b) => b.id !== row.id);
  writeEpoch++;
  set({ bookings: [row, ...rest].sort((a, b) => b.createdAt - a.createdAt) });
  const busy = inflight.get(row.id);
  if (busy) { busy.next = row; return; }
  // v1.0.38: offline, or older saves still waiting: queue it behind them so the server gets them in order.
  if (!queue) openQueue();
  if (offline() || (queue?.size() ?? 0) > 0) { enqueue(row); void syncOfflineQueue(); return; }
  sendBooking(row);
}

/** Barber link: the barber sets their own name. */
export async function saveBarberName(name: string) {
  if (mode?.kind !== "barber") return;
  await track(api(`${base()}/name`, { method: "PUT", body: JSON.stringify({ name }) }));
  await load(true);
}

/** Barber link (v1.0.27): the barber saves their own name, photo, mobile and email. */
export async function saveBarberSelf(patch: { barberName?: string; photoUrl?: string; phone?: string; email?: string }) {
  if (mode?.kind !== "barber") return;
  await track(api(`${base()}/profile`, { method: "PATCH", body: JSON.stringify(patch) }));
  await load(true);
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
