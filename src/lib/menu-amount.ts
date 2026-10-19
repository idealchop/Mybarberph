/**
 * Amounts a barber link may save. Mirrors the server rule in lib/server/shops.ts (barberPrice):
 * a barber can't change the amount; it is the menu price of the visit's services, plus any home-service fee.
 */
import type { ChairRequest } from "@/lib/booking-types";

/** Client menu items carry prices in pesos. */
type MenuItem = { name: string; price?: number };

/** Menu total in centavos for "Haircut · Beard trim"; null when none of the names are on the menu. */
export function menuAmount(menu: MenuItem[], serviceName: string): number | null {
  const names = new Set((serviceName || "").split("·").map((n) => n.trim().toLowerCase()).filter(Boolean));
  const hits = menu.filter((m) => names.has(m.name.trim().toLowerCase()));
  return hits.length ? Math.round(hits.reduce((sum, m) => sum + (m.price ?? 0), 0) * 100) : null;
}

const paidOnline = (r: Pick<ChairRequest, "paid" | "payMethod" | "payWhere">) =>
  Boolean(r.paid) && (r.payMethod === "online" || (!r.payMethod && r.payWhere === "online"));

/** The amount a barber link shows and saves for a visit (centavos). */
export function lockedAmount(row: Pick<ChairRequest, "serviceName" | "price" | "homeFee" | "paid" | "payMethod" | "payWhere">, menu: MenuItem[], serviceName = row.serviceName): number {
  if (paidOnline(row)) return row.price || 0;
  const listed = menuAmount(menu, serviceName);
  if (listed != null) return listed + (row.homeFee ?? 0);
  return row.price || Math.round((menu[0]?.price ?? 0) * 100);
}
