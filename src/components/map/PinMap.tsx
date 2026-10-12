"use client";

/**
 * Small dependency-free OpenStreetMap tile map with one draggable pin.
 * - Drag the pin to move it; tap anywhere on the map to drop the pin there.
 * - Drag the map background to pan; − / + to zoom. Arrow keys nudge the focused pin.
 * Calls `onPin` once per pin move (drag end / tap), with coordinates rounded to 6 decimals (~0.1 m).
 */
import { Minus, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export const TILE = 256;
const MIN_Z = 3;
const MAX_Z = 19;

export type LatLng = { lat: number; lng: number };
export type Px = { x: number; y: number };

const world = (z: number) => TILE * 2 ** z;
export function project({ lat, lng }: LatLng, z: number): Px {
  const s = Math.sin((Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180);
  const W = world(z);
  return { x: ((lng + 180) / 360) * W, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * W };
}
export function unproject({ x, y }: Px, z: number): LatLng {
  const W = world(z);
  const lng = (x / W) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / W))) * 180) / Math.PI;
  return { lat, lng: ((((lng + 180) % 360) + 360) % 360) - 180 };
}
/** OSM raster tiles covering a `size` viewport whose top-left world pixel is `origin` at `zoom`. */
export function osmTiles(origin: Px, size: { w: number; h: number }, zoom: number): { key: string; src: string; left: number; top: number }[] {
  const n = 2 ** zoom;
  const tiles: { key: string; src: string; left: number; top: number }[] = [];
  if (size.w <= 0) return tiles;
  const x0 = Math.floor(origin.x / TILE), x1 = Math.floor((origin.x + size.w) / TILE);
  const y0 = Math.max(0, Math.floor(origin.y / TILE)), y1 = Math.min(n - 1, Math.floor((origin.y + size.h) / TILE));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const wx = ((tx % n) + n) % n;
      tiles.push({ key: `${zoom}/${tx}/${ty}`, src: `https://tile.openstreetmap.org/${zoom}/${wx}/${ty}.png`, left: tx * TILE - origin.x, top: ty * TILE - origin.y });
    }
  }
  return tiles;
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

export interface PinMapProps {
  pin: LatLng | null;
  /** Where to look when there's no pin yet. */
  fallbackCenter: LatLng;
  onPin: (next: LatLng) => void;
  disabled?: boolean;
  className?: string;
}

export function PinMap({ pin, fallbackCenter, onPin, disabled, className }: PinMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(pin ? 17 : 12);
  const [center, setCenter] = useState<LatLng>(pin ?? fallbackCenter);
  const [draft, setDraft] = useState<LatLng | null>(null);
  const drag = useRef<{ id: number; kind: "pin" | "map"; start: Px; startCenter: Px; startPin: Px | null; moved: boolean } | null>(null);
  const lastPin = useRef(pin ? `${pin.lat},${pin.lng}` : "");

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A pin set from outside (Use my location, first load) recentres the map on it.
  useEffect(() => {
    const key = pin ? `${pin.lat},${pin.lng}` : "";
    if (key === lastPin.current) return;
    lastPin.current = key;
    if (!pin) return;
    const id = requestAnimationFrame(() => {
      setCenter(pin);
      setZoom((z) => Math.max(z, 16));
    });
    return () => cancelAnimationFrame(id);
  }, [pin]);

  const c = project(center, zoom);
  const origin = { x: c.x - size.w / 2, y: c.y - size.h / 2 };
  const shown = draft ?? pin;
  const pinPx = shown ? (() => { const p = project(shown, zoom); return { x: p.x - origin.x, y: p.y - origin.y }; })() : null;

  const tiles = osmTiles(origin, size, zoom);

  const local = (e: PointerEvent): Px => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const commit = (p: LatLng) => {
    const next = { lat: round6(p.lat), lng: round6(p.lng) };
    lastPin.current = `${next.lat},${next.lng}`;
    onPin(next);
  };

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled || !e.isPrimary || drag.current) return;
    const onPinEl = (e.target as HTMLElement).closest("[data-pin]") !== null;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, kind: onPinEl && pinPx ? "pin" : "map", start: local(e), startCenter: c, startPin: pinPx, moved: false };
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = local(e);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    if (d.kind === "pin" && d.startPin) {
      const px = { x: Math.max(0, Math.min(size.w, d.startPin.x + dx)), y: Math.max(0, Math.min(size.h, d.startPin.y + dy)) };
      setDraft(unproject({ x: origin.x + px.x, y: origin.y + px.y }, zoom));
    } else {
      setCenter(unproject({ x: d.startCenter.x - dx, y: d.startCenter.y - dy }, zoom));
    }
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.kind === "pin" && d.moved && draft) {
      commit(draft);
      setDraft(null);
    } else if (!d.moved) {
      // Tap: drop the pin where the finger landed.
      const p = local(e);
      commit(unproject({ x: origin.x + p.x, y: origin.y + p.y }, zoom));
    } else {
      setDraft(null);
    }
  }
  function onPinKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (!shown || disabled) return;
    const step = e.shiftKey ? 20 : 4;
    const delta: Record<string, Px> = { ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step }, ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 } };
    const dlt = delta[e.key];
    if (!dlt) return;
    e.preventDefault();
    const p = project(shown, zoom);
    commit(unproject({ x: p.x + dlt.x, y: p.y + dlt.y }, zoom));
  }
  const zoomBy = (dz: number) => setZoom((z) => Math.max(MIN_Z, Math.min(MAX_Z, z + dz)));

  return (
    <div className={`relative overflow-hidden rounded-[18px] border border-grey-200 bg-grey-100 ${className ?? ""}`}>
      <div
        ref={box}
        className={`relative h-full w-full touch-none select-none ${disabled ? "" : "cursor-crosshair"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; setDraft(null); }}
        role="application"
        aria-label="Map. Tap to place your shop pin, drag the pin to adjust."
      >
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element -- raw map tiles, positioned by hand
          <img key={t.key} src={t.src} alt="" draggable={false} width={TILE} height={TILE}
            className="pointer-events-none absolute max-w-none" style={{ left: t.left, top: t.top, width: TILE, height: TILE }} />
        ))}
        {pinPx ? (
          <button
            type="button"
            data-pin
            aria-label={`Shop pin at ${shown!.lat.toFixed(5)}, ${shown!.lng.toFixed(5)}. Use arrow keys to nudge.`}
            onKeyDown={onPinKey}
            disabled={disabled}
            className={`absolute -translate-x-1/2 -translate-y-full p-2 focus-visible:outline-none [&:focus-visible>svg]:drop-shadow-[0_0_0_2px_#0A0A0A] ${disabled ? "" : draft ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ left: pinPx.x, top: pinPx.y + 8 }}
          >
            <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden className={`drop-shadow-[0_3px_4px_rgba(10,10,10,.35)] transition-transform duration-150 ${draft ? "-translate-y-1.5 scale-110" : ""}`}>
              <path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8 1.5 28.2 17 42.5 17 42.5S32.5 28.2 32.5 16.8C32.5 8.3 25.6 1.5 17 1.5Z" fill="#0A0A0A" stroke="#fff" strokeWidth="2.5" />
              <circle cx="17" cy="16.5" r="5.5" fill="#fff" />
            </svg>
          </button>
        ) : null}
      </div>
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-[12px] bg-surface shadow-card">
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1)} disabled={zoom >= MAX_Z} className="inline-flex size-10 items-center justify-center border-b border-line disabled:opacity-40"><Plus size={18} strokeWidth={2.2} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-1)} disabled={zoom <= MIN_Z} className="inline-flex size-10 items-center justify-center disabled:opacity-40"><Minus size={18} strokeWidth={2.2} /></button>
      </div>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
        className="absolute bottom-0 right-0 rounded-tl-[8px] bg-surface/85 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-2">
        © OpenStreetMap
      </a>
    </div>
  );
}
