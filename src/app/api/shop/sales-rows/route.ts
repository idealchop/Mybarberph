import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { manilaDayStart, shopRef } from "@/lib/server/shops";
import type { ChairRequest } from "@/lib/booking-types";

export const dynamic = "force-dynamic";

/** Owner: visits from the last N Manila days (default 28, max 62), trimmed to what Sales needs. */
export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const days = Math.min(62, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 28));
  const from = manilaDayStart() - (days - 1) * 86_400_000;
  const snap = await shopRef(me.uid).collection("bookings").where("createdAt", ">=", from - 86_400_000).limit(5000).get();
  const keep = ["id", "ref", "status", "channel", "createdAt", "updatedAt", "startedAt", "completedAt", "price", "paid", "payMethod", "payWhere", "serviceName", "serviceId", "seatLabel", "chairLabel", "locationId", "barberId", "barberName", "customerLabel", "contact", "rating"] as const;
  const full = new URL(req.url).searchParams.get("full") === "1";
  const rows = full ? snap.docs.map((d) => d.data()) : snap.docs.map((d) => {
    const b = d.data() as ChairRequest & Record<string, unknown>;
    return Object.fromEntries(keep.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));
  });
  return json({ from, rows });
}
