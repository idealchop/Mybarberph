"use client";

/**
 * Shop pin picker on River Maps (MapLibre GL + River's self-hosted Philippines PMTiles).
 * Tap the map to drop the pin; drag the map to pan. Style version comes from NEXT_PUBLIC_MAP_STYLE_URL.
 */
import { RiverMap, RIVER_STYLE_URL_V2026_10, type RiverMapHandle } from "@river/map";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || RIVER_STYLE_URL_V2026_10;

export type LatLng = { lat: number; lng: number };

function ClickToPin({ map, onPin, disabled }: { map: MapLibreMap; onPin: (p: LatLng) => void; disabled?: boolean }) {
  const cb = useRef(onPin);
  useEffect(() => { cb.current = onPin; }, [onPin]);
  useEffect(() => {
    if (disabled) return;
    const handler = (e: MapMouseEvent) => cb.current({ lat: Math.round(e.lngLat.lat * 1e6) / 1e6, lng: Math.round(e.lngLat.lng * 1e6) / 1e6 });
    map.on("click", handler);
    map.getCanvas().style.cursor = "crosshair";
    return () => { map.off("click", handler); };
  }, [map, disabled]);
  return null;
}

export function RiverPinMap({ pin, fallbackCenter, onPin, disabled, className }: {
  pin: LatLng | null;
  fallbackCenter: LatLng;
  onPin: (p: LatLng) => void;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<RiverMapHandle>(null);
  const centre = pin ?? fallbackCenter;
  useEffect(() => {
    const map = ref.current?.getMap();
    if (map && pin) map.easeTo({ center: [pin.lng, pin.lat], duration: 300 });
  }, [pin]);
  return (
    <div className={`overflow-hidden rounded-tile bg-grey-100 ring-1 ring-line ${className ?? ""}`} data-testid="river-pin-map">
      <RiverMap
        ref={ref}
        style={{ width: "100%", height: "100%" }}
        styleUrl={STYLE_URL}
        center={{ latitude: centre.lat, longitude: centre.lng }}
        zoom={pin ? 16 : 12}
        pins={pin ? [{ id: "shop", coords: { latitude: pin.lat, longitude: pin.lng }, title: "Your shop" }] : []}
        fitCoords={pin ? [{ latitude: pin.lat, longitude: pin.lng }] : [{ latitude: centre.lat, longitude: centre.lng }]}
        gestures="cooperative"
      >
        {(map) => <ClickToPin map={map} onPin={onPin} disabled={disabled} />}
      </RiverMap>
    </div>
  );
}
