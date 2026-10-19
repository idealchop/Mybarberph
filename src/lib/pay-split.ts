import type { PayMethod } from "@/lib/booking-types";

/**
 * Payment-method split for collected (paid) visits.
 * Uses only the method stored on the visit. A paid visit with no stored method is
 * "other" — never guessed as cash. (Remit still follows the server rule in
 * lib/server/remit.ts, where a paid visit with no method counts as cash to hand over.)
 */
export type PayBucket = PayMethod | "other";
export interface PaySplit { cash: number; gcash: number; online: number; other: number }

export const PAY_LABEL: Record<PayBucket, string> = { cash: "Cash", gcash: "GCash", online: "Online", other: "Other" };

type Payable = { paid?: boolean; payMethod?: PayMethod | null; price?: number };

/** Which bucket a paid visit's money belongs to. */
export function payBucket(r: Payable): PayBucket {
  return r.payMethod === "cash" || r.payMethod === "gcash" || r.payMethod === "online" ? r.payMethod : "other";
}

/** "Cash" | "GCash" | "Online" | "Other" for a paid visit; null when unpaid. */
export function payMethodLabel(r: Payable): string | null {
  return r.paid ? PAY_LABEL[payBucket(r)] : null;
}

export const emptySplit = (): PaySplit => ({ cash: 0, gcash: 0, online: 0, other: 0 });

/** Adds one visit's price to the split when it is paid. */
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
