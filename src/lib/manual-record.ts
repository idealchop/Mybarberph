/**
 * Records the owner adds by hand from the Weekly Profit Report (e.g. encoded later when the shop was offline).
 * Times are Manila (UTC+8, no DST). A record is a finished walk-in whose completedAt (and createdAt) is on the
 * picked Manila day, so Sales and the profit report count it on that day.
 */
export const MANUAL_SOURCE = "manual";
/** How far back a record can be added (the profit report goes back 8 weeks). */
export const MANUAL_MAX_DAYS = 70;
const DAY = 86_400_000;

/** Unix ms for a Manila date (YYYY-MM-DD) and time (HH:MM), or null when either is malformed. */
export function manilaTime(day: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const ms = Date.parse(`${day}T${time}:00+08:00`);
  return Number.isFinite(ms) && new Date(ms + 8 * 3600_000).toISOString().slice(0, 10) === day ? ms : null;
}

/** Manual records are always paid at the shop, in cash or GCash (never unpaid). */
export const manualPayError = (r: { paid?: boolean; payMethod?: string }) => (r.paid === true && (r.payMethod === "cash" || r.payMethod === "gcash") ? "" : "A record added by hand must be paid in Cash or GCash.");

/** Why a manual time can't be used ("" = fine): not in the future, and not older than MANUAL_MAX_DAYS. */
export function manualTimeError(at: number | null, now = Date.now()): string {
  if (at == null) return "Pick a valid time.";
  if (at > now + 60_000) return "That time hasn't happened yet.";
  if (at < now - MANUAL_MAX_DAYS * DAY) return `Records can be added up to ${MANUAL_MAX_DAYS} days back.`;
  return "";
}

/** Default time for the add form: now on today, 12:00 on a past day. */
export function defaultManualTime(day: string, now = Date.now()) {
  const today = new Date(now + 8 * 3600_000).toISOString();
  return today.slice(0, 10) === day ? today.slice(11, 16) : "12:00";
}

export interface ManualRecordInput {
  day: string; time: string; barberId: string; barberName: string; locationId: string;
  serviceName: string; price: number; payMethod: "cash" | "gcash"; customerLabel?: string; ref: string; shopId: string;
}

/** The booking row for a manual record (finished walk-in on that day), or an error message. */
export function manualRecord(i: ManualRecordInput, now = Date.now()) {
  const at = manilaTime(i.day, i.time);
  const err = manualTimeError(at, now);
  if (err) return { error: err } as const;
  if (i.payMethod !== "cash" && i.payMethod !== "gcash") return { error: "Pick Cash or GCash." } as const;
  return {
    row: {
      id: `wk-m${now}`, shopId: i.shopId, ref: i.ref, channel: "walk-in" as const, status: "done" as const, source: MANUAL_SOURCE,
      contact: "", customerLabel: i.customerLabel?.trim() || "Walk-in", serviceId: "haircut", serviceName: i.serviceName || "Haircut",
      price: Math.max(0, Math.round(i.price)), slotLabel: "Added", payWhere: "shop" as const, paid: true, payMethod: i.payMethod,
      barberId: i.barberId, barberName: i.barberName, locationId: i.locationId,
      createdAt: at!, startedAt: at!, completedAt: at!, updatedAt: now,
    },
  } as const;
}
