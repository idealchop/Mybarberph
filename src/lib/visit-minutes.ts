import type { ChairRequest } from "@/lib/booking-types";

/** Whole minutes a visit took: start (in chair) → done; falls back to accepted/created time. null when unknown. */
export function visitMinutes(r: Pick<ChairRequest, "startedAt" | "verifiedAt" | "createdAt" | "completedAt">): number | null {
  const end = r.completedAt;
  const start = r.startedAt ?? r.verifiedAt ?? r.createdAt;
  if (!end || !start || end < start) return null;
  return Math.max(1, Math.round((end - start) / 60000));
}
