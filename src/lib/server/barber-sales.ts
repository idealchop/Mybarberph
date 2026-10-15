import type { ChairRequest } from "@/lib/booking-types";
import { barberRange, type BarberSalesRow } from "@/lib/barber-sales";
import { loadState, shopRef } from "./shops";

type Chair = { id: string; label: string; barberId?: string; barberName?: string; locationId?: string };

/** Finished visits per barber (Manila time) for salary and cash remittance. */
export async function barberSales(shopId: string, q: { range?: string | null; from?: string | null; to?: string | null; loc?: string | null; barberId?: string | null }) {
  const r = barberRange(q.range, q.from, q.to);
  const snap = await shopRef(shopId).collection("bookings").where("completedAt", ">=", r.from).where("completedAt", "<", r.to).get();
  const state = await loadState(shopId, ["barbers.shop-chairs", "barbers.shop-locations"]);
  const chairs = JSON.parse(state["barbers.shop-chairs"] || "[]") as Chair[];
  const locs = (() => { try { return (JSON.parse(state["barbers.shop-locations"] || "{}").branches || []) as { id: string; name: string }[]; } catch { return []; } })();
  const locName = (id: string) => locs.find((x) => x.id === id)?.name || id;
  const loc = q.loc && q.loc !== "all" ? q.loc : null;
  const rows = new Map<string, BarberSalesRow>();
  for (const d of snap.docs) {
    const b = d.data() as ChairRequest;
    if (b.status !== "done") continue;
    const bl = b.locationId || "home";
    if (loc && bl !== loc) continue;
    const seat = chairs.find((c) => c.label === (b.seatLabel || b.chairLabel) && (c.locationId || "home") === bl);
    const id = b.barberId || seat?.barberId || `seat:${bl}:${b.seatLabel || "-"}`;
    if (q.barberId && id !== q.barberId) continue;
    const name = b.barberName || seat?.barberName?.trim() || (b.seatLabel ? `${b.seatLabel} (no barber)` : "No barber");
    const key = `${id}@${bl}`;
    const row = rows.get(key) ?? { barberId: id, barberName: name, locationId: bl, locationName: locName(bl), cuts: 0, gross: 0, cash: 0, gcash: 0, online: 0, unpaid: 0, remit: 0 };
    row.cuts += 1;
    row.gross += b.price || 0;
    if (!b.paid) row.unpaid += b.price || 0;
    else if (b.payMethod === "gcash") row.gcash += b.price || 0;
    else if (b.payMethod === "online") row.online += b.price || 0;
    else row.cash += b.price || 0;
    row.remit = row.cash;
    rows.set(key, row);
  }
  const list = [...rows.values()].sort((a, b) => b.gross - a.gross);
  const total = list.reduce((t, x) => ({ ...t, cuts: t.cuts + x.cuts, gross: t.gross + x.gross, cash: t.cash + x.cash, gcash: t.gcash + x.gcash, online: t.online + x.online, unpaid: t.unpaid + x.unpaid, remit: t.remit + x.remit }),
    { barberId: "all", barberName: "All barbers", cuts: 0, gross: 0, cash: 0, gcash: 0, online: 0, unpaid: 0, remit: 0 });
  return { ...r, barbers: list, total };
}
