/** Structured opening hours (tap to set) plus the formatted line River Mobile and the API read. */
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABEL: Record<Day, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
export interface DayHours { open: boolean; from: string; to: string }
export type WeekHours = Record<Day, DayHours>;

/** 30-minute steps, "HH:MM" 24h. */
export const TIME_STEPS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

export function timeLabel(t: string) {
  const [h, m] = t.split(":").map(Number) as [number, number];
  const ap = h < 12 ? "AM" : "PM";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${ap}` : `${hh} ${ap}`;
}

export const week = (days: Day[], from = "09:00", to = "20:00"): WeekHours =>
  Object.fromEntries(DAYS.map((d) => [d, { open: days.includes(d), from, to }])) as WeekHours;

export const PRESETS: { id: string; label: string; hours: WeekHours }[] = [
  { id: "mon-sat", label: "Mon–Sat 9 AM–8 PM", hours: week(["mon", "tue", "wed", "thu", "fri", "sat"]) },
  { id: "everyday", label: "Everyday 9 AM–8 PM", hours: week([...DAYS]) },
  { id: "everyday-late", label: "Everyday 10 AM–10 PM", hours: week([...DAYS], "10:00", "22:00") },
];

/** "Mon–Sat 9 AM–8 PM", "Mon–Fri 9 AM–8 PM · Sat 10 AM–6 PM", "Everyday 9 AM–8 PM". Closed days are left out. */
export function formatHours(w: WeekHours): string {
  const groups: { start: Day; end: Day; range: string }[] = [];
  for (const d of DAYS) {
    const h = w[d];
    if (!h?.open) { groups.push({ start: d, end: d, range: "" }); continue; }
    const range = `${timeLabel(h.from)}–${timeLabel(h.to)}`;
    const last = groups[groups.length - 1];
    if (last && last.range === range) last.end = d; else groups.push({ start: d, end: d, range });
  }
  const open = groups.filter((g) => g.range);
  if (!open.length) return "Closed";
  if (open.length === 1 && open[0]!.start === "mon" && open[0]!.end === "sun") return `Everyday ${open[0]!.range}`;
  return open.map((g) => `${g.start === g.end ? DAY_LABEL[g.start] : `${DAY_LABEL[g.start]}–${DAY_LABEL[g.end]}`} ${g.range}`).join(" · ");
}

export function parseWeek(v: unknown): WeekHours | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, Partial<DayHours>>;
  const ok = (t: unknown) => typeof t === "string" && TIME_STEPS.includes(t);
  return Object.fromEntries(DAYS.map((d) => [d, { open: Boolean(o[d]?.open), from: ok(o[d]?.from) ? o[d]!.from! : "09:00", to: ok(o[d]?.to) ? o[d]!.to! : "20:00" }])) as WeekHours;
}
