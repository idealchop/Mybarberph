import type { ChairRequest } from "@/lib/booking-types";
import { sharePct, splitIncome, tipOf } from "@/lib/income-split";

/** Sales groups (Jimboy, 2026-10-21): the owner groups locations and barbers to see their combined sales. */
export interface SalesGroup { id: string; name: string; locationIds: string[]; barberIds: string[] }
export const SALES_GROUPS_KEY = "barbers.sales-groups";

/** Groups 1–3 always exist; saved names and members are kept. */
export function normalizeGroups(raw: unknown): SalesGroup[] {
  const saved = Array.isArray(raw) ? (raw as Partial<SalesGroup>[]) : [];
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length < 80))] : []);
  const base = [1, 2, 3].map((n) => {
    const s = saved.find((g) => g?.id === `g${n}`);
    return { id: `g${n}`, name: (typeof s?.name === "string" && s.name.trim().slice(0, 40)) || `Group ${n}`, locationIds: ids(s?.locationIds), barberIds: ids(s?.barberIds) };
  });
  return base;
}

type ChairLite = { id: string; label: string; barberId?: string; barberName?: string; locationId?: string; sharePct?: number };
export interface GroupLine { id: string; name: string; sub?: string; cuts: number; gross: number; net: number; tips: number }
export interface GroupReport { cuts: number; gross: number; net: number; share: number; tips: number; locations: GroupLine[]; barbers: GroupLine[] }

const loc = (r: ChairRequest) => r.locationId || "home";

/**
 * A group's finished visits: any visit at one of its locations, or by one of its barbers (counted once).
 * `net` = gross minus each barber's share (their chair's %). Tips are separate and all the barber's.
 */
export function groupReport(rows: ChairRequest[], g: SalesGroup, chairs: ChairLite[], names: { loc: (id: string) => string }): GroupReport {
  const seatOf = (r: ChairRequest) => chairs.find((c) => c.label === (r.seatLabel || r.chairLabel) && (c.locationId || "home") === loc(r));
  const keyOf = (r: ChairRequest) => { const s = seatOf(r); return r.barberId || s?.barberId || s?.id || ""; };
  const chairFor = (key: string) => chairs.find((c) => (c.barberId || c.id) === key || c.id === key);
  const inGroup = (r: ChairRequest) => g.locationIds.includes(loc(r)) || (keyOf(r) !== "" && g.barberIds.includes(keyOf(r)));
  const out: GroupReport = { cuts: 0, gross: 0, net: 0, share: 0, tips: 0, locations: [], barbers: [] };
  const L = new Map<string, GroupLine>(), B = new Map<string, GroupLine>();
  for (const r of rows) {
    if (r.status !== "done" || !inGroup(r)) continue;
    const key = keyOf(r);
    const gross = r.price || 0;
    const { barber } = splitIncome(gross, sharePct(chairFor(key)));
    const tip = tipOf(r);
    out.cuts += 1; out.gross += gross; out.share += barber; out.net += gross - barber; out.tips += tip;
    const l = L.get(loc(r)) ?? { id: loc(r), name: names.loc(loc(r)), cuts: 0, gross: 0, net: 0, tips: 0 };
    l.cuts += 1; l.gross += gross; l.net += gross - barber; l.tips += tip; L.set(l.id, l);
    const bk = key || `seat:${loc(r)}:${r.seatLabel || "-"}`;
    const b = B.get(bk) ?? { id: bk, name: r.barberName || chairFor(key)?.barberName || r.seatLabel || "No barber", sub: names.loc(loc(r)), cuts: 0, gross: 0, net: 0, tips: 0 };
    b.cuts += 1; b.gross += gross; b.net += gross - barber; b.tips += tip; B.set(bk, b);
  }
  out.locations = [...L.values()].sort((a, b) => b.gross - a.gross);
  out.barbers = [...B.values()].sort((a, b) => b.gross - a.gross);
  return out;
}

/** Tap to add / tap again to remove. */
export function toggleMember(g: SalesGroup, kind: "loc" | "barber", id: string): SalesGroup {
  const k = kind === "loc" ? "locationIds" : "barberIds";
  const has = g[k].includes(id);
  return { ...g, [k]: has ? g[k].filter((x) => x !== id) : [...g[k], id] };
}
