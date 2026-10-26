import "server-only";
import type { ChairRequest } from "@/lib/booking-types";
import { peso } from "@/lib/format";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Server-written audit log + owner notifications. Never trusts the client: entries are derived on the server
 * from the stored before/after of each write.
 *   shops/{shopId}/activity/{id}       { at, type, text, actor: { name, role }, locationId?, amount?, ref? }
 *   shops/{shopId}/notifications/{id}  same + read
 */
export type Role = "owner" | "barber" | "customer" | "system";
export interface Actor { name: string; role: Role }
export interface ActivityEntry { id?: string; at: number; type: string; text: string; actor: Actor; locationId?: string; amount?: number; ref?: string }

const shop = (id: string) => adminDb().collection("shops").doc(id);
export const OWNER: Actor = { name: "Owner", role: "owner" };
export const SYSTEM: Actor = { name: "Barbers.ph", role: "system" };

/** Writes one entry (and a notification when `notify`). Never throws: logging must not break the action. */
export async function logActivity(shopId: string, e: Omit<ActivityEntry, "at"> & { at?: number }, notify = false) {
  try {
    const entry = Object.fromEntries(Object.entries({ ...e, at: e.at ?? Date.now() }).filter(([, v]) => v !== undefined)) as unknown as ActivityEntry;
    const s = shop(shopId);
    const batch = adminDb().batch();
    const ref = s.collection("activity").doc();
    batch.set(ref, { ...entry, id: ref.id });
    if (notify) { const n = s.collection("notifications").doc(); batch.set(n, { ...entry, id: n.id, read: false }); }
    await batch.commit();
  } catch (err) { console.error("activity log failed", err); }
}

const who = (b: Partial<ChairRequest>) => b.customerLabel || b.contact || "a customer";
const pay = (b: Partial<ChairRequest>) => (!b.paid ? "not paid" : b.payMethod === "gcash" ? "GCash" : b.payMethod === "online" ? "paid online" : "cash");

/** Derives entries from a booking write (prev → next). */
export async function bookingActivity(shopId: string, prev: ChairRequest | undefined, next: ChairRequest, actor: Actor) {
  const base = { actor, locationId: next.locationId || "home", ref: next.ref };
  const svc = next.serviceName || "a cut";
  const by = actor.role === "barber" ? actor.name : next.barberName || actor.name;
  if (!prev && next.source === "manual") {
    const day = new Date(next.completedAt ?? next.createdAt).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    await logActivity(shopId, { ...base, type: "walkin_added", amount: next.price, text: `${actor.name} manually added a record for ${next.barberName || "a barber"} on ${day} · ${svc} · ${peso(next.price || 0)} ${pay(next)}` });
    return;
  }
  if (!prev) {
    if (next.channel === "walk-in") await logActivity(shopId, { ...base, type: "walkin_added", text: `${actor.name} added walk-in ${who(next)} · ${svc}` });
    else await logActivity(shopId, { ...base, type: "booking_added", text: `${actor.name} added booking ${next.ref} for ${who(next)}` });
  }
  if (prev?.status !== next.status) {
    if (next.status === "accepted") await logActivity(shopId, { ...base, type: "booking_accepted", text: `${actor.name} accepted ${who(next)}'s booking ${next.ref}` });
    if (next.status === "declined") await logActivity(shopId, { ...base, type: "booking_declined", text: `${actor.name} declined ${who(next)}'s booking ${next.ref}` });
    if (next.status === "in_chair") await logActivity(shopId, { ...base, type: "cut_started", text: `${by} started ${svc} for ${who(next)}` });
    if (next.status === "done") await logActivity(shopId, { ...base, type: "cut_completed", amount: next.price, text: `${by} completed ${svc} for ${who(next)} · ${peso(next.price || 0)} ${pay(next)}` }, actor.role === "barber");
    return;
  }
  if (prev && prev.status === "done" && ((prev.price || 0) !== (next.price || 0) || Boolean(prev.paid) !== Boolean(next.paid) || (prev.payMethod ?? "") !== (next.payMethod ?? ""))) {
    await logActivity(shopId, { ...base, type: "payment_changed", amount: next.price, text: `${actor.name} changed payment for ${next.ref}: ${peso(prev.price || 0)} ${pay(prev)} → ${peso(next.price || 0)} ${pay(next)}` });
  }
}

type Chair = { id: string; label?: string; barberName?: string; active?: boolean; locationId?: string };
type Item = { id?: string; name?: string; price?: number };
const parse = <T,>(raw: string | undefined, d: T): T => { try { return raw ? (JSON.parse(raw) as T) : d; } catch { return d; } };

/** Derives entries from an app-state write (chairs, menu, locations, profile). */
export async function stateActivity(shopId: string, docId: string, prevRaw: string | undefined, nextRaw: string, actor: Actor) {
  if (prevRaw === nextRaw) return;
  const out: Omit<ActivityEntry, "at">[] = [];
  if (docId === "chairs") {
    const a = parse<Chair[]>(prevRaw, []), b = parse<Chair[]>(nextRaw, []);
    const name = (c: Chair) => c.barberName?.trim() || c.label || "a barber";
    for (const c of b) {
      const p = a.find((x) => x.id === c.id);
      if (!p) out.push({ actor, type: "barber_added", locationId: c.locationId || "home", text: `${actor.name} added barber ${name(c)}` });
      else {
        if ((p.active !== false) !== (c.active !== false)) out.push({ actor, type: c.active === false ? "barber_deactivated" : "barber_activated", locationId: c.locationId || "home", text: `${actor.name} ${c.active === false ? "deactivated" : "activated"} ${name(c)}` });
        if (name(p) !== name(c)) out.push({ actor, type: "barber_edited", locationId: c.locationId || "home", text: `${actor.name} renamed ${name(p)} to ${name(c)}` });
      }
    }
    for (const p of a) if (!b.some((x) => x.id === p.id)) out.push({ actor, type: "barber_removed", locationId: p.locationId || "home", text: `${actor.name} removed barber ${name(p)}` });
  } else if (docId === "menu") {
    const a = parse<{ haircut?: Item; treatments?: Item[] }>(prevRaw, {}), b = parse<{ haircut?: Item; treatments?: Item[] }>(nextRaw, {});
    const list = (m: typeof a) => [{ ...(m.haircut ?? {}), id: "haircut" }, ...(m.treatments ?? [])];
    const A = list(a), B = list(b);
    for (const s of B) {
      const p = A.find((x) => x.id === s.id);
      if (!p) out.push({ actor, type: "service_added", text: `${actor.name} added service ${s.name} · ${peso(Math.round((s.price ?? 0) * 100))}` });
      else if (p.name !== s.name || (p.price ?? 0) !== (s.price ?? 0)) out.push({ actor, type: "service_edited", text: `${actor.name} updated ${s.name}: ${p.name !== s.name ? `renamed from ${p.name}, ` : ""}${peso(Math.round((p.price ?? 0) * 100))} → ${peso(Math.round((s.price ?? 0) * 100))}` });
    }
    for (const p of A) if (!B.some((x) => x.id === p.id)) out.push({ actor, type: "service_removed", text: `${actor.name} removed service ${p.name}` });
  } else if (docId === "locations") {
    const a = parse<{ enabled?: boolean; branches?: { id: string; name: string; address?: string }[] }>(prevRaw, {}), b = parse<typeof a>(nextRaw, {});
    if (Boolean(a.enabled) !== Boolean(b.enabled)) out.push({ actor, type: "location_edited", text: `${actor.name} turned multiple shops ${b.enabled ? "on" : "off"}` });
    for (const l of b.branches ?? []) {
      const p = (a.branches ?? []).find((x) => x.id === l.id);
      if (!p) out.push({ actor, type: "location_added", locationId: l.id, text: `${actor.name} added location ${l.name}` });
      else if (JSON.stringify(p) !== JSON.stringify(l)) out.push({ actor, type: "location_edited", locationId: l.id, text: `${actor.name} edited location ${l.name}` });
    }
    for (const p of a.branches ?? []) if (!(b.branches ?? []).some((x) => x.id === p.id)) out.push({ actor, type: "location_removed", locationId: p.id, text: `${actor.name} removed location ${p.name}` });
  } else if (docId === "profile") {
    const a = parse<Record<string, unknown>>(prevRaw, {}), b = parse<Record<string, unknown>>(nextRaw, {});
    const changed = ["name", "address", "phone", "about", "logoUrl", "hours", "photoUrls", "location"].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    if (changed.length) out.push({ actor, type: "shop_edited", text: `${actor.name} updated the shop profile (${changed.map((k) => (k === "logoUrl" ? "logo" : k === "photoUrls" ? "photos" : k === "location" ? "map pin" : k)).join(", ")})` });
  }
  for (const e of out.slice(0, 20)) await logActivity(shopId, e);
}

/** Owner: newest-first activity with in-memory filters (no composite indexes). Cursor = `at` of the last row. */
export async function listActivity(shopId: string, q: { before?: number; loc?: string; role?: string; actor?: string; type?: string; limit?: number }) {
  const want = Math.min(50, q.limit ?? 30);
  const out: ActivityEntry[] = [];
  let cursor = q.before ?? Date.now() + 1;
  for (let page = 0; page < 6 && out.length < want; page++) {
    const snap = await shop(shopId).collection("activity").where("at", "<", cursor).orderBy("at", "desc").limit(200).get();
    if (snap.empty) { cursor = 0; break; }
    for (const d of snap.docs) {
      const e = d.data() as ActivityEntry;
      cursor = e.at;
      if (q.loc && q.loc !== "all" && (e.locationId || "home") !== q.loc) continue;
      if (q.role && q.role !== "all" && e.actor?.role !== q.role) continue;
      if (q.actor && e.actor?.name !== q.actor) continue;
      if (q.type && q.type !== "all" && !e.type.startsWith(q.type)) continue;
      out.push(e);
      if (out.length >= want) break;
    }
    if (snap.size < 200) { if (out.length < want) cursor = 0; break; }
  }
  return { items: out, next: cursor && out.length >= want ? out[out.length - 1]!.at : null };
}

/** Owner notifications (newest 50) + unread count. Adds a daily unclaimed-remit reminder when cash is waiting. */
export async function listNotifications(shopId: string, remit?: { total: number; barbers: number; oldest: number }) {
  const col = shop(shopId).collection("notifications");
  if (remit && remit.total > 0 && Date.now() - remit.oldest > 12 * 3600_000) {
    const id = `remit-${new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)}`;
    const ref = col.doc(id);
    if (!(await ref.get()).exists) {
      await ref.set({ id, at: Date.now(), type: "remit_reminder", actor: SYSTEM, read: false, amount: remit.total,
        text: `${peso(remit.total)} cash from ${remit.barbers} barber${remit.barbers === 1 ? "" : "s"} is still unclaimed` });
    }
  }
  const [snap, cnt] = await Promise.all([col.orderBy("at", "desc").limit(50).get(), col.where("read", "==", false).count().get()]);
  const items = snap.docs.map((d) => d.data() as ActivityEntry & { read: boolean });
  const unread = cnt.data().count;
  return { items, unread };
}

export async function markNotificationsRead(shopId: string, ids?: string[]) {
  const col = shop(shopId).collection("notifications");
  const docs = ids?.length ? ids.slice(0, 200).map((id) => col.doc(id)) : (await col.where("read", "==", false).limit(400).get()).docs.map((d) => d.ref);
  const batch = adminDb().batch();
  for (const r of docs) batch.set(r, { read: true }, { merge: true });
  await batch.commit();
}
