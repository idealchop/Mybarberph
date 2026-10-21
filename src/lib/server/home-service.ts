import "server-only";
import { randomBytes } from "node:crypto";
import type { ChairRequest } from "@/lib/booking-types";
import { distanceKm, homeSlots, manilaAt, manilaYmd, parseHomeFile, type HomeLocationSettings } from "@/lib/home-service-model";
import { menuFor, publicBarbers, refCode, shopRef, type ShopDoc } from "./shops";

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Where a location is: the first shop uses the shop pin; branches their own. */
function placeOf(shop: ShopDoc, locationId: string) {
  if (locationId === "home") return { name: shop.branches?.length ? shop.branches.find((b) => b.id === "home")?.name || shop.area.split(",")[0] || shop.name : shop.name, address: shop.address, location: shop.location };
  const b = (shop.branches ?? []).find((x) => x.id === locationId) as (ShopDoc["branches"][number] & { location?: { lat: number; lng: number } | null }) | undefined;
  return b ? { name: b.name, address: b.address, location: b.location ?? null } : null;
}

function servicesFor(shop: ShopDoc, serviceIds: string[], locationId?: string) {
  // Location prices apply to home visits from that location too.
  return menuFor(shop, locationId).filter((m) => serviceIds.includes(m.id)).map((m) => ({ id: m.id, name: m.name, price: m.price, durationMins: m.durationMins, kind: m.kind }));
}

async function homeBarbers(shopId: string, locationId: string, cfg: HomeLocationSettings) {
  const all = await publicBarbers(shopId, locationId);
  return cfg.barberIds.length ? all.filter((b) => cfg.barberIds.includes(b.id)) : all;
}

/** One shop location's home-service offer (null when off, misconfigured, or out of range). */
export async function homeOffer(shopId: string, shop: ShopDoc, locationId: string, customer?: { lat: number; lng: number }) {
  const file = parseHomeFile(shop.homeService);
  const cfg = file.locations[locationId];
  const place = placeOf(shop, locationId);
  const services = servicesFor(shop, file.serviceIds, locationId);
  if (!shop.listed || !cfg?.enabled || !place?.location || !services.length) return null;
  const dist = customer ? Math.round(distanceKm(customer, place.location) * 100) / 100 : null;
  if (dist != null && dist > cfg.radiusKm) return null;
  return {
    shopId, shopName: shop.name, logoUrl: shop.logoUrl || null, locationId, locationName: place.name, address: place.address, location: place.location,
    fee: cfg.fee * 100, feePeso: cfg.fee, radiusKm: cfg.radiusKm, distanceKm: dist,
    services, hours: { days: cfg.days, from: cfg.from, to: cfg.to, timeZone: "Asia/Manila" },
    barbers: await homeBarbers(shopId, locationId, cfg),
  };
}

/** Every listed shop location offering home service (within radius of the customer when lat/lng given), nearest first. */
export async function listHomeShops(customer?: { lat: number; lng: number }, limit = 50) {
  const { adminDb } = await import("@/lib/firebase/admin");
  const snap = await adminDb().collection("shops").where("listed", "==", true).limit(500).get();
  const offers = [];
  for (const d of snap.docs) {
    const shop = d.data() as ShopDoc;
    const locs = Object.entries(parseHomeFile(shop.homeService).locations).filter(([, c]) => c.enabled).map(([id]) => id);
    for (const loc of locs) { const o = await homeOffer(d.id, shop, loc, customer); if (o) offers.push(o); }
  }
  offers.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  return offers.slice(0, limit);
}

async function shopDoc(shopId: string) {
  if (!/^[\w-]{6,128}$/.test(shopId)) return null;
  const d = await shopRef(shopId).get();
  return d.exists ? (d.data() as ShopDoc) : null;
}

/** Busy home visits (not declined/done) per barber for one Manila day. */
async function homeBookingsOn(shopId: string, ymd: string) {
  const start = manilaAt(ymd, "00:00"), end = start + 86_400_000;
  const q = await shopRef(shopId).collection("bookings").where("scheduledAt", ">=", start).where("scheduledAt", "<", end).get();
  return q.docs.map((x) => x.data() as ChairRequest).filter((b) => b.home && b.status !== "declined");
}

/** Free 30-min start times for a day. A slot is full when every home barber (or the named one) has a visit then. */
export async function homeSlotsFor(shopId: string, locationId: string, ymd: string, barberId?: string) {
  const shop = await shopDoc(shopId);
  if (!shop) throw new Error("Shop not found");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("date must be YYYY-MM-DD");
  const cfg = parseHomeFile(shop.homeService).locations[locationId];
  if (!cfg?.enabled) throw new Error("Home service is off for this location");
  const barbers = await homeBarbers(shopId, locationId, cfg);
  const taken = (await homeBookingsOn(shopId, ymd)).filter((b) => (b.locationId || "home") === locationId);
  const capacity = barberId ? 1 : Math.max(1, barbers.length);
  return homeSlots(cfg, ymd).filter((t) => {
    const at = manilaAt(ymd, t);
    const clash = taken.filter((b) => Math.abs((b.scheduledAt ?? 0) - at) < 60 * 60_000 && (!barberId || b.barberId === barberId));
    return clash.length < capacity;
  }).map((t) => ({ time: t, scheduledAt: manilaAt(ymd, t) }));
}

export interface HomeBookingInput {
  locationId?: string; serviceIds?: string[]; customerName?: string; contact?: string;
  address?: string; lat?: number; lng?: number; notes?: string;
  date?: string; time?: string; scheduledAt?: number; barberId?: string;
  payWhere?: string; payPref?: string; externalId?: string;
}

/** Creates a River Mobile home-service booking after validating service, radius, hours and barber. */
export async function createHomeBooking(shopId: string, input: HomeBookingInput) {
  const shop = await shopDoc(shopId);
  if (!shop || !shop.listed) throw new Error("Shop not found");
  const locationId = s(input.locationId, 60) || "home";
  const name = s(input.customerName, 80);
  const address = s(input.address, 300);
  const lat = Number(input.lat), lng = Number(input.lng);
  if (!name) throw new Error("customerName is required");
  if (!address) throw new Error("address is required");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("lat and lng are required");
  const file = parseHomeFile(shop.homeService);
  const cfg = file.locations[locationId];
  if (!cfg?.enabled) throw new Error("Home service is off for this location");
  const place = placeOf(shop, locationId);
  if (!place?.location) throw new Error("This location has no map pin yet");
  const dist = Math.round(distanceKm({ lat, lng }, place.location) * 100) / 100;
  if (dist > cfg.radiusKm) throw new Error(`Address is ${dist} km away; this shop goes up to ${cfg.radiusKm} km.`);
  const wanted = (Array.isArray(input.serviceIds) ? input.serviceIds : []).filter((x) => typeof x === "string");
  if (!wanted.length) throw new Error("serviceIds is required");
  const off = wanted.filter((id) => !file.serviceIds.includes(id));
  if (off.length) throw new Error(`Not offered as home service: ${off.join(", ")}`);
  const picked = servicesFor(shop, wanted, locationId);
  if (picked.length !== wanted.length) throw new Error("Unknown service");
  // Time: scheduledAt (ms) or date + time (Manila). Must be a free slot.
  const at = input.scheduledAt != null ? Number(input.scheduledAt) : input.date && input.time ? manilaAt(s(input.date, 10), s(input.time, 5)) : NaN;
  if (!Number.isFinite(at)) throw new Error("date and time (or scheduledAt) are required");
  const ymd = manilaYmd(at);
  if (at > Date.now() + 15 * 86_400_000) throw new Error("Pick a time in the next two weeks.");
  const barberId = s(input.barberId, 80) || undefined;
  const slots = await homeSlotsFor(shopId, locationId, ymd, barberId);
  if (!slots.some((x) => x.scheduledAt === at)) throw new Error("That time isn’t available. Fetch the slots and pick another.");
  const barbers = await homeBarbers(shopId, locationId, cfg);
  const barber = barberId ? barbers.find((b) => b.id === barberId) : undefined;
  if (barberId && !barber) throw new Error("That barber doesn’t do home visits here.");

  const fee = cfg.fee * 100;
  const now = Date.now();
  const row: ChairRequest = {
    id: `river-${randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "x")}`, shopId, ref: refCode(), channel: "online", status: "requested",
    contact: s(input.contact, 120), customerLabel: name, serviceId: picked[0]!.id, serviceName: picked.map((p) => p.name).join(" · "),
    price: picked.reduce((sum, p) => sum + p.price, 0) + fee,
    slotLabel: new Date(at).toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    payWhere: input.payWhere === "online" ? "online" : "shop", createdAt: now, updatedAt: now, source: "river",
    scheduledAt: at, home: { address, lat, lng, distanceKm: dist, ...(s(input.notes, 300) ? { notes: s(input.notes, 300) } : {}) }, homeFee: fee,
  };
  if (locationId !== "home") row.locationId = locationId;
  if (input.payPref === "cash" || input.payPref === "online" || input.payPref === "gcash" || input.payPref === "maya") row.payPref = input.payPref;
  if (input.externalId) row.externalId = s(input.externalId, 120);
  if (barber) { row.barberId = barber.id; row.barberName = barber.name; }
  await shopRef(shopId).collection("bookings").doc(row.id).set(row);
  await (await import("./activity")).logActivity(shopId, { type: "booking_requested", actor: { name, role: "customer" }, locationId, ref: row.ref, amount: row.price,
    text: `${name} booked Home service: ${row.serviceName} · ${row.slotLabel} (River app)` }, true);
  void (await import("./notify")).notifyNewOnlineBooking(shopId, { ref: row.ref, customerLabel: name, serviceName: row.serviceName, slotLabel: row.slotLabel, locationId, shopName: shop.name, homeAddress: address });
  return row;
}

export { shopDoc as homeShopDoc };
