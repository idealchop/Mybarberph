import type { ChairRequest } from "@/lib/chair-bookings";

/** v1.0.31 (Jimboy): Walk-in starts the haircut at once; extra services are added to the live visit. */
type Svc = { id?: string; name: string; price?: number | null };

const SEP = " · ";
const parts = (name?: string) => (name || "").split("·").map((p) => p.trim()).filter(Boolean);
const centavos = (peso?: number | null) => Math.round((peso ?? 0) * 100);

/** One walk-in visit with the shop's Haircut and price. Seated by seatWalkInOnChair (same location, barber, split as before). */
export function newWalkIn(o: { shopId: string; ref: string; haircut: Svc; at: number }): ChairRequest {
  return {
    id: `wk-${o.at}`,
    shopId: o.shopId,
    ref: o.ref,
    channel: "walk-in",
    status: "accepted",
    contact: "",
    customerLabel: "Walk-in",
    serviceId: "haircut",
    serviceName: o.haircut.name,
    price: centavos(o.haircut.price),
    slotLabel: "Now",
    payWhere: "shop",
    paid: false,
    createdAt: o.at,
    updatedAt: o.at,
  } as ChairRequest;
}

/** Names of services already added after the haircut. */
export function addedServices(row: Pick<ChairRequest, "serviceName">): string[] {
  return parts(row.serviceName).slice(1);
}

/** Patch that adds a service: name appended, amount up by its price. Same visit, so the haircut count stays one. */
export function addServicePatch(row: Pick<ChairRequest, "serviceName" | "price">, svc: Svc): Pick<ChairRequest, "serviceName" | "price"> {
  return { serviceName: [...parts(row.serviceName), svc.name].join(SEP), price: (row.price || 0) + centavos(svc.price) };
}

/** Patch that removes one added service (never the haircut). */
export function removeServicePatch(row: Pick<ChairRequest, "serviceName" | "price">, svc: Svc): Pick<ChairRequest, "serviceName" | "price"> {
  const list = parts(row.serviceName);
  const i = list.findIndex((p, k) => k > 0 && p.toLowerCase() === svc.name.toLowerCase());
  if (i < 0) return { serviceName: row.serviceName, price: row.price };
  list.splice(i, 1);
  return { serviceName: list.join(SEP), price: Math.max(0, (row.price || 0) - centavos(svc.price)) };
}

/** Service line on the Now serving card: "Haircut + Beard trim". */
export function serviceLine(row: Pick<ChairRequest, "serviceName">, fallback: string): string {
  const list = parts(row.serviceName);
  return list.length ? list.join(" + ") : fallback;
}
