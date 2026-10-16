/**
 * Home service (River Mobile customers only). Pure helpers shared by the app and the server.
 * Stored in the shop state key "barbers.home-service" and mirrored onto shops/{id}.homeService.
 */
import { DAYS, type Day } from "@/lib/shop-hours";

export interface HomeLocationSettings {
  enabled: boolean;
  /** Flat home-service fee in pesos. */
  fee: number;
  radiusKm: number;
  /** Barber ids (chair.barberId || chair.id) who do home visits. Empty = any active barber at the location. */
  barberIds: string[];
  days: Day[];
  /** "HH:MM" 24h, Manila time. */
  from: string;
  to: string;
}
export interface HomeServiceFile {
  /** Service ids offered as home service (shop-wide): "haircut" and/or treatment ids. */
  serviceIds: string[];
  locations: Record<string, HomeLocationSettings>;
}
export type HomeStatus = "on_the_way" | "arrived";

export const HOME_KEY = "barbers.home-service";
export const DEFAULT_HOME_LOCATION: HomeLocationSettings = { enabled: false, fee: 150, radiusKm: 5, barberIds: [], days: ["mon", "tue", "wed", "thu", "fri", "sat"], from: "10:00", to: "18:00" };

const hm = (v: unknown, d: string) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
const ids = (v: unknown, max = 50) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[\w:-]{1,80}$/.test(x)).slice(0, max) : []);

export function parseHomeFile(raw: unknown): HomeServiceFile {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const locs = (o.locations && typeof o.locations === "object" ? o.locations : {}) as Record<string, Record<string, unknown>>;
  const locations: Record<string, HomeLocationSettings> = {};
  for (const [id, l] of Object.entries(locs).slice(0, 30)) {
    if (!/^[\w-]{1,60}$/.test(id) || !l) continue;
    locations[id] = {
      enabled: Boolean(l.enabled),
      fee: Math.min(100_000, Math.max(0, Math.round(Number(l.fee) || 0))),
      radiusKm: Math.min(50, Math.max(0.5, Number(l.radiusKm) || DEFAULT_HOME_LOCATION.radiusKm)),
      barberIds: ids(l.barberIds),
      days: (Array.isArray(l.days) ? l.days : []).filter((d): d is Day => (DAYS as readonly string[]).includes(d as string)),
      from: hm(l.from, DEFAULT_HOME_LOCATION.from),
      to: hm(l.to, DEFAULT_HOME_LOCATION.to),
    };
  }
  return { serviceIds: ids(o.serviceIds), locations };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Manila epoch ms for a date + "HH:MM". */
export const manilaAt = (ymd: string, t: string) => new Date(`${ymd}T${t}:00+08:00`).getTime();
export const manilaYmd = (ms: number) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
export const dayOf = (ymd: string): Day => DAYS[(new Date(`${ymd}T12:00:00+08:00`).getUTCDay() + 6) % 7]!;

/** 30-minute start times on that date inside the location's home hours, at least `leadMin` from now. */
export function homeSlots(s: HomeLocationSettings, ymd: string, now = Date.now(), leadMin = 60): string[] {
  if (!s.enabled || !s.days.includes(dayOf(ymd))) return [];
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const out: string[] = [];
  for (let m = Math.ceil(toMin(s.from) / 30) * 30; m + 30 <= toMin(s.to); m += 30) {
    const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    if (manilaAt(ymd, t) >= now + leadMin * 60_000) out.push(t);
  }
  return out;
}

export const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
