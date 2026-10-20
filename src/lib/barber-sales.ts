/** Per-barber sales for salary and remittance. Manila time (UTC+8, no DST); weeks run Monday to Sunday. */
export interface BarberSalesRow { barberId: string; barberName: string; locationId?: string; locationName?: string; cuts: number; gross: number; cash: number; gcash: number; online: number; unpaid: number; remit: number }
export interface BarberSales { range: "week" | "month" | "custom"; from: number; to: number; label: string; barbers: BarberSalesRow[]; total: BarberSalesRow }

const DAY = 86_400_000;
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const at = (d: string) => Date.parse(`${d}T00:00:00+08:00`);
const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

export function barberRange(range?: string | null, from?: string | null, to?: string | null, now = Date.now()) {
  const today = at(ymd(now));
  if (range === "custom" && from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const f = at(from);
    const t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? at(to) + DAY : today + DAY;
    const end = Math.max(f + DAY, Math.min(t, f + 366 * DAY));
    return { range: "custom" as const, from: f, to: end, label: `${fmt(f)} – ${fmt(end - DAY)}` };
  }
  if (range === "month") {
    const f = at(`${ymd(now).slice(0, 7)}-01`);
    return { range: "month" as const, from: f, to: today + DAY, label: new Date(f).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "long", year: "numeric" }) };
  }
  const dow = (new Date(today + 8 * 3600_000).getUTCDay() + 6) % 7; // Monday = 0
  const f = today - dow * DAY;
  return { range: "week" as const, from: f, to: f + 7 * DAY, label: `${fmt(f)} – ${fmt(f + 6 * DAY)}` };
}

export interface BarberPerformance {
  label: string; from: number; to: number;
  /** Collected by stored method. A paid visit with no method counts as cash (server rule); `other` is always 0. */
  cuts: number; sales: number; cash: number; gcash: number; online: number; other: number; unpaid: number; remit: number;
  avg: number; completionPct: number | null; declined: number;
  walkIns: number; onlineBookings: number;
  claimedCash: number; unclaimedCash: number;
  hours: { hour: number; cuts: number }[]; days: { day: string; cuts: number; sales: number }[];
  services: { name: string; cuts: number; sales: number }[];
  claims: { id: string; amount: number; count: number; claimedAt: number }[];
  /** Income split (owner sets the barber's %). Tips are separate and 100% the barber's. */
  sharePct?: number; barberShare?: number; shopShare?: number; tips?: number; tipCount?: number;
  /** Speed: average and fastest minutes from start to done, over cuts with a timer. */
  avgMins?: number | null; fastestMins?: number | null; timedCuts?: number;
}
