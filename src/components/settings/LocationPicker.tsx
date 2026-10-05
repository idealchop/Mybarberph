"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Button, Input, cn } from "@river-apps/ui";
import type { ShopLocation } from "@/data";
import { googleMapsBrowserKey } from "@/lib/maps";

type Props = {
  address: string;
  location?: ShopLocation;
  onAddressChange: (address: string) => void;
  onLocationChange: (loc: ShopLocation) => void;
};

type GMaps = {
  maps: {
    Map: new (el: HTMLElement, opts: object) => {
      setCenter: (p: { lat: number; lng: number }) => void;
      addListener: (ev: string, fn: (e: { latLng?: { lat: () => number; lng: () => number } }) => void) => void;
    };
    Marker: new (opts: object) => {
      setPosition: (p: { lat: number; lng: number }) => void;
      getPosition: () => { lat: () => number; lng: () => number } | null;
      addListener: (ev: string, fn: () => void) => void;
    };
    Geocoder: new () => {
      geocode: (
        req: { location: { lat: number; lng: number } },
        cb: (results: { formatted_address: string; place_id?: string }[] | null, status: string) => void,
      ) => void;
    };
    places?: {
      Autocomplete: new (input: HTMLInputElement, opts: object) => {
        addListener: (ev: string, fn: () => void) => void;
        getPlace: () => {
          formatted_address?: string;
          name?: string;
          place_id?: string;
          geometry?: { location?: { lat: () => number; lng: () => number } };
        };
      };
    };
  };
};

declare global {
  interface Window {
    google?: GMaps;
    __bpMapsReady?: Promise<void>;
  }
}

function loadMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__bpMapsReady) return window.__bpMapsReady;
  window.__bpMapsReady = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
  return window.__bpMapsReady;
}

/** Shop pin for River Mobile proximity. Uses Places/Maps when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set. */
export function LocationPicker({ address, location, onAddressChange, onLocationChange }: Props) {
  const key = googleMapsBrowserKey();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<{ setCenter: (p: { lat: number; lng: number }) => void } | null>(null);
  const marker = useRef<{ setPosition: (p: { lat: number; lng: number }) => void; getPosition: () => { lat: () => number; lng: () => number } | null } | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [latStr, setLatStr] = useState(location?.lat != null ? String(location.lat) : "14.6507");
  const [lngStr, setLngStr] = useState(location?.lng != null ? String(location.lng) : "121.1029");
  const [ready, setReady] = useState(false);

  const applyPin = useCallback((lat: number, lng: number, formattedAddress: string, placeId?: string) => {
    onLocationChange({ lat, lng, formattedAddress, placeId });
    setLatStr(String(lat));
    setLngStr(String(lng));
    if (mapInst.current && marker.current) {
      const pos = { lat, lng };
      mapInst.current.setCenter(pos);
      marker.current.setPosition(pos);
    }
  }, [onLocationChange]);

  useEffect(() => {
    if (!key || !mapRef.current) return;
    let cancelled = false;
    void loadMaps(key)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google) return;
        const g = window.google;
        const center = { lat: location?.lat ?? 14.6507, lng: location?.lng ?? 121.1029 };
        const map = new g.maps.Map(mapRef.current, {
          center, zoom: 16, mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        });
        const m = new g.maps.Marker({ map, position: center, draggable: true });
        m.addListener("dragend", () => {
          const p = m.getPosition();
          if (!p) return;
          const lat = p.lat();
          const lng = p.lng();
          new g.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
            const formatted = status === "OK" && results?.[0]
              ? results[0].formatted_address
              : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            onAddressChange(formatted);
            applyPin(lat, lng, formatted, results?.[0]?.place_id);
          });
        });
        map.addListener("click", (e) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          m.setPosition({ lat, lng });
          new g.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
            const formatted = status === "OK" && results?.[0]
              ? results[0].formatted_address
              : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            onAddressChange(formatted);
            applyPin(lat, lng, formatted, results?.[0]?.place_id);
          });
        });
        mapInst.current = map;
        marker.current = m;
        setReady(true);

        const input = document.getElementById("bp-places-input") as HTMLInputElement | null;
        if (input && g.maps.places) {
          const ac = new g.maps.places.Autocomplete(input, {
            fields: ["formatted_address", "geometry", "place_id", "name"],
            componentRestrictions: { country: ["ph"] },
          });
          ac.addListener("place_changed", () => {
            const place = ac.getPlace();
            const loc = place.geometry?.location;
            if (!loc) return;
            const lat = loc.lat();
            const lng = loc.lng();
            const formatted = place.formatted_address || place.name || address;
            onAddressChange(formatted);
            applyPin(lat, lng, formatted, place.place_id);
          });
        }
      })
      .catch((e) => setMapsError(e instanceof Error ? e.message : "Maps unavailable"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function saveManual() {
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const formatted = address.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    applyPin(lat, lng, formatted);
  }

  return (
    <div className="flex flex-col gap-4 md:col-span-2">
      <div className="flex items-start gap-2.5 rounded-[18px] bg-grey-100 px-3.5 py-3">
        <MapPin size={18} strokeWidth={1.75} className="mt-0.5 flex-none text-muted" />
        <p className="text-[13px] font-medium leading-snug text-muted">
          Pin your shop so River Mobile can find nearby barbers. Drag the marker or search the address.
        </p>
      </div>

      {key ? (
        <>
          <Input id="bp-places-input" size="md" label="Search address" placeholder="Street, barangay, city"
            value={address} onChange={(e) => onAddressChange(e.target.value)} />
          <div ref={mapRef} className={cn("h-[240px] w-full overflow-hidden rounded-[22px] bg-grey-100 ring-1 ring-inset ring-line", !ready && "animate-pulse")} />
          {mapsError ? <p className="text-[12.5px] font-semibold text-muted">{mapsError}</p> : null}
        </>
      ) : (
        <>
          <Input size="md" label="Street address" placeholder="28 J.P. Rizal St, Marikina"
            value={address} onChange={(e) => onAddressChange(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input size="md" label="Latitude" inputMode="decimal" value={latStr} onChange={(e) => setLatStr(e.target.value)} />
            <Input size="md" label="Longitude" inputMode="decimal" value={lngStr} onChange={(e) => setLngStr(e.target.value)} />
          </div>
          <div className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-[22px] bg-grey-100 ring-1 ring-inset ring-line">
            <div className="absolute inset-0 opacity-40" style={{
              backgroundImage: "linear-gradient(#d4d4d8 1px, transparent 1px), linear-gradient(90deg, #d4d4d8 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }} />
            <div className="relative z-[1] max-w-[320px] rounded-[18px] bg-surface px-4 py-3 text-center shadow-card">
              <b className="text-[14px]">Map preview needs an API key</b>
              <p className="mt-1 text-[12.5px] font-medium leading-snug text-muted">
                Set <code className="font-mono text-[12px]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> (Maps JavaScript + Places) on App Hosting, then redeploy. You can still save lat/lng below.
              </p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={saveManual}>Use these coordinates</Button>
        </>
      )}

      {location ? (
        <p className="font-mono text-[12px] font-semibold text-muted">
          {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          {location.formattedAddress ? ` · ${location.formattedAddress}` : ""}
        </p>
      ) : null}
    </div>
  );
}
