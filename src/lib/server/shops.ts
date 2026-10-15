import { entitledPlan } from "@/lib/entitlements";
import "server-only";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { ChairRequest } from "@/lib/booking-types";
import { allOverrides, effectiveMenu, type MenuFile } from "@/lib/menu-model";

/**
 * Firestore layout (database from FIRESTORE_DATABASE_ID):
 *   shops/{shopId}                 public profile + plan (shopId = owner's Firebase uid)
 *   shops/{shopId}/private/{key}   owner-only app state (menu, chairs, locations, …) as JSON
 *   shops/{shopId}/bookings/{id}   walk-ins and online bookings
 *   chairLinks/{token}             barber link → shop/chair (server-only)
 *   community_posts/{id}           community feed
 * The browser never talks to Firestore directly; every read/write goes through these helpers.
 */

/** App state keys the owner may store, mapped to private doc ids. */
export const STATE_KEYS: Record<string, string> = {
  "barbers.shop-profile": "profile",
  "barbers.shop-menu": "menu",
  "barbers.shop-chairs": "chairs",
  "barbers.shop-locations": "locations",
  "barbers.community.v1": "community",
};
/** Keys a barber link may write. */
export const BARBER_KEYS = new Set(["barbers.shop-chairs"]);

import { isRecurring, maxLocations, normalizePlan, walkInLimit, WALKIN_LIMIT_MESSAGE, type PlanId } from "@/lib/plans";

/** Stored plan id; older records may still hold "monthly_950" / "lifetime_10000". */
export type Plan = PlanId | "monthly_950" | "lifetime_10000";

/** The plan in force now: legacy ids mapped, lapsed monthly plans back to Partner. */
export function effectivePlan(s: Pick<ShopDoc, "plan" | "planRenewsAt">): PlanId {
  const p = normalizePlan(s.plan);
  if (isRecurring(p) && s.planRenewsAt && s.planRenewsAt < Date.now()) return "partner";
  return p;
}

export interface ShopDoc {
  ownerUid: string;
  plan: Plan;
  planStatus?: "active" | "pending" | "expired";
  planRenewsAt?: number | null;
  name: string;
  address: string;
  area: string;
  phone: string;
  about: string;
  hours: string;
  location: { lat: number; lng: number; formattedAddress: string } | null;
  photoUrls: string[];
  logoUrl: string;
  branches: { id: string; name: string; address: string; area: string; location: ShopDoc["location"] }[];
  menu: { id: string; name: string; durationMins: number; price: number; kind: "haircut" | "treatment" }[];
  /** Menus for branches other than the first shop, keyed by location id. */
  menuByLocation?: Record<string, ShopDoc["menu"]>;
  listed: boolean;
  createdAt: number;
  updatedAt: number;
}

const db = () => adminDb();
export const shopRef = (shopId: string) => db().collection("shops").doc(shopId);

export function emptyShop(uid: string): ShopDoc {
  const now = Date.now();
  return {
    ownerUid: uid, plan: "partner", planStatus: "active", planRenewsAt: null,
    name: "", address: "", area: "", phone: "", about: "", hours: "", location: null,
    photoUrls: [], logoUrl: "", branches: [], menu: [], listed: false, createdAt: now, updatedAt: now,
  };
}

/** Owner's shop; created empty on first sign-in. */
export async function ensureShop(uid: string): Promise<ShopDoc> {
  const ref = shopRef(uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as ShopDoc;
  const fresh = emptyShop(uid);
  await ref.set(fresh);
  return fresh;
}

export async function loadState(shopId: string, wanted = Object.keys(STATE_KEYS)) {
  const keys = wanted.filter((k) => STATE_KEYS[k]);
  const refs = keys.map((k) => shopRef(shopId).collection("private").doc(STATE_KEYS[k] as string));
  const snaps = refs.length ? await db().getAll(...refs) : [];
  const values: Record<string, string> = {};
  snaps.forEach((s, i) => {
    const raw = s.data()?.json;
    const k = keys[i];
    if (k && typeof raw === "string") values[k] = raw;
  });
  return values;
}

export async function loadBookings(shopId: string, limit = 300): Promise<ChairRequest[]> {
  const q = await shopRef(shopId).collection("bookings").orderBy("createdAt", "desc").limit(limit).get();
  return q.docs.map((d) => d.data() as ChairRequest);
}

function str(v: unknown, max = 500) { return typeof v === "string" ? v.slice(0, max) : ""; }
function loc(v: unknown): ShopDoc["location"] {
  const l = v as { lat?: unknown; lng?: unknown; formattedAddress?: unknown } | null;
  if (!l || typeof l.lat !== "number" || typeof l.lng !== "number" || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) return null;
  return { lat: l.lat, lng: l.lng, formattedAddress: str(l.formattedAddress) };
}
function urls(v: unknown) { return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 6) : []; }

/** Saves one state key and mirrors the public parts onto shops/{shopId}. */
export async function putState(shopId: string, key: string, raw: string) {
  const docId = STATE_KEYS[key];
  if (!docId) throw new Error("Unknown key");
  if (raw.length > 400_000) throw new Error("Too large");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const batch = db().batch();
  batch.set(shopRef(shopId).collection("private").doc(docId), { json: raw, updatedAt: Date.now() });
  const now = Date.now();
  if (docId === "profile") {
    const name = str(parsed.name, 80).trim();
    batch.set(shopRef(shopId), {
      name, address: str(parsed.address), area: str(parsed.area, 120), phone: str(parsed.phone, 30),
      about: str(parsed.about, 600), hours: str(parsed.hours, 200), location: loc(parsed.location),
      photoUrls: urls(parsed.photoUrls), logoUrl: urls([parsed.logoUrl])[0] ?? "",
      listed: Boolean(name), updatedAt: now,
    }, { merge: true });
    // The app always shows a Haircut service; publish it until the owner edits the menu.
    const cur = (await shopRef(shopId).get()).data() as ShopDoc | undefined;
    if (!cur?.menu?.length) {
      batch.set(shopRef(shopId), { menu: [{ id: "haircut", name: "Haircut", durationMins: 30, price: 0, kind: "haircut" }] }, { merge: true });
    }
  }
  if (docId === "menu") {
    const toItems = (m: Record<string, unknown>): ShopDoc["menu"] => {
      const h = (m.haircut ?? {}) as Record<string, unknown>;
      const items: ShopDoc["menu"] = [{ id: "haircut", name: str(h.name, 60) || "Haircut", durationMins: Number(h.durationMins) || 30, price: Math.round(Math.max(0, Number(h.price) || 0) * 100), kind: "haircut" }];
      for (const tr of (Array.isArray(m.treatments) ? m.treatments : []) as Record<string, unknown>[]) {
        if (!tr?.id || !tr?.name) continue;
        items.push({ id: str(tr.id, 60), name: str(tr.name, 60), durationMins: Number(tr.durationMins) || 15, price: Math.round(Math.max(0, Number(tr.price) || 0) * 100), kind: "treatment" });
      }
      return items;
    };
    // Master list + per-location overrides (legacy full copies are migrated by the same model).
    const file = { haircut: parsed.haircut ?? { name: "Haircut", durationMins: 30, icon: "clipper" }, treatments: Array.isArray(parsed.treatments) ? parsed.treatments : [], overrides: parsed.overrides, byLocation: parsed.byLocation } as MenuFile;
    const byLocation: Record<string, ShopDoc["menu"]> = {};
    for (const id of Object.keys(allOverrides(file)).slice(0, 50)) {
      if (!/^[\w-]{1,60}$/.test(id)) continue;
      const eff = effectiveMenu(file, id);
      byLocation[id] = toItems({ haircut: eff.haircut, treatments: eff.treatments } as unknown as Record<string, unknown>);
    }
    // Replace the whole map so removed branches don't keep stale menus.
    batch.update(shopRef(shopId), { menu: toItems(parsed), menuByLocation: byLocation, updatedAt: now });
  }
  if (docId === "locations") {
    // Plan limit: Partner and Pro run 1 shop, Lifetime 1–5 up to 5, Lifetime 5+ unlimited.
    const cur = ((await shopRef(shopId).get()).data() ?? {}) as ShopDoc;
    const limit = maxLocations(entitledPlan(effectivePlan(cur)));
    // Shops already saved stay usable (e.g. after a plan lapses); only adding past the limit is refused.
    const had = Array.isArray(cur.branches) ? cur.branches.length : 0;
    if (parsed.enabled && Array.isArray(parsed.branches) && parsed.branches.length > Math.max(limit, had)) {
      throw Object.assign(new Error(`Your plan allows ${limit} shop${limit === 1 ? "" : "s"}. Upgrade to Lifetime for more.`), { status: 403 });
    }
    const branches = (Array.isArray(parsed.branches) ? parsed.branches : []) as Record<string, unknown>[];
    batch.set(shopRef(shopId), {
      branches: parsed.enabled ? branches.slice(0, 20).map((b) => ({ id: str(b.id, 60), name: str(b.name, 80), address: str(b.address), area: str(b.area, 120), location: loc(b.location) })) : [],
      updatedAt: now,
    }, { merge: true });
  }
  if (docId === "chairs") {
    const chairs = (Array.isArray(parsed) ? parsed : []) as Record<string, unknown>[];
    const existing = await db().collection("chairLinks").where("shopId", "==", shopId).get();
    const keep = new Set<string>();
    for (const c of chairs) {
      const token = str(c.linkToken, 40);
      if (!token || !/^[a-z0-9]{8,40}$/.test(token)) continue;
      keep.add(token);
      batch.set(db().collection("chairLinks").doc(token), { shopId, chairId: str(c.id, 60), expiresAt: Number(c.linkExpiresAt) || 0 });
    }
    existing.docs.forEach((d) => { if (!keep.has(d.id)) batch.delete(d.ref); });
  }
  await batch.commit();
}

const STATUSES = new Set(["requested", "accepted", "in_chair", "done", "declined"]);

/** Cleans a booking row coming from a client. */
export function cleanBooking(shopId: string, b: Partial<ChairRequest>): ChairRequest {
  if (!b || typeof b.id !== "string" || !/^[\w-]{3,80}$/.test(b.id)) throw new Error("Bad booking id");
  const now = Date.now();
  const out: ChairRequest = {
    id: b.id, shopId, ref: str(b.ref, 20), channel: b.channel === "online" ? "online" : "walk-in",
    status: (STATUSES.has(String(b.status)) ? b.status : "requested") as ChairRequest["status"],
    contact: str(b.contact, 120), customerLabel: str(b.customerLabel, 80), serviceId: str(b.serviceId, 60),
    serviceName: str(b.serviceName, 80), price: Math.max(0, Number(b.price) || 0), slotLabel: str(b.slotLabel, 40),
    payWhere: b.payWhere === "online" ? "online" : "shop", createdAt: Number(b.createdAt) || now, updatedAt: now,
  };
  for (const k of ["chairLabel", "seatLabel", "locationId", "source"] as const) if (typeof b[k] === "string") (out as unknown as Record<string, unknown>)[k] = str(b[k], 80);
  for (const k of ["startedAt", "completedAt", "verifiedAt"] as const) if (typeof b[k] === "number") (out as unknown as Record<string, unknown>)[k] = b[k];
  if (typeof b.paid === "boolean") out.paid = b.paid;
  if (b.payMethod === "cash" || b.payMethod === "gcash" || b.payMethod === "online") out.payMethod = b.payMethod;
  if (typeof b.notes === "string") out.notes = str(b.notes, 500);
  return out;
}

/** Thrown when a Partner shop is over its daily walk-in limit (routes answer 402). */
export class WalkInLimitError extends Error { status = 402; }

/** Start of today in Manila (UTC+8, no DST) as unix ms. */
export function manilaDayStart(ms = Date.now()) {
  const day = new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return Date.parse(`${day}T00:00:00+08:00`);
}

/** Walk-ins created today (Manila) at one shop location: owner app and chair links alike. */
export async function walkInsToday(shopId: string, locationId?: string) {
  const loc = locationId || "home";
  const q = await shopRef(shopId).collection("bookings").where("createdAt", ">=", manilaDayStart()).get();
  return q.docs.filter((d) => { const b = d.data() as ChairRequest; return b.channel === "walk-in" && (b.locationId || "home") === loc; }).length;
}

export async function putBooking(shopId: string, row: Partial<ChairRequest>) {
  const clean = cleanBooking(shopId, row);
  const ref = shopRef(shopId).collection("bookings").doc(clean.id);
  // Payment state can't be set to "paid online" by a client; only cash at the chair.
  const prev = (await ref.get()).data() as ChairRequest | undefined;
  if (!prev && clean.channel === "walk-in") {
    // Server time decides the day; a client can't backdate a walk-in around the limit.
    clean.createdAt = Date.now();
    const shop = (await shopRef(shopId).get()).data() as ShopDoc | undefined;
    // Walk-ins start unpaid at the menu price; payment is confirmed when the cut is completed.
    clean.paid = false;
    if (!clean.price && shop) clean.price = menuFor(shop, clean.locationId).find((m) => m.id === (clean.serviceId || "haircut"))?.price ?? 0;
    const limit = walkInLimit(entitledPlan(shop ? effectivePlan(shop) : "partner"));
    if (Number.isFinite(limit) && (await walkInsToday(shopId, clean.locationId)) >= limit) throw new WalkInLimitError(WALKIN_LIMIT_MESSAGE);
  }
  // An owner can record an online booking as paid at the shop (cash/GCash); that makes it a shop payment.
  if (clean.payWhere === "online" && clean.paid && !prev?.paid) {
    if (clean.payMethod === "cash" || clean.payMethod === "gcash") clean.payWhere = "shop"; else clean.paid = false;
  }
  if (clean.paid && !clean.payMethod) clean.payMethod = prev?.payMethod ?? (clean.payWhere === "online" ? "online" : "cash");
  if (!clean.paid) delete clean.payMethod;
  if (prev?.source) clean.source = prev.source;
  // A booking keeps its original time (and so its day for the walk-in limit).
  if (prev?.createdAt) clean.createdAt = prev.createdAt;
  await ref.set(clean);
  return clean;
}

export async function deleteBooking(shopId: string, id: string) {
  await shopRef(shopId).collection("bookings").doc(id).delete();
}

export async function findBookingByRef(shopId: string, ref: string) {
  const q = await shopRef(shopId).collection("bookings").where("ref", "==", ref.trim().toUpperCase()).limit(1).get();
  return (q.docs[0]?.data() as ChairRequest | undefined) ?? null;
}

export async function chairLink(token: string) {
  if (!/^[a-z0-9]{8,40}$/.test(token)) return null;
  const s = await db().collection("chairLinks").doc(token).get();
  const d = s.data() as { shopId: string; chairId: string; expiresAt: number } | undefined;
  if (!d || (d.expiresAt && d.expiresAt < Date.now())) return null;
  return d;
}

/** Public view used by the booking page and River Mobile. Never includes owner-only data. */
/** The menu a branch sells: its own when it has one, else the first shop's. */
export function menuFor(s: ShopDoc, locationId?: string | null): ShopDoc["menu"] {
  return (locationId && s.menuByLocation?.[locationId]) || s.menu || [];
}

export function publicShop(id: string, s: ShopDoc) {
  return {
    id, name: s.name, address: s.address, area: s.area, phone: s.phone, about: s.about, hours: s.hours || null,
    location: s.location, photoUrls: s.photoUrls ?? [], logoUrl: s.logoUrl || null, branches: s.branches ?? [],
    services: (s.menu ?? []).map((m) => ({ id: m.id, name: m.name, durationMins: m.durationMins, price: m.price, kind: m.kind })),
    servicesByLocation: Object.fromEntries(Object.entries(s.menuByLocation ?? {}).map(([k, menu]) => [k, menu.map((m) => ({ id: m.id, name: m.name, durationMins: m.durationMins, price: m.price, kind: m.kind }))])),
    plan: entitledPlan(effectivePlan(s)) === "partner" ? "partner" : "paid",
    updatedAt: s.updatedAt,
  };
}

export async function getPublicShop(id: string) {
  if (!/^[\w-]{6,128}$/.test(id)) return null;
  const s = await shopRef(id).get();
  if (!s.exists) return null;
  const d = s.data() as ShopDoc;
  if (!d.listed) return null;
  return publicShop(id, d);
}

export function refCode() {
  const a = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return `BK-${s}`;
}

/** Creates a customer booking (public booking page or River Mobile). */
export async function createPublicBooking(shopId: string, input: { serviceId?: string; serviceIds?: string[]; contact?: string; customerLabel?: string; slotLabel?: string; payWhere?: string; locationId?: string; source: "qr" | "river"; externalId?: string }) {
  const shop = await getPublicShop(shopId);
  if (!shop) throw new Error("Shop not found");
  const ids = (Array.isArray(input.serviceIds) && input.serviceIds.length ? input.serviceIds : [input.serviceId]).filter(Boolean);
  const branchOk = input.locationId && shop.branches.some((b) => b.id === input.locationId);
  const services = (branchOk && shop.servicesByLocation[input.locationId as string]) || shop.services;
  const picked = services.filter((s) => ids.includes(s.id));
  if (!picked.length && services[0]) picked.push(services[0]);
  if (!picked.length) throw new Error("This shop has no services yet");
  const svc = { id: picked[0]!.id, name: picked.map((p) => p.name).join(" · "), price: picked.reduce((sum, p) => sum + p.price, 0) };
  const now = Date.now();
  const id = `${input.source}-${randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "x")}`;
  const row: ChairRequest = {
    id, shopId, ref: refCode(), channel: "online", status: "requested",
    contact: str(input.contact, 120), customerLabel: str(input.customerLabel, 80) || "Customer",
    serviceId: svc.id, serviceName: svc.name, price: svc.price, slotLabel: str(input.slotLabel, 40) || "Now",
    payWhere: input.payWhere === "online" ? "online" : "shop", createdAt: now, updatedAt: now, source: input.source,
  };
  if (input.locationId) row.locationId = str(input.locationId, 60);
  if (input.externalId) row.externalId = str(input.externalId, 120);
  await shopRef(shopId).collection("bookings").doc(id).set(row);
  return row;
}

export async function getBooking(shopId: string, id: string) {
  if (!/^[\w-]{6,128}$/.test(shopId) || !/^[\w-]{3,80}$/.test(id)) return null;
  const s = await shopRef(shopId).collection("bookings").doc(id).get();
  return (s.data() as ChairRequest | undefined) ?? null;
}

/** Fields a customer may see about their own booking. */
export function publicBooking(b: ChairRequest) {
  return {
    id: b.id, shopId: b.shopId, ref: b.ref, status: b.status, serviceId: b.serviceId, serviceName: b.serviceName, price: b.price,
    slotLabel: b.slotLabel, payWhere: b.payWhere, paid: Boolean(b.paid), chairLabel: b.chairLabel ?? null,
    locationId: b.locationId ?? null, verifiedAt: b.verifiedAt ?? null, createdAt: b.createdAt, updatedAt: b.updatedAt,
  };
}

export async function verifyBooking(shopId: string, code: string) {
  const b = await findBookingByRef(shopId, code);
  if (!b) return { ok: false as const, reason: "not_found" as const };
  if (b.status === "declined") return { ok: false as const, reason: "declined" as const, booking: b };
  const next = { ...b, verifiedAt: b.verifiedAt ?? Date.now(), status: b.status === "requested" ? "accepted" as const : b.status, updatedAt: Date.now() };
  await shopRef(shopId).collection("bookings").doc(b.id).set(next);
  return { ok: true as const, booking: next };
}

export { FieldValue };
