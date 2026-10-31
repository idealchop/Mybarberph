"use client";
/**
 * Tiny shared cache: one in-flight request per key, last value kept so revisiting a screen renders instantly.
 * v1.0.39: values are also saved on this device per signed-in owner (localStorage), so an installed app opens
 * with the last Home, profit, To Claim, sales and records at once (offline too) and refreshes in the background.
 */
type Entry = { at: number; value?: unknown; inflight?: Promise<unknown> };
const store = new Map<string, Entry>();
let scope: string | null = null;
const PREFIX = "bp.swr.";

interface Disk { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; key(i: number): string | null; readonly length: number }
let diskOverride: Disk | null | undefined;
/** Tests only: forget memory (like an app restart); the saved copies stay. */
export function _restart() { store.clear(); scope = null; }
/** Tests only: a fake storage. */
export function _setDisk(d: Disk | null) { diskOverride = d; }
const disk = (): Disk | null => { if (diskOverride !== undefined) return diskOverride; try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; } };
/** Before the session starts (first paint), the last signed-in owner on this device (same hint the session uses). */
function hintUid(): string | null {
  try { const raw = disk()?.getItem("bp.lastUser"); return raw ? ((JSON.parse(raw) as { uid?: string }).uid ?? null) : null; } catch { return null; }
}
const diskKey = (key: string) => { const id = scope ?? hintUid(); return id ? `${PREFIX}${id}.${key}` : null; };

function readDisk(key: string): Entry | undefined {
  const k = diskKey(key); if (!k) return undefined;
  try { const raw = disk()?.getItem(k); if (!raw) return undefined; const v = JSON.parse(raw) as { at: number; value: unknown }; return { at: v.at, value: v.value }; } catch { return undefined; }
}
function writeDisk(key: string, e: Entry) {
  const k = diskKey(key); if (!k) return;
  try { disk()?.setItem(k, JSON.stringify({ at: e.at, value: e.value })); } catch { /* full or blocked: memory only */ }
}

/** The signed-in owner whose saved data is used (null = signed out: memory only, other owners' copies dropped). */
export function setSwrScope(id: string | null) {
  if (id === scope) return;
  const same = scope === null && id === hintUid();
  scope = id;
  if (same) return;
  store.clear();
  const d = disk(); if (!d) return;
  try {
    const drop: string[] = [];
    for (let i = 0; i < d.length; i++) { const k = d.key(i); if (k?.startsWith(PREFIX) && (!id || !k.startsWith(`${PREFIX}${id}.`))) drop.push(k); }
    drop.forEach((k) => d.removeItem(k));
  } catch { /* blocked */ }
}

function entry(key: string): Entry | undefined {
  const e = store.get(key);
  if (e && e.value !== undefined) return e;
  const d = readDisk(key);
  if (d) { store.set(key, { ...d, ...(e?.inflight ? { inflight: e.inflight } : {}) }); return store.get(key); }
  return e;
}

export function cached<T>(key: string): T | undefined { return entry(key)?.value as T | undefined; }
/** When the cached value was loaded from the server (ms), or null. */
export function cachedAt(key: string): number | null { const e = entry(key); return e && e.value !== undefined && e.at ? e.at : null; }

export function fetchShared<T>(key: string, fn: () => Promise<T>, maxAgeMs = 0): Promise<T> {
  const e = entry(key);
  if (e?.inflight) return e.inflight as Promise<T>;
  if (e && e.value !== undefined && Date.now() - e.at < maxAgeMs) return Promise.resolve(e.value as T);
  const p = fn().then((v) => { const n = { at: Date.now(), value: v }; store.set(key, n); writeDisk(key, n); return v; }, (err) => { const c = store.get(key); if (c) delete c.inflight; throw err; });
  store.set(key, { at: e?.at ?? 0, value: e?.value, inflight: p });
  return p;
}

export function invalidate(prefix: string) {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
  const d = disk(), dk = diskKey(prefix); if (!d || !dk) return;
  try { const drop: string[] = []; for (let i = 0; i < d.length; i++) { const k = d.key(i); if (k?.startsWith(dk)) drop.push(k); } drop.forEach((k) => d.removeItem(k)); } catch { /* blocked */ }
}

/** Newest load time among the values screens have read (for the offline "as of" note), or null. */
export function newestAt(): number | null {
  let n = 0;
  for (const e of store.values()) if (e.value !== undefined && e.at > n) n = e.at;
  return n || null;
}
