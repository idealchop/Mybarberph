import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { ChairRequest } from "@/lib/booking-types";
import { canCustomerCancel, isRiverSource } from "@/lib/river-status";
import { bumpQueueRev, getBooking, shopRef, verifyBooking } from "./shops";

/**
 * River Mobile order lookup by the id the API returned at create time. Tickets live at
 * shops/{shopId}/bookings/{id}; riverOrders/{id} → { shopId } is a server-only pointer written at create
 * (one small doc, no index needed). Tickets made before this pointer existed can pass `shopId` as a hint.
 */
export const ORDER_INDEX = "riverOrders";
const ID = /^[\w-]{3,80}$/;

export async function rememberRiverOrder(shopId: string, bookingId: string) {
  try {
    await adminDb().collection(ORDER_INDEX).doc(bookingId).set({ shopId, createdAt: Date.now() });
  } catch (e) { console.error("river order index write failed", (e as Error).message); }
}

async function shopIdFor(orderId: string, hint?: string): Promise<string | null> {
  const d = (await adminDb().collection(ORDER_INDEX).doc(orderId).get()).data() as { shopId?: string } | undefined;
  if (d?.shopId) return d.shopId;
  return hint && /^[\w-]{6,128}$/.test(hint) ? hint : null;
}

/** A River Mobile ticket (any River source spelling), or null. */
export async function findRiverOrder(orderId: string, shopHint?: string): Promise<ChairRequest | null> {
  if (!ID.test(orderId)) return null;
  const shopId = await shopIdFor(orderId, shopHint);
  if (!shopId) return null;
  const b = await getBooking(shopId, orderId);
  return b && isRiverSource(b.source) ? b : null;
}

export type CancelResult =
  | { kind: "not_found" }
  | { kind: "conflict"; booking: ChairRequest }
  | { kind: "ok"; booking: ChairRequest; changed: boolean };

/** Customer cancel while requested or accepted. Already cancelled → ok (unchanged). Anything else → conflict. */
export async function cancelRiverOrder(orderId: string, reason?: string, shopHint?: string): Promise<CancelResult> {
  const found = await findRiverOrder(orderId, shopHint);
  if (!found) return { kind: "not_found" };
  const ref = shopRef(found.shopId).collection("bookings").doc(found.id);
  const res = await adminDb().runTransaction(async (tx): Promise<CancelResult & { before?: ChairRequest }> => {
    const cur = (await tx.get(ref)).data() as ChairRequest | undefined;
    if (!cur || !isRiverSource(cur.source)) return { kind: "not_found" };
    if (cur.status === "cancelled") return { kind: "ok", booking: cur, changed: false };
    if (!canCustomerCancel(cur.status)) return { kind: "conflict", booking: cur };
    const now = Date.now();
    const next: ChairRequest = { ...cur, status: "cancelled", cancelledAt: now, updatedAt: now };
    const why = typeof reason === "string" ? reason.trim().slice(0, 200) : "";
    if (why) next.cancelReason = why;
    tx.set(ref, next);
    return { kind: "ok", booking: next, changed: true, before: cur };
  });
  if (res.kind === "ok" && res.changed) {
    const b = res.booking;
    await bumpQueueRev(b.shopId);
    await (await import("./activity")).logActivity(b.shopId, { type: "booking_cancelled", actor: { name: b.customerLabel || "Customer", role: "customer" }, locationId: b.locationId || "home", ref: b.ref,
      text: `${b.customerLabel || "Customer"} cancelled booking ${b.ref} (River app)` }, true);
    await (await import("./river-bridge/webhooks")).emitStatusWebhook(res.before, b);
  }
  if (res.kind === "ok") return { kind: "ok", booking: res.booking, changed: res.changed };
  return res.kind === "conflict" ? { kind: "conflict", booking: res.booking } : { kind: "not_found" };
}

export type CheckInResult = { kind: "not_found" } | { kind: "conflict"; reason: string } | { kind: "ok"; booking: ChairRequest };

/** Check-in by order id: the same verify logic as POST /shops/{shopId}/verify, with the ticket ref as code. */
export async function checkInRiverOrder(orderId: string, code?: string, shopHint?: string): Promise<CheckInResult> {
  const b = await findRiverOrder(orderId, shopHint);
  if (!b) return { kind: "not_found" };
  if (code && code.trim().toUpperCase() !== b.ref) return { kind: "conflict", reason: "code_mismatch" };
  const r = await verifyBooking(b.shopId, b.ref);
  if (!r.ok) return r.reason === "not_found" ? { kind: "not_found" } : { kind: "conflict", reason: r.reason };
  return { kind: "ok", booking: r.booking };
}
