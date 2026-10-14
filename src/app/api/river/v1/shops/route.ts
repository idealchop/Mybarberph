import { json } from "@/lib/server/auth";
import { riverAuth } from "@/lib/server/river";
import { publicShop, type ShopDoc } from "@/lib/server/shops";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** GET /api/river/v1/shops?lat=&lng=&radiusKm=&limit= — listed shops, nearest first when lat/lng given. */
export async function GET(req: Request) {
  const denied = riverAuth(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
  const radius = Math.min(200, Number(q.get("radiusKm")) || 25);
  const limit = Math.min(100, Number(q.get("limit")) || 50);
  const snap = await adminDb().collection("shops").where("listed", "==", true).limit(500).get();
  let shops = snap.docs.map((d) => publicShop(d.id, d.data() as ShopDoc)).map((s) => ({ ...s, distanceKm: null as number | null }));
  if (Number.isFinite(lat) && Number.isFinite(lng) && q.get("lat") && q.get("lng")) {
    shops = shops
      .filter((s) => s.location)
      .map((s) => ({ ...s, distanceKm: Math.round(km({ lat, lng }, s.location!) * 100) / 100 }))
      .filter((s) => (s.distanceKm ?? 0) <= radius)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }
  return json({ shops: shops.slice(0, limit) });
}
