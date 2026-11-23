import type { ChairRequest, ChairStatus } from "@/lib/booking-types";

/**
 * River Partner API v1 status contract (docs/partner-api/mapping.md in idealchop/River-Mobile-App).
 * Barbers.ph keeps its own words internally; River Mobile sees the shared set.
 */
export type PublicStatus = "requested" | "accepted" | "in_progress" | "ready" | "completed" | "declined" | "cancelled";

/** New River Mobile tickets. Older spellings still count as River Mobile tickets (get, cancel, check-in, Queue → Online). */
export const RIVER_MOBILE_SOURCE = "river_mobile";
const RIVER_SOURCES = new Set([RIVER_MOBILE_SOURCE, "river", "river_mobile_api", "river-mobile"]);
export const isRiverSource = (source: string | undefined | null): boolean => Boolean(source && RIVER_SOURCES.has(source));

/** in_chair → in_progress, done → completed. Barbers.ph has no "ready" state, so it is never sent. */
export function publicStatus(status: ChairStatus): PublicStatus {
  switch (status) {
    case "in_chair": return "in_progress";
    case "done": return "completed";
    case "accepted": return "accepted";
    case "declined": return "declined";
    case "cancelled": return "cancelled";
    default: return "requested";
  }
}

/** Customer cancel (River Mobile) is allowed only before the cut starts. */
export const canCustomerCancel = (status: ChairStatus) => status === "requested" || status === "accepted";

/** Final states: nothing moves a booking forward from here. */
export const isClosedStatus = (status: ChairStatus) => status === "done" || status === "declined" || status === "cancelled";

/**
 * Webhook event type for a status change, or null when there is nothing to send. `requested` has no event
 * in the contract (the Bridge created the order itself), and an unchanged status sends nothing.
 */
export function webhookEventType(prev: ChairStatus | undefined, next: ChairStatus): `order.${Exclude<PublicStatus, "requested">}` | null {
  if (prev === next) return null;
  const s = publicStatus(next);
  if (s === "requested") return null;
  if (prev && publicStatus(prev) === s) return null;
  return `order.${s}`;
}

/** Deterministic event id (also the Idempotency-Key): one event per order per public status. */
export const webhookEventId = (bookingId: string, status: ChairStatus) => `barbers.${bookingId}.${publicStatus(status)}`;

/** The contract's Order shape for one ticket. Money is centavos. */
export function toOrder(b: ChairRequest) {
  return {
    orderId: b.id,
    shopId: b.shopId,
    reference: b.ref,
    status: publicStatus(b.status),
    source: RIVER_MOBILE_SOURCE,
    totalCentavos: Math.max(0, Math.round(b.price || 0)),
    currency: "PHP",
    updatedAt: new Date(b.updatedAt || b.createdAt || Date.now()).toISOString(),
  };
}
