import { sharePct } from "@/lib/income-split";
import { deleteSummary, editChanges } from "@/lib/edit-log";
import { MANUAL_SOURCE, manualPayError, manualTimeError } from "@/lib/manual-record";
import { applyOverrides, cleanOverrides, toCentavos } from "@/lib/location-prices";
import { ratingSummary, writeReview } from "./reviews";
import { parseWeek } from "@/lib/shop-hours";
import { entitledPlan } from "@/lib/entitlements";
import "server-only";
import { cappedGet } from "./capped-read";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { bookingActivity, OWNER, stateActivity, type Actor } from "./activity";
import type { ChairRequest } from "@/lib/booking-types";

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
  "barbers.home-service": "home",
  "barbers.sales-groups": "salesGroups",
};
/** Keys a barber link may write. */
/** State a chair link may write directly: none. Barbers change only their own name (setBarberName). */
export const BARBER_KEYS = new Set<string>();

import { isRecurring, maxLocations, normalizePlan, walkInLimit, WALKIN_LIMIT_MESSAGE, type PlanId } from "@/lib/plans";
import { cutBarberId } from "@/lib/cut-count";

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
  hoursWeek?: import("@/lib/shop-hours").WeekHours | null;
  location: { lat: number; lng: number; formattedAddress: string } | null;
  photoUrls: string[];
  logoUrl: string;
  payQrUrl?: string;
  /** Star line on customer pages (lib/server/reviews.ts). */
  ratingCount?: number;
  ratingSum?: number;
  /** Legacy (dev only, before 2026-10-20 23:58): separate GCash/Maya QRs. Read as payQrUrl. */
  payQr?: { gcash?: string; maya?: string };
  branches: { id: string; name: string; address: string; area: string; location: ShopDoc["location"]; /** Centavos per service id (location prices). */ priceOverrides?: Record<string, number> }[];
  menu: { id: string; name: string; durationMins: number; price: number; kind: "haircut" | "treatment"; icon?: string }[];
  /** Menus for branches other than the first shop, keyed by location id. */
  menuByLocation?: Record<string, ShopDoc["menu"]>;
  /** Home service settings (River Mobile only), mirrored from the "barbers.home-service" state. */
  homeService?: import("@/lib/home-service-model").HomeServiceFile;
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
  // A WINDOW (newest N for live screens), never a total: counts come from the sales-rows day query (lib/counts.ts).
  const q = await cappedGet(shopRef(shopId).collection("bookings").orderBy("createdAt", "desc"), limit, "loadBookings(live)", "window");
  return q.docs.map((d) => d.data() as ChairRequest);
}

function str(v: unknown, max = 500) { return typeof v === "string" ? v.slice(0, max) : ""; }
function loc(v: unknown): ShopDoc["location"] {
  const l = v as { lat?: unknown; lng?: unknown; formattedAddress?: unknown } | null;
  if (!l || typeof l.lat !== "number" || typeof l.lng !== "number" || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) return null;
  return { lat: l.lat, lng: l.lng, formattedAddress: str(l.formattedAddress) };
}
function urls(v: unknown, max = 8) { return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u)).slice(0, max) : []; }

/** Saves one state key and mirrors the public parts onto shops/{shopId}. */
export async function putState(shopId: string, key: string, raw: string, actor: Actor = OWNER) {
  const docId = STATE_KEYS[key];
  if (!docId) throw new Error("Unknown key");
  if (raw.length > 400_000) throw new Error("Too large");
  const prevRaw = docId === "community" ? undefined : ((await shopRef(shopId).collection("private").doc(docId).get()).data()?.json as string | undefined);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const batch = db().batch();
  batch.set(shopRef(shopId).collection("private").doc(docId), { json: raw, updatedAt: Date.now() });
  const now = Date.now();
  if (docId === "profile") {
    const name = str(parsed.name, 80).trim();
    batch.set(shopRef(shopId), {
      name, address: str(parsed.address), area: str(parsed.area, 120), phone: str(parsed.phone, 30),
      about: str(parsed.about, 600), hours: str(parsed.hours, 200), hoursWeek: parseWeek(parsed.hoursWeek), location: loc(parsed.location),
      photoUrls: urls(parsed.photoUrls), logoUrl: urls([parsed.logoUrl])[0] ?? "",
      payQrUrl: urls([parsed.payQrUrl ?? (parsed.payQr as { gcash?: unknown } | undefined)?.gcash ?? (parsed.payQr as { maya?: unknown } | undefined)?.maya])[0] ?? "",
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
      const items: ShopDoc["menu"] = [{ id: "haircut", name: str(h.name, 60) || "Haircut", durationMins: Number(h.durationMins) || 30, price: Math.round(Math.max(0, Number(h.price) || 0) * 100), kind: "haircut", icon: str(h.icon, 20) || "clipper" }];
      for (const tr of (Array.isArray(m.treatments) ? m.treatments : []) as Record<string, unknown>[]) {
        if (!tr?.id || !tr?.name || tr.enabled === false) continue;
        items.push({ id: str(tr.id, 60), name: str(tr.name, 60), durationMins: Number(tr.durationMins) || 15, price: Math.round(Math.max(0, Number(tr.price) || 0) * 100), kind: "treatment", icon: str(tr.icon, 20) || "scissors" });
      }
      return items;
    };
    // Services are shop-wide; clear any old per-location menus.
    const byLocation: Record<string, ShopDoc["menu"]> = {};
    // Replace the whole map so removed branches don't keep stale menus.
    batch.update(shopRef(shopId), { menu: toItems(parsed), menuByLocation: byLocation, updatedAt: now });
  }
  if (docId === "home") {
    const { parseHomeFile } = await import("@/lib/home-service-model");
    batch.set(shopRef(shopId), { homeService: parseHomeFile(parsed), updatedAt: now }, { merge: true });
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
      branches: parsed.enabled ? branches.slice(0, 20).map((b) => ({ id: str(b.id, 60), name: str(b.name, 80), address: str(b.address), area: str(b.area, 120), location: loc(b.location), priceOverrides: toCentavos(cleanOverrides(b.priceOverrides)) })) : [],
      updatedAt: now,
    }, { merge: true });
  }
  if (docId === "chairs") {
    const chairs = (Array.isArray(parsed) ? parsed : []) as Record<string, unknown>[];
    const existing = await db().collection("chairLinks").where("shopId", "==", shopId).get();
    const keep = new Set<string>();
    for (const c of chairs) {
      const token = str(c.linkToken, 40);
      // Inactive barbers: their link stops working (token kept on the chair, restored on reactivate).
      if (!token || c.active === false || !/^[a-z0-9]{8,40}$/.test(token)) continue;
      keep.add(token);
      // Links never expire (owner reviews them every 6 months as a nudge). Set without merge, so any old expiresAt is dropped.
      batch.set(db().collection("chairLinks").doc(token), { shopId, chairId: str(c.id, 60) });
    }
    existing.docs.forEach((d) => { if (!keep.has(d.id)) batch.delete(d.ref); });
  }
  await batch.commit();
  if (prevRaw !== undefined || docId !== "community") await stateActivity(shopId, docId, prevRaw, raw, actor);
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
  for (const k of ["chairLabel", "seatLabel", "locationId", "source", "barberId", "barberName"] as const) if (typeof b[k] === "string") (out as unknown as Record<string, unknown>)[k] = str(b[k], 80);
  for (const k of ["startedAt", "completedAt", "verifiedAt", "scheduledAt"] as const) if (typeof b[k] === "number") (out as unknown as Record<string, unknown>)[k] = b[k];
  if (typeof b.paid === "boolean") out.paid = b.paid;
  if (b.payMethod === "cash" || b.payMethod === "gcash" || b.payMethod === "online") out.payMethod = b.payMethod;
  if (typeof b.notes === "string") out.notes = str(b.notes, 500);
  // Tip (centavos, up to ₱10,000): the barber's, separate from the price.
  // A write without `tip` keeps the saved one (older clients); tip 0 removes it.
  if (typeof b.tip === "number") { const t = Math.round(b.tip); out.tip = Number.isFinite(t) && t > 0 ? Math.min(t, 1_000_000) : 0; }
  if (b.homeStatus === "on_the_way" || b.homeStatus === "arrived") out.homeStatus = b.homeStatus;
  return out;
}


/**
 * Menu total (centavos) for a visit's services, matched by name ("Haircut · Beard trim").
 * Null when none of the names are on the shop's menu.
 */
export function menuPrice(shop: ShopDoc | undefined, serviceName: string, locationId?: string): number | null {
  if (!shop) return null;
  const names = new Set(serviceName.split("·").map((n) => n.trim().toLowerCase()).filter(Boolean));
  const hits = menuFor(shop, locationId).filter((m) => names.has(m.name.trim().toLowerCase()));
  return hits.length ? hits.reduce((sum, m) => sum + (m.price || 0), 0) : null;
}

/**
 * The amount a barber link saves: always the menu price of the visit's services (plus the home-service fee).
 * Barbers can't change it; only the owner can. A visit already paid online keeps its paid amount.
 */
export function barberPrice(shop: ShopDoc | undefined, clean: ChairRequest, prev?: ChairRequest): number {
  if (prev?.paid && (prev.payMethod === "online" || (!prev.payMethod && prev.payWhere === "online"))) return prev.price;
  const listed = menuPrice(shop, clean.serviceName, clean.locationId);
  if (listed != null) return listed + (prev?.homeFee ?? 0);
  if (prev) return prev.price;
  return (shop && menuFor(shop, clean.locationId).find((m) => m.id === (clean.serviceId || "haircut"))?.price) ?? 0;
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

const RANK: Record<string, number> = { requested: 0, accepted: 1, in_chair: 2, done: 3, declined: 3 };

/** Saves one booking. `barber` stamps the chair link's barber (a link can't claim another barber). */
export async function putBooking(shopId: string, row: Partial<ChairRequest>, barber?: { barberId: string; barberName: string; locationId?: string }) {
  const clean = cleanBooking(shopId, row);
  if (barber) {
    clean.barberId = barber.barberId;
    clean.barberName = barber.barberName;
    // A chair link only works its own shop's queue.
    clean.locationId = barber.locationId || "home";
  }
  const ref = shopRef(shopId).collection("bookings").doc(clean.id);
  const prev = (await ref.get()).data() as ChairRequest | undefined;
  let shopDoc: Promise<ShopDoc | undefined> | null = null;
  const getShopDoc = () => (shopDoc ??= shopRef(shopId).get().then((d) => d.data() as ShopDoc | undefined));
  // Barber links can't change the amount: it is the menu price, whatever the client sent.
  if (barber) clean.price = barberPrice(await getShopDoc(), clean, prev);
  // Owner-added record from the Weekly Profit Report (encoded later, e.g. when offline): a finished walk-in on a past day.
  const manual = !prev && !barber && clean.channel === "walk-in" && clean.source === MANUAL_SOURCE;
  if (manual) {
    const at = clean.completedAt ?? NaN;
    const err = manualTimeError(Number.isFinite(at) ? at : null);
    if (err) throw new Error(err);
    const payErr = manualPayError(clean);
    if (payErr) throw new Error(payErr);
    clean.status = "done"; clean.createdAt = at; clean.startedAt = at;
    clean.editLog = [{ at: Date.now(), by: "Owner", role: "owner", changes: [`Manually added for ${new Date(at).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`] }];
  } else if (!prev && clean.channel === "walk-in") {
    // Server time decides the day; a client can't backdate a walk-in around the limit.
    clean.createdAt = Date.now();
    const shop = await getShopDoc();
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
  else if (!manual && clean.source === MANUAL_SOURCE) delete clean.source;
  // A booking keeps its original time (and so its day for the walk-in limit).
  if (prev?.createdAt) clean.createdAt = prev.createdAt;
  // Customer-only fields: the shop can't change them by saving the row.
  if (prev?.payPref) clean.payPref = prev.payPref;
  if (prev?.rating) { clean.rating = prev.rating; if (prev.feedback) clean.feedback = prev.feedback; if (prev.feedbackAt) clean.feedbackAt = prev.feedbackAt; }
  // Keep the barber recorded on the visit unless this write names one.
  if (!clean.barberId && prev?.barberId) { clean.barberId = prev.barberId; if (prev.barberName) clean.barberName = prev.barberName; }
  // Split snapshot (v1.0.22): a finished visit keeps the barber's split % from when it finished, so a later change
  // of the barber's share never rewrites past days. Kept from the saved row; stamped once on the first "done" write.
  if (prev && "splitPct" in prev) clean.splitPct = prev.splitPct ?? null;
  else if (clean.status === "done" && clean.barberId && clean.barberId !== "owner") {
    const chairs = JSON.parse((await loadState(shopId, ["barbers.shop-chairs"]))["barbers.shop-chairs"] || "[]") as { id: string; barberId?: string; locationId?: string; sharePct?: unknown; shareSet?: unknown }[];
    const loc = clean.locationId || "home";
    const mine = (c: { id: string; barberId?: string }) => c.barberId === clean.barberId || c.id === clean.barberId;
    const c = chairs.find((x) => mine(x) && (x.locationId || "home") === loc) ?? chairs.find(mine);
    if (c) clean.splitPct = sharePct(c);
  }
  // Writes can land out of order (e.g. "accepted" after "in chair", or a stale tab after "done").
  // A visit never moves back a step: an older write is ignored and the saved row is returned.
  const res = await db().runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data() as ChairRequest | undefined;
    if (cur && RANK[clean.status]! < RANK[cur.status]!) return { saved: cur, before: cur, wrote: false };
    if (cur?.status === "declined" && clean.status !== "declined") return { saved: cur, before: cur, wrote: false };
    if (cur?.rating) { clean.rating = cur.rating; clean.feedback = cur.feedback; clean.feedbackAt = cur.feedbackAt; if (!clean.feedback) delete clean.feedback; if (!clean.feedbackAt) delete clean.feedbackAt; }
    if (cur?.scheduledAt && !clean.scheduledAt) clean.scheduledAt = cur.scheduledAt;
    // Home-service fields are set by the River API only; the app can't change the address or fee.
    if (cur?.home) { clean.home = cur.home; if (cur.homeFee != null) clean.homeFee = cur.homeFee; }
    // Edit log (server-derived, for accountability): who changed which details, and when.
    if (clean.tip === undefined && cur?.tip) clean.tip = cur.tip;
    if (!clean.tip) delete clean.tip;
    if (cur?.editLog) clean.editLog = cur.editLog;
    if (cur && manual) return { saved: cur, before: cur, wrote: false };
    if (cur && cur.status === clean.status) {
      const changes = editChanges(cur, clean);
      if (changes.length) clean.editLog = [...(cur.editLog ?? []), { at: Date.now(), by: barber ? barber.barberName : "Owner", role: barber ? "barber" as const : "owner" as const, changes }].slice(-30);
    }
    tx.set(ref, clean);
    return { saved: clean, before: cur, wrote: true };
  });
  if (res.wrote) await bookingActivity(shopId, res.before, res.saved, barber ? { name: barber.barberName, role: "barber" } : OWNER);
  return res.saved;
}

export async function deleteBooking(shopId: string, id: string) {
  const ref = shopRef(shopId).collection("bookings").doc(id);
  const prev = (await ref.get()).data() as ChairRequest | undefined;
  await ref.delete();
  if (prev) await (await import("./activity")).logActivity(shopId, { type: "booking_deleted", actor: OWNER, locationId: prev.locationId || "home", ref: prev.ref, text: deleteSummary(prev) });
}

export async function findBookingByRef(shopId: string, ref: string) {
  const q = await shopRef(shopId).collection("bookings").where("ref", "==", ref.trim().toUpperCase()).limit(1).get();
  return (q.docs[0]?.data() as ChairRequest | undefined) ?? null;
}

/** The barber on a chair link: id, name and shop location, from the shop's chairs. */
export type LinkBarber = { barberId: string; barberName: string; locationId?: string; chairLabel?: string };

export async function linkBarber(shopId: string, chairId: string): Promise<LinkBarber | undefined> {
  const chairs = JSON.parse((await loadState(shopId, ["barbers.shop-chairs"]))["barbers.shop-chairs"] || "[]") as { id: string; barberId?: string; barberName?: string; label?: string; locationId?: string }[];
  const c = chairs.find((x) => x.id === chairId);
  if (!c) return undefined;
  return { barberId: c.barberId || c.id, barberName: (c.barberName || "").trim() || c.label || "Barber", locationId: c.locationId, chairLabel: c.label };
}

const OPEN_STATUSES = new Set(["requested", "accepted"]);

/**
 * What a barber link may see and change (Jimboy, 2026-10-19: a link only works its own bookings).
 * - "own": the visit's barberId is this barber (shared rule, src/lib/cut-count.ts; no chair/seat fallback).
 * - "open": an unassigned visit still waiting at this barber's location. It stays visible so the barber can
 *   accept it from Waiting; the first write stamps this barber on it, and then it's theirs only.
 * Anything else (another barber's visit, another location, an unassigned visit already started or finished) is hidden.
 */
export function barberAccess(b: ChairRequest, me: LinkBarber): "own" | "open" | null {
  if ((b.locationId || "home") !== (me.locationId || "home")) return null;
  if (b.barberId) return cutBarberId(b) === me.barberId ? "own" : null;
  return OPEN_STATUSES.has(b.status) ? "open" : null;
}

/** Bookings for a barber link: their own (newest 200) plus open ones waiting at their location. */
export async function loadBarberBookings(shopId: string, me: LinkBarber): Promise<ChairRequest[]> {
  const col = shopRef(shopId).collection("bookings");
  // Equality-only query: no composite index needed. Recent shop rows cover open (unassigned, waiting) visits.
  const [recent, mine] = await Promise.all([
    cappedGet(col.orderBy("createdAt", "desc"), 150, "loadBarberBookings(recent)", "window"),
    ownBarberRows(col, me.barberId),
  ]);
  const byId = new Map<string, ChairRequest>();
  for (const d of [...recent.docs, ...mine.docs]) { const b = d.data() as ChairRequest; if (b?.id) byId.set(b.id, b); }
  const rows = [...byId.values()].filter((b) => barberAccess(b, me)).sort((a, b) => b.createdAt - a.createdAt);
  const own = rows.filter((b) => barberAccess(b, me) === "own").slice(0, 200);
  const open = rows.filter((b) => barberAccess(b, me) === "open");
  return [...own, ...open].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * A barber's own newest 300 rows (v1.0.24). Ordered newest-first needs the composite index in firestore.indexes.json
 * (barberId asc, createdAt desc). Until that index is deployed, fall back to the old unordered read and log it loudly:
 * unordered, ids sort oldest-first, so past 300 rows it would drop the NEWEST visits.
 */
async function ownBarberRows(col: FirebaseFirestore.CollectionReference, barberId: string) {
  try {
    return await cappedGet(col.where("barberId", "==", barberId).orderBy("createdAt", "desc"), 300, "loadBarberBookings(own)", "window");
  } catch (e) {
    console.error("[index-missing] bookings(barberId asc, createdAt desc): deploy firestore.indexes.json. Falling back to an unordered read.", (e as Error).message);
    const r = await cappedGet(col.where("barberId", "==", barberId), 300, "loadBarberBookings(own,unordered)", "total");
    return r;
  }
}

/** A barber renames themself on their own link. Only that chair's barberName changes. */
export async function setBarberName(shopId: string, chairId: string, name: string) {
  const clean = str(name, 40).trim();
  if (!clean) throw new Error("Enter a name");
  const ref = shopRef(shopId).collection("private").doc(STATE_KEYS["barbers.shop-chairs"] as string);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const raw = (snap.data()?.json as string | undefined) ?? "[]";
    const chairs = JSON.parse(raw) as { id: string; barberName?: string }[];
    if (!chairs.some((c) => c.id === chairId)) throw new Error("Chair not found");
    tx.set(ref, { json: JSON.stringify(chairs.map((c) => (c.id === chairId ? { ...c, barberName: clean } : c))), updatedAt: Date.now() });
  });
  return clean;
}

export async function chairLink(token: string) {
  if (!/^[a-z0-9]{8,40}$/.test(token)) return null;
  const s = await db().collection("chairLinks").doc(token).get();
  // No expiry: a link works until the owner resets it, deactivates the barber or removes the chair
  // (each of those deletes this doc). A legacy expiresAt field is ignored, so no existing link breaks.
  const d = s.data() as { shopId: string; chairId: string } | undefined;
  if (!d?.shopId || !d.chairId) return null;
  return { shopId: d.shopId, chairId: d.chairId };
}

/** Public view used by the booking page and River Mobile. Never includes owner-only data. */
/** Services are shop-wide: every location sells the main Services list. */
/** Services are shop-wide; a location may set its own prices (branch.priceOverrides, centavos). */
export function menuFor(s: ShopDoc, locationId?: string | null): ShopDoc["menu"] {
  // A visit with no location is at the main shop ("home"), which can have its own prices too.
  const b = (s.branches ?? []).find((x) => x.id === (locationId || "home"));
  return applyOverrides(s.menu || [], b?.priceOverrides);
}

export function publicShop(id: string, s: ShopDoc) {
  return {
    id, name: s.name, address: s.address, area: s.area, phone: s.phone, about: s.about, hours: s.hours || null, hoursWeek: s.hoursWeek ?? null,
    location: s.location, photoUrls: s.photoUrls ?? [], logoUrl: s.logoUrl || null, branches: (s.branches ?? []).map(({ priceOverrides: _p, ...b }) => b),
    payQrUrl: s.payQrUrl || s.payQr?.gcash || s.payQr?.maya || null,
    rating: ratingSummary(s),
    services: (s.menu ?? []).map((m) => ({ id: m.id, name: m.name, durationMins: m.durationMins, price: m.price, kind: m.kind, icon: m.icon ?? null })),
    // Location prices: a location with its own prices gets its own list (others use `services`).
    servicesByLocation: Object.fromEntries((s.branches ?? []).filter((b) => b.priceOverrides && Object.keys(b.priceOverrides).length).map((b) => [b.id, menuFor(s, b.id).map((m) => ({ id: m.id, name: m.name, durationMins: m.durationMins, price: m.price, kind: m.kind, icon: m.icon ?? null }))])) as Record<string, { id: string; name: string; durationMins: number; price: number; kind: "haircut" | "treatment"; icon: string | null }[]>,
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

/** Active barbers at one location for the customer Schedule page (name + photo only). */
export async function publicBarbers(shopId: string, locationId: string) {
  const chairs = JSON.parse((await loadState(shopId, ["barbers.shop-chairs"]))["barbers.shop-chairs"] || "[]") as { id: string; barberId?: string; barberName?: string; label?: string; photoUrl?: string; active?: boolean; locationId?: string }[];
  const seen = new Set<string>();
  return chairs
    .filter((c) => c.active !== false && (c.locationId || "home") === locationId && c.barberName?.trim())
    .map((c) => ({ id: c.barberId || c.id, name: c.barberName!.trim().slice(0, 60), photoUrl: c.photoUrl || null }))
    .filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
}

/** Creates a customer booking (public booking page or River Mobile). */
export async function createPublicBooking(shopId: string, input: { serviceId?: string; serviceIds?: string[]; contact?: string; customerLabel?: string; slotLabel?: string; payWhere?: string; payPref?: string; locationId?: string; source: "qr" | "river"; externalId?: string; scheduledAt?: number; barberId?: string }) {
  const shop = await getPublicShop(shopId);
  if (!shop) throw new Error("Shop not found");
  const ids = (Array.isArray(input.serviceIds) && input.serviceIds.length ? input.serviceIds : [input.serviceId]).filter(Boolean);
  const branchOk = input.locationId && shop.branches.some((b) => b.id === input.locationId);
  // No location on the link = the main shop ("home"), which can have its own prices too.
  const services = shop.servicesByLocation[branchOk ? (input.locationId as string) : "home"] || shop.services;
  const picked = services.filter((s) => ids.includes(s.id));
  if (!picked.length && services[0]) picked.push(services[0]);
  if (!picked.length) throw new Error("This shop has no services yet");
  const svc = { id: picked[0]!.id, name: picked.map((p) => p.name).join(" · "), price: picked.reduce((sum, p) => sum + p.price, 0) };
  const now = Date.now();
  const id = `${input.source}-${randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "x")}`;
  const row: ChairRequest = {
    id, shopId, ref: refCode(), channel: "online", status: "requested",
    contact: str(input.contact, 120), customerLabel: str(input.customerLabel, 80) || (input.source === "qr" ? "QR guest" : "Customer"),
    serviceId: svc.id, serviceName: svc.name, price: svc.price, slotLabel: str(input.slotLabel, 40) || "Now",
    payWhere: input.payWhere === "online" ? "online" : "shop", createdAt: now, updatedAt: now, source: input.source,
  };
  // A QR is bound to one shop: an unknown location is refused, never guessed.
  if (input.locationId) {
    if (!branchOk && input.locationId !== "home") throw new Error("This QR code is for a shop that no longer exists. Ask the shop for a new code.");
    row.locationId = str(input.locationId, 60);
  }
  if (input.externalId) row.externalId = str(input.externalId, 120);
  // Scheduled visit: within the next 15 days, labelled in Manila time; an optional barber from that location.
  if (input.scheduledAt != null) {
    const at = Number(input.scheduledAt);
    if (!Number.isFinite(at) || at < now - 10 * 60_000 || at > now + 15 * 86_400_000) throw new Error("Pick a time in the next two weeks.");
    row.scheduledAt = at;
    row.slotLabel = new Date(at).toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  if (input.barberId) {
    const barbers = await publicBarbers(shopId, row.locationId || "home");
    const b = barbers.find((x) => x.id === input.barberId);
    if (!b) throw new Error("That barber isn’t available. Pick another or Any barber.");
    row.barberId = b.id;
    row.barberName = b.name;
  }
  if (input.payPref === "cash" || input.payPref === "online" || input.payPref === "gcash" || input.payPref === "maya") row.payPref = input.payPref;
  await shopRef(shopId).collection("bookings").doc(id).set(row);
  await (await import("./activity")).logActivity(shopId, { type: "booking_requested", actor: { name: row.customerLabel, role: "customer" }, locationId: row.locationId || "home", ref: row.ref, amount: row.price,
    text: `${row.customerLabel} booked ${row.serviceName} · ${row.slotLabel}${input.source === "river" ? " (River app)" : " (QR)"}` }, true);
  void (await import("./notify")).notifyNewOnlineBooking(shopId, { ref: row.ref, customerLabel: row.customerLabel, serviceName: row.serviceName, slotLabel: row.slotLabel, locationId: row.locationId, shopName: shop.name });
  return row;
}

/** Customer rates a finished visit once (1–5 stars, optional comment). */
export async function saveFeedback(shopId: string, id: string, rating: number, comment: string) {
  if (!/^[\w-]{6,128}$/.test(shopId) || !/^[\w-]{3,80}$/.test(id)) throw new Error("Bad booking");
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) throw new Error("Pick 1 to 5 stars");
  const ref = shopRef(shopId).collection("bookings").doc(id);
  return db().runTransaction(async (tx) => {
    const b = (await tx.get(ref)).data() as ChairRequest | undefined;
    if (!b) throw new Error("Booking not found");
    if (b.status !== "done") throw new Error("You can rate the visit once it’s done.");
    if (b.rating) return b;
    const next = { ...b, rating: r, feedback: str(comment, 500).trim() || undefined, feedbackAt: Date.now() };
    if (!next.feedback) delete next.feedback;
    // Also counts toward the shop's star line (reviews read before any write: Firestore transaction rule).
    await writeReview(tx, shopId, `visit_${id}`, { rating: r, comment: (next.feedback ?? "").slice(0, 300), name: (b.customerLabel && b.customerLabel !== "Walk-in" && !b.customerLabel.includes("@") && !/\d{7}/.test(b.customerLabel) ? b.customerLabel.split(" ")[0]! : "Customer"), at: next.feedbackAt, source: "visit" });
    tx.set(ref, next);
    return next as ChairRequest;
  });
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
    slotLabel: b.slotLabel, payWhere: b.payWhere, paid: Boolean(b.paid), chairLabel: b.chairLabel ?? null, payPref: b.payPref ?? null,
    payMethod: b.paid ? b.payMethod ?? null : null, rating: b.rating ?? null, completedAt: b.completedAt ?? null, barberName: b.barberName ?? null,
    locationId: b.locationId ?? null, verifiedAt: b.verifiedAt ?? null, createdAt: b.createdAt, updatedAt: b.updatedAt,
    scheduledAt: b.scheduledAt ?? null, barberId: b.barberId ?? null,
    homeService: b.home ? { address: b.home.address, lat: b.home.lat, lng: b.home.lng, distanceKm: b.home.distanceKm, fee: b.homeFee ?? 0, step: b.status === "done" ? "done" : b.homeStatus ?? (b.status === "declined" ? "declined" : "scheduled") } : null,
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
