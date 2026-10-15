"use client";
/** Tiny shared cache: one in-flight request per key, last value kept so revisiting a screen renders instantly. */
const store = new Map<string, { at: number; value?: unknown; inflight?: Promise<unknown> }>();

export function cached<T>(key: string): T | undefined { return store.get(key)?.value as T | undefined; }

export function fetchShared<T>(key: string, fn: () => Promise<T>, maxAgeMs = 0): Promise<T> {
  const e = store.get(key);
  if (e?.inflight) return e.inflight as Promise<T>;
  if (e && e.value !== undefined && Date.now() - e.at < maxAgeMs) return Promise.resolve(e.value as T);
  const p = fn().then((v) => { store.set(key, { at: Date.now(), value: v }); return v; }, (err) => { const c = store.get(key); if (c) delete c.inflight; throw err; });
  store.set(key, { at: e?.at ?? 0, value: e?.value, inflight: p });
  return p;
}

export function invalidate(prefix: string) { for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k); }
