/**
 * v1.0.38 offline queue for visit saves (barber link: Walk-in, start, finish, Add other service; owner: walk-ins and
 * added records). When the phone is offline, or a save fails because of the network, the visit is kept on this device
 * and sent later, in order. The visit id is made on the phone and is the server's doc id, so a retry of the same
 * visit is always the same record (never a second haircut).
 */
export interface QueueStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export interface QueuedSave<T extends { id: string } = { id: string }> {
  /** Idempotency key = the visit id (made on the phone, used as the server doc id). */
  id: string;
  row: T;
  queuedAt: number;
  tries: number;
}

const rand = () => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 10);
  return Math.random().toString(36).slice(2, 12).padEnd(10, "0");
};

/** A new visit id made on this phone: unique across phones even in the same millisecond (server allows [\w-]{3,80}). */
export function clientId(prefix: string, at: number = Date.now()) {
  return `${prefix}${at}-${rand()}`;
}

/** True when a failed save should wait in the queue (no network / timeout / server unreachable), not be dropped. */
export function isNetworkError(e: unknown) {
  const err = e as { status?: number; name?: string } | null;
  if (!err) return false;
  if (typeof err.status === "number") return err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504;
  return err.name === "TypeError" || err.name === "AbortError" || err.name === "TimeoutError" || err.name === "NetworkError";
}

export function createQueue<T extends { id: string }>(store: QueueStore | null, key: string) {
  let mem: QueuedSave<T>[] | null = null;
  const read = (): QueuedSave<T>[] => {
    if (mem) return mem;
    try { const raw = store?.getItem(key); const v = raw ? JSON.parse(raw) : []; mem = Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string" && x.row) : []; } catch { mem = []; }
    return mem!;
  };
  const write = (next: QueuedSave<T>[]) => {
    mem = next;
    try { if (next.length) store?.setItem(key, JSON.stringify(next)); else store?.removeItem(key); } catch { /* full or blocked: kept in memory */ }
  };
  return {
    key,
    list: () => read().slice(),
    size: () => read().length,
    has: (id: string) => read().some((q) => q.id === id),
    ids: () => read().map((q) => q.id),
    /** Adds a save. A newer save of the same visit replaces the older one in its place (one record, latest copy). */
    put(row: T, now: number = Date.now()) {
      const cur = read();
      const i = cur.findIndex((q) => q.id === row.id);
      if (i >= 0) { const next = cur.slice(); next[i] = { ...cur[i]!, row }; write(next); return; }
      write([...cur, { id: row.id, row, queuedAt: now, tries: 0 }]);
    },
    /** Removes a save after it reached the server; kept if the visit was changed again meanwhile. */
    done(id: string, sent: T) {
      const cur = read();
      const q = cur.find((x) => x.id === id);
      if (!q || JSON.stringify(q.row) !== JSON.stringify(sent)) return false;
      write(cur.filter((x) => x !== q));
      return true;
    },
    drop(id: string) { write(read().filter((x) => x.id !== id)); },
    bump(id: string) { write(read().map((x) => (x.id === id ? { ...x, tries: x.tries + 1 } : x))); },
  };
}
export type OfflineQueue<T extends { id: string }> = ReturnType<typeof createQueue<T>>;

/**
 * Sends the queue in order, one at a time. Stops at the first network failure (the rest wait, order kept).
 * A save the server refuses (not a network error) is dropped and reported through onRefused.
 */
export async function drainQueue<T extends { id: string }>(q: OfflineQueue<T>, send: (row: T) => Promise<unknown>, o: { onSent?: (row: T, res: unknown) => void; onRefused?: (row: T, e: unknown) => void } = {}) {
  let sent = 0;
  for (;;) {
    const head = q.list()[0];
    if (!head) return { sent, left: 0 };
    try {
      const res = await send(head.row);
      if (!q.done(head.id, head.row)) continue; // changed meanwhile: the newer copy goes next
      sent++;
      o.onSent?.(head.row, res);
    } catch (e) {
      if (isNetworkError(e)) { q.bump(head.id); return { sent, left: q.size() }; }
      q.drop(head.id);
      o.onRefused?.(head.row, e);
    }
  }
}

/** Banner line: "Offline, 1 haircut waiting to sync" / "Offline, 2 haircuts waiting to sync". */
export function offlineLabel(n: number, online: boolean) {
  const what = `${n} ${n === 1 ? "haircut" : "haircuts"}`;
  return online ? `Syncing, ${what} waiting to sync` : `Offline, ${what} waiting to sync`;
}
