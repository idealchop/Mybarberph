import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { manilaDayStart, shopRef } from "@/lib/server/shops";
import type { ChairRequest } from "@/lib/booking-types";

export const dynamic = "force-dynamic";

/** Owner: visits from the last N Manila days (default 28, max 124), trimmed to what Sales needs. */
export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const days = Math.min(3650, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 28));
  const from = manilaDayStart() - (days - 1) * 86_400_000;
  const keep = ["id", "ref", "status", "channel", "createdAt", "updatedAt", "startedAt", "completedAt", "price", "paid", "payMethod", "payWhere", "tip", "serviceName", "serviceId", "seatLabel", "chairLabel", "locationId", "barberId", "barberName", "customerLabel", "contact", "rating", "feedback", "feedbackAt", "home", "homeFee", "homeStatus", "scheduledAt", "splitPct"] as const;
  const full = new URL(req.url).searchParams.get("full") === "1";
  const col = shopRef(me.uid).collection("bookings");
  const cap = days > 124 ? 20000 : 12000;
  // Finished cuts by completion day, plus anything opened in the window (so a cut booked earlier still counts on the day it finished).
  const read = (field: "completedAt" | "createdAt", start: number) => {
    const q = col.where(field, ">=", start);
    // Newest first: the cap drops the OLDEST rows, never today's (ascending order used to cut off recent cuts).
    const ordered = q.orderBy(field, "desc");
    return (full ? ordered : ordered.select(...keep)).limit(cap).get();
  };
  const [doneSnap, openSnap] = await Promise.all([read("completedAt", from), read("createdAt", from - 86_400_000)]);
  const byId = new Map<string, ChairRequest>();
  for (const d of [...doneSnap.docs, ...openSnap.docs]) {
    const b = d.data() as ChairRequest & Record<string, unknown>;
    byId.set(d.id, (full ? b : Object.fromEntries(keep.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]))) as ChairRequest);
  }
  return json({ from, rows: [...byId.values()] });
}
