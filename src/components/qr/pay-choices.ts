export type PayChoice = "cash" | "online";

/** Booking pay choices (Jimboy, 2026-10-20): Cash or Online. Online stays even without a QR; the QR card shows only when uploaded. */
export function payChoices(): PayChoice[] {
  return ["cash", "online"];
}

/** Older bookings stored "gcash"/"maya": all of them are "online" now. */
export function isOnlineChoice(p: string | null | undefined) {
  return p === "online" || p === "gcash" || p === "maya";
}
