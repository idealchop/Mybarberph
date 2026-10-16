import { json } from "@/lib/server/auth";
import { listHomeShops } from "@/lib/server/home-service";
import { riverAuth } from "@/lib/server/river";

export const dynamic = "force-dynamic";

/** GET /api/river/v1/home-service/shops?lat=&lng=&limit= — shop locations offering home service (within their radius of lat/lng), nearest first. */
export async function GET(req: Request) {
  const denied = riverAuth(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
  const customer = q.get("lat") && q.get("lng") && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  return json({ shops: await listHomeShops(customer, Math.min(100, Number(q.get("limit")) || 50)) });
}
