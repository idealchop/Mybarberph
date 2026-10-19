import { json } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const UA = "Barbers.ph/1.0 (+https://barbers.ph; shop map pin search)";
type Hit = { label: string; detail: string; lat: number; lng: number };
const cache = new Map<string, { at: number; hits: Hit[] }>();

/** Place search for the map pin picker: Photon (OpenStreetMap), biased to the Philippines. ?q=&lat=&lng= */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return json({ hits: [] });
  const lat = Number(sp.get("lat")) || 14.5995, lng = Number(sp.get("lng")) || 120.9842;
  const key = `${q.toLowerCase()}|${lat.toFixed(2)},${lng.toFixed(2)}`;
  const c = cache.get(key);
  if (c && Date.now() - c.at < 10 * 60_000) return json({ hits: c.hits });
  // Philippines bounding box keeps results local; lat/lon ranks nearby places first.
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en&lat=${lat}&lon=${lng}&bbox=116.9,4.5,126.7,21.2`;
  const photon = async (): Promise<Hit[]> => {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error("photon " + res.status);
    const d = (await res.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[] };
    return (d.features ?? []).map((f) => {
      const p = f.properties;
      const label = p.name || [p.housenumber, p.street].filter(Boolean).join(" ") || p.city || "Place";
      const detail = [p.street && p.name ? p.street : "", p.district || p.locality, p.city || p.county, p.state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i && v !== label).join(", ");
      return { label, detail, lat: Math.round(f.geometry.coordinates[1] * 1e6) / 1e6, lng: Math.round(f.geometry.coordinates[0] * 1e6) / 1e6 };
    });
  };
  // Fallback when Photon is slow: one Nominatim search per (debounced, cached) query, PH only.
  const nominatim = async (): Promise<Hit[]> => {
    const v = `${lng - 0.6},${lat + 0.6},${lng + 0.6},${lat - 0.6}`;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&countrycodes=ph&limit=5&viewbox=${v}&accept-language=en`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(3500) });
    if (!res.ok) throw new Error("nominatim " + res.status);
    const d = (await res.json()) as { lat: string; lon: string; name?: string; display_name: string }[];
    return d.map((r) => { const parts = r.display_name.split(", "); const label = r.name || parts[0] || "Place"; return { label, detail: parts.filter((x) => x !== label).slice(0, 3).join(", "), lat: Math.round(Number(r.lat) * 1e6) / 1e6, lng: Math.round(Number(r.lon) * 1e6) / 1e6 }; });
  };
  try {
    let hits: Hit[];
    try { hits = await photon(); } catch { hits = await nominatim(); }
    // Bounded: drop the oldest entry so a stream of unique queries can't grow memory forever.
    if (cache.size >= 500) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), hits });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return json({ hits });
  } catch {
    return json({ hits: [], error: "Search is unavailable right now." });
  }
}
