/**
 * Owner profit report: one Manila week (Monday–Sunday), the owner's share of finished cuts per barber per day.
 * Each cut counts price minus the barber's income split (same as Sales → "Your commission" and Claim amounts);
 * no split set = the whole price is the owner's; the owner's own cuts are all the owner's. Tips are never counted.
 */
import { ownerShareOf, sharePct, visitPct } from "@/lib/income-split";
import { cutBarberId, UNASSIGNED, UNASSIGNED_NAME } from "@/lib/cut-count";


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
  /** Owner's share (centavos) for each day of the week, Monday first. */
  days: number[];
  total: number;
  /** v1.0.35: another barber row has the same name: always show the branch next to it. */
  sameName?: boolean;
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
  vacantAt?: number;
  sharePct?: unknown;
  shareSet?: unknown;
}

export interface ProfitVisit {
  splitPct?: number | null;
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

function rowName(id: string, visitName: string | undefined, chair?: ProfitChair) {
  if (id === "owner") return "You";
  if (id === UNASSIGNED) return UNASSIGNED_NAME;
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
  return { ...bounds, ...profitGrid(rows, chairs, loc, bounds.from, bounds.to, 7, (ms) => Math.floor((ms - bounds.from) / DAY), branches) };
}

/** Core grid: owner share per barber per column. `colOf` maps a completion time to its column (0…cols-1). */
function profitGrid(
  rows: ProfitVisit[], chairs: ProfitChair[], loc: string, from: number, to: number, cols: number, colOf: (ms: number) => number,
  branches: { id: string; name: string }[],
): { rows: ProfitRow[]; daily: number[]; total: number } {
  const bounds = { from, to };
  const place = (id: string) => branches.find((b) => b.id === id)?.name || "";
  const map = new Map<string, ProfitRow>();
  const ensure = (id: string, locationId: string, name: string) => {
    const key = `${id}@${locationId}`;
    let row = map.get(key);
    if (!row) {
      row = { id, name, locationId, locationName: place(locationId), days: Array(cols).fill(0), total: 0 };
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
    const id = cutBarberId(r, chairs);
    const day = colOf(r.completedAt);
    if (day < 0 || day >= cols) continue;
    const row = ensure(id, bl, rowName(id, r.barberName, chairs.find((c) => (c.barberId || c.id) === id && (c.locationId || "home") === bl) ?? chairs.find((c) => (c.barberId || c.id) === id)));
    const chair = id === "owner" ? undefined : chairs.find((c) => (r.barberId && (c.barberId === r.barberId || c.id === r.barberId)) && (c.locationId || "home") === bl)
      ?? chairs.find((c) => r.barberId && (c.barberId === r.barberId || c.id === r.barberId));
    const amount = ownerShareOf(r.price || 0, id === "owner" ? null : visitPct(r, chair ? sharePct(chair) : null));
    row.days[day] = (row.days[day] ?? 0) + amount;
    row.total += amount;
  }
  const off = new Set(chairs.filter((c) => c.active === false).map((c) => `${c.barberId || c.id}@${c.locationId || "home"}`));
  const vacant = new Set(chairs.filter((c) => !!c.vacantAt).map((c) => `${c.barberId || c.id}@${c.locationId || "home"}`));
  // v1.0.35: a barber flagged vacantAt internally is listed only when they have haircuts in the period.
  const list = [...map.values()].filter((row) => row.total > 0 || (!off.has(`${row.id}@${row.locationId}`) && !vacant.has(`${row.id}@${row.locationId}`)));
  markSameNames(list, chairs);
  list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const daily: number[] = Array(cols).fill(0);
  for (const row of list) row.days.forEach((n, i) => { daily[i] = (daily[i] ?? 0) + n; });
  return { rows: list, daily, total: daily.reduce((s, n) => s + n, 0) };
}

/** Short amount for tight grids: 980 → "980", 1,600 → "1.6k", 12,400 → "12k" (pesos, from centavos). */
export function compactPeso(centavos: number): string {
  const v = Math.round(centavos / 100);
  if (Math.abs(v) < 1000) return String(v);
  const k = v / 1000;
  return `${Math.abs(k) < 10 ? Math.round(k * 10) / 10 : Math.round(k)}k`;
}

export interface ProfitGroup {
  id: string;
  name: string;
  rows: ProfitRow[];
  /** Subtotal of the rows above, per day (Monday first) and for the week. */
  days: number[];
  total: number;
}

/**
 * Rows grouped like the Sales → "Sales group" tab: one section per saved group, in the owner's order and names.
 * A barber is in a group when their branch is one of its locations or they were added by name (the same rule as Sales).
 * Groups with no barbers this week are left out; barbers in no group come last under "Not in a group".
 * A barber in two groups shows in both, so subtotals can overlap; the overall Totals row is unchanged.
 */
export function groupProfitRows(rows: ProfitRow[], groups: { id: string; name: string; locationIds: string[]; barberIds: string[] }[]): ProfitGroup[] {
  const make = (id: string, name: string, list: ProfitRow[]): ProfitGroup => {
    const days: number[] = Array(list[0]?.days.length ?? 7).fill(0);
    for (const r of list) r.days.forEach((n, i) => { days[i] = (days[i] ?? 0) + n; });
    return { id, name, rows: list, days, total: days.reduce((s, n) => s + n, 0) };
  };
  const placed = new Set<ProfitRow>();
  const out: ProfitGroup[] = [];
  for (const g of groups) {
    const list = rows.filter((r) => g.locationIds.includes(r.locationId) || g.barberIds.includes(r.id));
    if (!list.length) continue;
    list.forEach((r) => placed.add(r));
    out.push(make(g.id, g.name, list));
  }
  const rest = rows.filter((r) => !placed.has(r));
  if (rest.length) out.push(make("none", "Not in a group", rest));
  return out;
}

export interface ProfitMonthWeek { key: string; label: string; range: string; from: number; to: number }
export interface ProfitMonth {
  from: number; to: number; label: string; month: string; weeks: ProfitMonthWeek[]; rows: ProfitRow[]; daily: number[]; total: number;
  /** Calendar: one entry per day of the month (YYYY-MM-DD), and each barber's owner share per day (same order). */
  dates: string[]; byDay: ProfitRow[]; dayTotals: number[];
  /** Blank cells before day 1 in a Monday-first calendar (0 = the 1st is a Monday). */
  lead: number;
}

/**
 * Month view: one Manila calendar month (`offset` months from the month containing `now`), one column per
 * Monday–Sunday week clipped to the month (W1…W5/W6). Same owner-share rule as the week grid.
 */
export function profitMonth(
  rows: ProfitVisit[], chairs: ProfitChair[], loc: string, offset = 0, now = Date.now(), branches: { id: string; name: string }[] = [],
): ProfitMonth {
  const [y, m] = ymd(now).slice(0, 7).split("-").map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + offset;
  const yy = Math.floor(idx / 12), mm = (idx % 12) + 1;
  const key = (a: number, b: number) => `${a}-${String(b).padStart(2, "0")}`;
  const from = at(`${key(yy, mm)}-01`);
  const to = at(`${key(Math.floor((idx + 1) / 12), ((idx + 1) % 12) + 1)}-01`);
  const short = (ms: number) => noon(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", day: "numeric" });
  const weeks: ProfitMonthWeek[] = [];
  for (let s = from; s < to;) {
    const dow = (new Date(s + 8 * 3600_000).getUTCDay() + 6) % 7;
    const e = Math.min(to, s + (7 - dow) * DAY);
    weeks.push({ key: ymd(s), label: `W${weeks.length + 1}`, range: `${short(s)}–${short(e - DAY)}`, from: s, to: e });
    s = e;
  }
  const colOf = (ms: number) => weeks.findIndex((w) => ms >= w.from && ms < w.to);
  const grid = profitGrid(rows, chairs, loc, from, to, weeks.length, colOf, branches);
  const label = noon(from).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "long", year: "numeric" });
  const n = Math.round((to - from) / DAY);
  const dates = Array.from({ length: n }, (_, i) => ymd(from + i * DAY));
  const days = profitGrid(rows, chairs, loc, from, to, n, (ms) => Math.floor((ms - from) / DAY), branches);
  const lead = (new Date(from + 8 * 3600_000).getUTCDay() + 6) % 7;
  return { from, to, label, month: key(yy, mm), weeks, ...grid, dates, byDay: days.rows, dayTotals: days.daily, lead };
}

/** One day's amounts from a month calendar: each barber with their owner share that day (only barbers with sales, highest first). */
export function dayBreakdown(m: Pick<ProfitMonth, "dates" | "byDay">, date: string): ProfitRow[] {
  const i = m.dates.indexOf(date);
  if (i < 0) return [];
  return m.byDay.map((r) => ({ ...r, days: [r.days[i] ?? 0], total: r.days[i] ?? 0 })).filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** v1.0.29 owner chart order: the table's rows, highest first; zero-sales barbers last (muted). Never recomputes amounts. */
export interface ProfitRanking { ranked: ProfitRow[]; zero: ProfitRow[]; top: ProfitRow | null; lowest: ProfitRow | null; max: number }
export function rankProfitRows(rows: ProfitRow[]): ProfitRanking {
  const byTotal = (a: ProfitRow, b: ProfitRow) => b.total - a.total || a.name.localeCompare(b.name);
  const ranked = rows.filter((r) => r.total > 0).sort(byTotal);
  const zero = rows.filter((r) => r.total <= 0).sort((a, b) => a.name.localeCompare(b.name));
  return { ranked, zero, top: ranked[0] ?? null, lowest: ranked.length > 1 ? ranked[ranked.length - 1]! : null, max: ranked[0]?.total ?? 0 };
}

/**
 * v1.0.35: flag rows whose barber name matches another barber (any branch, case-insensitive), so screens show the
 * branch next to each one (two "Raymond Dias" barbers looked identical in Add record).
 */
export function markSameNames<T extends { id: string; name: string; locationId: string; sameName?: boolean }>(rows: T[], chairs: { id: string; barberId?: string; barberName?: string; label?: string; locationId?: string }[] = []): T[] {
  const keys = new Map<string, Set<string>>();
  const add = (name: string | undefined, key: string) => { const n = name?.trim().toLowerCase(); if (!n) return; const s = keys.get(n) ?? new Set<string>(); s.add(key); keys.set(n, s); };
  for (const c of chairs) add(c.barberName || c.label, `${c.barberId || c.id}@${c.locationId || "home"}`);
  for (const r of rows) add(r.name, `${r.id}@${r.locationId}`);
  for (const r of rows) r.sameName = (keys.get(r.name.trim().toLowerCase())?.size ?? 0) > 1;
  return rows;
}
