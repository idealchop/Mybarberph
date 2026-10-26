/** Owner profit report: one Manila week (Monday–Sunday), sales of finished cuts per barber per day. */

const DAY = 86_400_000;
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const at = (d: string) => Date.parse(`${d}T00:00:00+08:00`);
const noon = (ms: number) => new Date(ms + 12 * 3600_000);

export interface ProfitDay {
  key: string;
  /** Mon, Tue, … */
  dow: string;
  /** 10/25/2026 */
  date: string;
}

export interface ProfitRow {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  /** Sales (centavos) for each day of the week, Monday first. */
  days: number[];
  total: number;
}

export interface ProfitWeek {
  from: number;
  to: number;
  label: string;
  days: ProfitDay[];
  rows: ProfitRow[];
  daily: number[];
  total: number;
}

export interface ProfitChair {
  id: string;
  label: string;
  barberId?: string;
  barberName?: string;
  locationId?: string;
  active?: boolean;
}

export interface ProfitVisit {
  status?: string;
  completedAt?: number;
  price?: number;
  locationId?: string;
  barberId?: string;
  barberName?: string;
  seatLabel?: string;
  chairLabel?: string;
}

/** Monday 00:00 Manila of the week `offset` weeks from the week that contains `now`. `to` is the next Monday. */
export function weekBounds(offset = 0, now = Date.now()) {
  const today = at(ymd(now));
  const dow = (new Date(today + 8 * 3600_000).getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  const from = today - dow * DAY + offset * 7 * DAY;
  const days: ProfitDay[] = Array.from({ length: 7 }, (_, i) => {
    const ms = from + i * DAY;
    return {
      key: ymd(ms),
      dow: noon(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "short" }),
      date: noon(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "2-digit", day: "2-digit", year: "numeric" }),
    };
  });
  const startLabel = noon(from).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
  const end = noon(from + 6 * DAY);
  const sameMonth = noon(from).getUTCMonth() === end.getUTCMonth();
  const endLabel = end.toLocaleDateString("en-US", { timeZone: "Asia/Manila", ...(sameMonth ? {} : { month: "short" }), day: "numeric" });
  const year = noon(from + 6 * DAY).toLocaleDateString("en-US", { timeZone: "Asia/Manila", year: "numeric" });
  return { from, to: from + 7 * DAY, days, label: `${startLabel} – ${endLabel}, ${year}` };
}

function seatOf(r: ProfitVisit, chairs: ProfitChair[], loc: string) {
  return chairs.find((c) => c.label === (r.seatLabel || r.chairLabel) && (c.locationId || "home") === loc);
}

function rowName(id: string, visitName: string | undefined, chair?: ProfitChair) {
  if (id === "owner") return "You";
  const typed = visitName?.trim() || chair?.barberName?.trim();
  return typed || chair?.label || "No barber";
}

/**
 * Sales grid for one week. A cut counts on the Manila day it was finished.
 * `loc` is `"all"` or one shop id. Chairs with no cuts still appear, unless that chair is turned off.
 */
export function profitWeek(
  rows: ProfitVisit[],
  chairs: ProfitChair[],
  loc: string,
  offset = 0,
  now = Date.now(),
  branches: { id: string; name: string }[] = [],
): ProfitWeek {
  const bounds = weekBounds(offset, now);
  const place = (id: string) => branches.find((b) => b.id === id)?.name || "";
  const map = new Map<string, ProfitRow>();
  const ensure = (id: string, locationId: string, name: string) => {
    const key = `${id}@${locationId}`;
    let row = map.get(key);
    if (!row) {
      row = { id, name, locationId, locationName: place(locationId), days: [0, 0, 0, 0, 0, 0, 0], total: 0 };
      map.set(key, row);
    } else if (row.name === "No barber" && name && name !== "No barber") row.name = name;
    return row;
  };
  for (const c of chairs) {
    const bl = c.locationId || "home";
    if (loc !== "all" && bl !== loc) continue;
    if (c.active === false) continue;
    ensure(c.barberId || c.id, bl, rowName(c.barberId || c.id, c.barberName, c));
  }
  for (const r of rows) {
    if (r.status !== "done" || !r.completedAt || r.completedAt < bounds.from || r.completedAt >= bounds.to) continue;
    const bl = r.locationId || "home";
    if (loc !== "all" && bl !== loc) continue;
    const seat = seatOf(r, chairs, bl);
    const id = r.barberId || seat?.barberId || seat?.id || `seat:${bl}:${r.seatLabel || "-"}`;
    const day = Math.floor((r.completedAt - bounds.from) / DAY);
    if (day < 0 || day > 6) continue;
    const row = ensure(id, bl, rowName(id, r.barberName, seat));
    const amount = r.price || 0;
    row.days[day] = (row.days[day] ?? 0) + amount;
    row.total += amount;
  }
  const off = new Set(chairs.filter((c) => c.active === false).map((c) => `${c.barberId || c.id}@${c.locationId || "home"}`));
  const list = [...map.values()].filter((row) => row.total > 0 || !off.has(`${row.id}@${row.locationId}`));
  list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const daily = [0, 0, 0, 0, 0, 0, 0];
  for (const row of list) row.days.forEach((n, i) => { daily[i] = (daily[i] ?? 0) + n; });
  return { ...bounds, rows: list, daily, total: daily.reduce((s, n) => s + n, 0) };
}

/** Short amount for tight grids: 980 → "980", 1,600 → "1.6k", 12,400 → "12k" (pesos, from centavos). */
export function compactPeso(centavos: number): string {
  const v = Math.round(centavos / 100);
  if (Math.abs(v) < 1000) return String(v);
  const k = v / 1000;
  return `${Math.abs(k) < 10 ? Math.round(k * 10) / 10 : Math.round(k)}k`;
}
