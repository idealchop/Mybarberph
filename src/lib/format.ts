import type { Centavos, PaymentMethod } from "@/data";

/** ₱18,450 from 1845000 centavos (keeps cents only when present). */
export function peso(c: Centavos, opts: { signed?: boolean } = {}): string {
  const v = c / 100;
  const s = v.toLocaleString("en-PH", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  return `${opts.signed && c > 0 ? "+" : ""}₱${s}`;
}

/** "6:36 PM" in Asia/Manila. */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}
/** "6:36" (no AM/PM) for compact queue cells. */
export function clockShort(iso: string): string {
  return clock(iso).replace(/\s?[AP]M$/, "");
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = { cash: "Cash", gcash: "GCash", maya: "Maya", card: "Card" };

/** "Caloy" from "Carlo “Caloy” Santos"; first word otherwise. */
export function firstName(name: string) {
  const m = name.match(/“(.+?)”/);
  return m ? m[1]! : name.split(" ")[0]!;
}

export function initialsShort(name: string) {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]}.` : name;
}

/** Compact service label for tight rows ("Skin fade + beard trim" → "Fade + beard"). */
export function shortService(label: string) {
  const map: Record<string, string> = { "Skin fade + beard trim": "Fade + beard", "Haircut + hot towel": "Cut + hot towel" };
  return map[label] ?? label;
}

/** "Andrei M." */
export function shortName(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]}.` : name;
}

/**
 * "avg wait" shown in headers. Mock heuristic: three quarters of the mean current estimate (people at the
 * end of the line rarely wait the full estimate). A backend would report the measured average instead.
 */
export function avgWaitMins(estimates: number[]) {
  return Math.round((estimates.reduce((a, n) => a + n, 0) / Math.max(1, estimates.length)) * 0.75);
}
