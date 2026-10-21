/**
 * The owner cutting a walk-in himself (solo shops, or when every barber is busy). The visit is saved like
 * any barber's, with barberId "owner", so the Complete sheet, sales, tips and income split all just work
 * (no chair is taken, and the owner keeps 100%: there is no barber share).
 */
export const OWNER_BARBER_ID = "owner";

type Row = { status: string; barberId?: string; startedAt?: number; createdAt: number };

export const isOwnerCut = (r: { barberId?: string }) => r.barberId === OWNER_BARBER_ID;

/** The owner's own cut in progress (newest first), or null. */
export function ownerCut<T extends Row>(rows: T[]): T | null {
  return rows.filter((r) => r.status === "in_chair" && isOwnerCut(r)).sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))[0] ?? null;
}
