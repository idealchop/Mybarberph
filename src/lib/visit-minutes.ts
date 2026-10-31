import type { ChairRequest } from "@/lib/booking-types";

/** Whole minutes a visit took: start (in chair) → done; falls back to accepted/created time. null when unknown. */
export function visitMinutes(r: Pick<ChairRequest, "startedAt" | "verifiedAt" | "createdAt" | "completedAt">): number | null {
  const end = r.completedAt;
  const start = r.startedAt ?? r.verifiedAt ?? r.createdAt;
  if (!end || !start || end < start) return null;
  return Math.max(1, Math.round((end - start) / 60000));
}

/**
 * v1.0.36: "25 mins" / "1 min" under the time in the day sheet's Records: started → finished only (no fallback).
 * Empty when unknown, e.g. an owner-added record (no real start time).
 */
export function haircutMinutesLabel(r: Pick<ChairRequest, "startedAt" | "completedAt" | "source">): string {
  if (r.source === "manual" || !r.startedAt || !r.completedAt || r.completedAt <= r.startedAt) return "";
  const m = Math.max(1, Math.round((r.completedAt - r.startedAt) / 60000));
  return `${m} min${m === 1 ? "" : "s"}`;
}
