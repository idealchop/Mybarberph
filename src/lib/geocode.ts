/** What a map pin resolves to. */
export interface PinAddress {
  /** Full one-line label from Nominatim. */
  formatted: string;
  /** Short "Barangay, City" label. Empty when unknown. */
  area: string;
}

type NominatimAddress = Partial<Record<
  "house_number" | "road" | "building" | "amenity" | "shop" | "neighbourhood" | "quarter" | "suburb" | "village" | "hamlet"
  | "city_district" | "city" | "town" | "municipality" | "county" | "state" | "region" | "postcode",
  string
>>;

const cache = new Map<string, Promise<PinAddress | null>>();
const keyOf = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`;
const clean = (v?: string) => (v ?? "").trim();
const strip = (v: string) => v.replace(/^City of\s+/i, "").replace(/\s+City$/i, "").trim();

export function toPinAddress(displayName: string, a: NominatimAddress): PinAddress {
  const barangay = clean(a.quarter) || clean(a.suburb) || clean(a.village) || clean(a.neighbourhood) || clean(a.hamlet);
  const city = clean(a.city) || clean(a.town) || clean(a.municipality) || clean(a.city_district);
  const area = [barangay, city ? strip(city) : ""].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", ");
  return { formatted: displayName.trim(), area };
}

/**
 * Reverse-geocode a pin with OpenStreetMap Nominatim. Cached per coordinate.
 * Resolves null on failure.
 */
export function reverseGeocodePin(lat: number, lng: number): Promise<PinAddress | null> {
  const key = keyOf(lat, lng);
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) return null;
      const data = (await res.json()) as { display_name?: string; address?: NominatimAddress };
      if (!data.display_name && !data.address) return null;
      return toPinAddress(data.display_name ?? "", data.address ?? {});
    } catch {
      return null;
    }
  })();
  cache.set(key, p);
  void p.then((r) => { if (!r) cache.delete(key); });
  return p;
}
