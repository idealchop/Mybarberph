import { cellAdjustments, withCellAdjustments, type CellDelta } from "@/lib/claim-adjusts";
import { remitKey } from "@/lib/profit-claim";
import type { Remit } from "./use-remit";

type V = Parameters<typeof remitKey>[0];
type C = Parameters<typeof remitKey>[1];
const manilaDay = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);

/** v1.0.40: grid cell → amount to add so it shows the saved To claim edit (open days) or the adjusted claim (claimed days). */
export function claimCells(remit: Remit | null, rows: V[], chairs: C, claimMap: Map<string, { openOwner: number }> | null) {
  if (!remit) return new Map<string, CellDelta>();
  const byId = new Map(rows.map((r) => [r.id, r]));
  return cellAdjustments(remit.adjusts, remit.claims, (k) => claimMap?.get(k)?.openOwner ?? 0, (id) => {
    const r = byId.get(id); if (!r) return null;
    const k = remitKey(r, chairs);
    return `${k.id}@${k.loc}|${manilaDay(r.completedAt ?? r.updatedAt ?? 0)}`;
  });
}
export { withCellAdjustments };
