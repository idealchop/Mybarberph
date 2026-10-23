"use client";

/**
 * Shop pin picker on River Maps (MapLibre GL + River's self-hosted Philippines PMTiles).
 * Tap the map to move the pin, or drag the 3D pin itself; drag the map to pan. Style version comes from NEXT_PUBLIC_MAP_STYLE_URL.
 */
import { RiverMap, RIVER_STYLE_URL_V2026_10, type RiverMapHandle } from "@river/map";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type React from "react";
import { useEffect, useRef } from "react";

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || RIVER_STYLE_URL_V2026_10;

export type LatLng = { lat: number; lng: number };

function ClickToPin({ map, onPin, disabled }: { map: MapLibreMap; onPin: (p: LatLng) => void; disabled?: boolean }) {
  const cb = useRef(onPin);
  useEffect(() => { cb.current = onPin; }, [onPin]);
  useEffect(() => {
    if (disabled) return;
    const handler = (e: MapMouseEvent) => cb.current({ lat: round(e.lngLat.lat), lng: round(e.lngLat.lng) });
    map.on("click", handler);
    map.getCanvas().style.cursor = "crosshair";
    return () => { map.off("click", handler); };
  }, [map, disabled]);
  return null;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** The shop pin: River 3D location pin, draggable (mouse and touch). */
function DraggablePin({ map, pin, onPin, disabled }: { map: MapLibreMap; pin: LatLng; onPin: (p: LatLng) => void; disabled?: boolean }) {
  const cb = useRef(onPin);
  useEffect(() => { cb.current = onPin; }, [onPin]);
  const marker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "shop-pin");
    el.setAttribute("aria-label", "Shop pin. Drag to adjust.");
    el.style.cssText = "width:44px;height:58px;cursor:grab;touch-action:none;filter:drop-shadow(0 6px 8px rgba(0,0,0,.18))";
    const img = document.createElement("img");
    img.src = "/icons3d/barbers/128/location.webp"; img.alt = ""; img.draggable = false;
    img.style.cssText = "width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none";
    el.appendChild(img);
    const mk = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: !disabled }).setLngLat([pin.lng, pin.lat]).addTo(map);
    mk.on("dragstart", () => { el.style.cursor = "grabbing"; el.style.transform += " scale(1.08)"; });
    mk.on("dragend", () => { el.style.cursor = "grab"; const p = mk.getLngLat(); cb.current({ lat: round(p.lat), lng: round(p.lng) }); });
    marker.current = mk;
    return () => { mk.remove(); marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, disabled]);
  useEffect(() => { marker.current?.setLngLat([pin.lng, pin.lat]); }, [pin.lat, pin.lng]);
  return null;
}

/** Keeps the map sized to its box (fullscreen toggle) and the OSM credit collapsed to the (i) icon. */
function MapChrome({ map, onMap }: { map: MapLibreMap; onMap?: (m: MapLibreMap) => void }) {
  useEffect(() => {
    onMap?.(map);
    const collapse = () => map.getContainer().querySelectorAll(".maplibregl-ctrl-attrib.maplibregl-compact-show").forEach((el) => el.classList.remove("maplibregl-compact-show"));
    collapse();
    map.once("load", collapse);
    const t = window.setTimeout(collapse, 600);
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(map.getContainer());
    return () => { ro.disconnect(); window.clearTimeout(t); };
  }, [map, onMap]);
  return null;
}

export function RiverPinMap({ pin, fallbackCenter, onPin, disabled, className, onMap, children }: {
  onMap?: (m: MapLibreMap) => void;
  children?: React.ReactNode;
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
    <div className={`relative overflow-hidden rounded-tile bg-grey-100 ring-1 ring-line ${className ?? ""}`} data-testid="river-pin-map">
      <RiverMap
        ref={ref}
        style={{ width: "100%", height: "100%" }}
        styleUrl={STYLE_URL}
        workerUrl="/maplibre/maplibre-gl-worker.mjs"
        center={{ latitude: centre.lat, longitude: centre.lng }}
        zoom={pin ? 16 : 12}
        pins={[]}
        fitCoords={pin ? [{ latitude: pin.lat, longitude: pin.lng }] : [{ latitude: centre.lat, longitude: centre.lng }]}
        gestures="cooperative"
        attribution={false}
      >
        {(map) => (
          <>
            <MapChrome map={map} onMap={onMap} />
            <ClickToPin map={map} onPin={onPin} disabled={disabled} />
            {pin ? <DraggablePin map={map} pin={pin} onPin={onPin} disabled={disabled} /> : null}
          </>
        )}
      </RiverMap>
      <a href="/settings/map-credits" aria-label="Map credits: © OpenStreetMap contributors" title="© OpenStreetMap contributors" className="absolute bottom-1.5 right-1.5 z-[2] inline-flex size-5 items-center justify-center rounded-full bg-white/85 text-[11px] font-bold text-ink-2 shadow-sm">ⓘ</a>
      {children}
    </div>
  );
}
