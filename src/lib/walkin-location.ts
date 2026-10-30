import { HOME_LOCATION_ID } from "@/lib/shop-locations";

/**
 * v1.0.28 (Jimboy): where an owner walk-in is saved. One shop → the main shop; a branch selected → that branch;
 * "All locations" → nothing until the owner picks one (needsPick), never a silent default.
 */
export function walkInLocation(loc: { enabled: boolean; viewingAll: boolean; scopeId: string | null; branches: { id: string }[] }, picked = "") {
  if (!loc.enabled) return { locationId: HOME_LOCATION_ID as string, needsPick: false };
  if (picked && loc.branches.some((b) => b.id === picked)) return { locationId: picked, needsPick: false };
  if (loc.viewingAll || !loc.scopeId) return { locationId: null, needsPick: true };
  return { locationId: loc.scopeId, needsPick: false };
}
