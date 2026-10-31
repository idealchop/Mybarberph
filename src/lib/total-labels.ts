/**
 * v1.0.35: owner totals say whose total they are, so a branch total is never read as one barber's count
 * (Boyet's home branch read 41 haircuts while Eddie had 36: the other 5 were Raymond Dias's).
 */
export type TotalScope = "shop" | "branch" | "all";

export function cutsLabel(n: number) {
  return `${n} haircut${n === 1 ? "" : "s"}`;
}

/** "Branch total", "All branches total", or "Shop total" (a shop without branches). */
export function totalLabel(scope: TotalScope) {
  return scope === "branch" ? "Branch total" : scope === "all" ? "All branches total" : "Shop total";
}

/** "41 haircuts · branch total" for an owner's whole-scope count. */
export function scopeCutsLabel(n: number, scope: TotalScope) {
  return `${cutsLabel(n)} · ${totalLabel(scope).toLowerCase()}`;
}

export function totalScope(o: { enabled: boolean; viewingAll: boolean }): TotalScope {
  return !o.enabled ? "shop" : o.viewingAll ? "all" : "branch";
}
