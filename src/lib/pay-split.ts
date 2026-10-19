import type { PayMethod } from "@/lib/booking-types";

/**
 * Payment-method split for collected (paid) visits.
 * A paid visit with no stored method counts as **Cash**, the same rule the server uses for remit
 * (lib/server/remit.ts) and when saving (putBooking). Jimboy's decision, 2026-10-20: labels and totals match the server.
 * `other` stays in the shape for older callers but is always 0.
 */
export type PayBucket = PayMethod | "other";
export interface PaySplit { cash: number; gcash: number; online: number; other: number }

export const PAY_LABEL: Record<PayBucket, string> = { cash: "Cash", gcash: "GCash", online: "Online", other: "Other" };

type Payable = { paid?: boolean; payMethod?: PayMethod | null; price?: number };

/** Which bucket a paid visit's money belongs to (no stored method = cash). */
export function payBucket(r: Payable): PayBucket {
  return r.payMethod === "gcash" || r.payMethod === "online" ? r.payMethod : "cash";
}

/** "Cash" | "GCash" | "Online" for a paid visit; null when unpaid. */
export function payMethodLabel(r: Payable): string | null {
  return r.paid ? PAY_LABEL[payBucket(r)] : null;
}

export const emptySplit = (): PaySplit => ({ cash: 0, gcash: 0, online: 0, other: 0 });

/** Adds one paid visit's price to the split. */
export function addToSplit(s: PaySplit, r: Payable) {
  if (r.paid) s[payBucket(r)] += r.price || 0;
  return s;
}

export function paySplit(rows: Payable[]): PaySplit {
  return rows.reduce(addToSplit, emptySplit());
}

/** Lines to show: Cash and GCash always; Online and Other only when there is money in them. */
export function splitParts(s: PaySplit): { key: PayBucket; label: string; value: number }[] {
  return (["cash", "gcash", "online", "other"] as const)
    .filter((k) => k === "cash" || k === "gcash" || s[k] > 0)
    .map((k) => ({ key: k, label: PAY_LABEL[k], value: s[k] }));
}
