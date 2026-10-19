"use client";

/**
 * Map pin picker for the shop profile.
 * River Maps (MapLibre + PMTiles) pin, browser geolocation, and a reverse-geocoded address.
 */
import { Loader2, MapPin, Maximize2, Minimize2, Navigation, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@river-apps/ui";
import { Button } from "@/components/common/button";
const RiverPinMap = dynamic(() => import("@/components/map/river-pin-map").then((m) => m.RiverPinMap), {
  ssr: false,
  loading: () => <div className="h-[240px] rounded-tile bg-grey-100" />,
});
import { reverseGeocodePin } from "@/lib/geocode";
import type { ShopLocation } from "@/lib/shop-profile";

/** Metro Manila, for the map before a pin exists. */
const FALLBACK = { lat: 14.5995, lng: 120.9842 };
const GEOCODE_DELAY_MS = 600;

function FieldLabel({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2 flex items-baseline justify-between gap-3", className)}>
      <span className="text-[14px] font-bold">{children}</span>
      {aside ? <span className="text-[12.5px] font-semibold text-muted">{aside}</span> : null}
    </div>
  );
}

export function LocationPicker({ value, onChange, disabled }: { value: ShopLocation | null; onChange: (next: ShopLocation | null) => void; disabled?: boolean }) {
  const [locating, setLocating] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(onChange);
  useEffect(() => { latest.current = onChange; }, [onChange]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const movePin = useCallback((lat: number, lng: number, formatted?: string, placeId?: string) => {
    setErr(null);
    const id = ++seq.current;
    if (timer.current) clearTimeout(timer.current);
    const base: ShopLocation = { lat, lng, formattedAddress: formatted?.trim() ?? "", ...(placeId ? { placeId } : {}) };
    latest.current(base);
    if (base.formattedAddress) { setLookingUp(false); return; }
    setLookingUp(true);
    timer.current = setTimeout(() => {
      void reverseGeocodePin(lat, lng).then((hit) => {
        if (id !== seq.current) return;
        setLookingUp(false);
        latest.current({ ...base, formattedAddress: hit?.formatted ?? "" });
        if (!hit) setErr("Couldn’t look up the address for this spot. The pin is still saved.");
      });
    }, GEOCODE_DELAY_MS);
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setErr("This browser can’t share your location. Tap the map to drop your pin instead.");
      return;
    }
    setLocating(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        movePin(Math.round(pos.coords.latitude * 1e6) / 1e6, Math.round(pos.coords.longitude * 1e6) / 1e6);
      },
      () => {
        setLocating(false);
        setErr("Couldn’t get your location. Allow location access, or tap the map to drop your pin.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  const pin = value;
  const busy = disabled || locating;
  const [full, setFull] = useState(false);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const onMap = useCallback((m: import("maplibre-gl").Map) => { mapRef.current = m; }, []);
  useEffect(() => {
    if (!full) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [full]);
  const fly = (lat: number, lng: number) => mapRef.current?.flyTo({ center: [lng, lat], zoom: 17, duration: 700 });

  const mapBox = (
    <RiverPinMap
      pin={pin ? { lat: pin.lat, lng: pin.lng } : null}
      fallbackCenter={FALLBACK}
      onPin={(p) => movePin(p.lat, p.lng)}
      disabled={disabled}
      onMap={onMap}
      className={full ? "h-full rounded-none ring-0" : "h-[300px]"}
    >
      <div className="pointer-events-none absolute inset-x-2 top-2 z-[2] flex items-start gap-2">
        <PlaceSearch near={pin ?? FALLBACK} disabled={disabled} onPick={(h) => { movePin(h.lat, h.lng, [h.label, h.detail].filter(Boolean).join(", ")); fly(h.lat, h.lng); }} />
        <button type="button" onClick={useMyLocation} disabled={busy} aria-label="Use my location" title="My location"
          className="pointer-events-auto inline-flex size-11 flex-none items-center justify-center rounded-full bg-surface shadow-card disabled:opacity-60">
          {locating ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} strokeWidth={2.2} />}
        </button>
        <button type="button" onClick={() => setFull(!full)} aria-label={full ? "Exit full screen" : "Full screen map"}
          className="pointer-events-auto inline-flex size-11 flex-none items-center justify-center rounded-full bg-surface shadow-card">
          {full ? <Minimize2 size={18} strokeWidth={2} /> : <Maximize2 size={18} strokeWidth={2} />}
        </button>
      </div>
      {full ? (
        <div className="absolute inset-x-0 bottom-0 z-[3] bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
          <p className="mb-2 truncate text-[12.5px] font-semibold text-ink-2">{pin ? (lookingUp ? "Finding address…" : pin.formattedAddress || `${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`) : "Search, tap the map, or use your location."}</p>
          <Button type="button" fullWidth onClick={() => setFull(false)}>Done</Button>
        </div>
      ) : null}
    </RiverPinMap>
  );

  return (
    <div className="flex flex-col gap-3">
      <FieldLabel aside="For customers" className="mb-0">Map pin</FieldLabel>
      {full ? <div className="fixed inset-0 z-[95] bg-surface" role="dialog" aria-modal="true" aria-label="Map pin">{mapBox}</div> : null}
      <div>
        {full ? <div className="h-[300px] rounded-tile bg-grey-100" /> : mapBox}
        <p className="mt-1.5 px-1 text-[12px] font-semibold text-muted">
          {pin ? "Drag the pin, tap the map, or search to move it." : "Search, tap the map, or use your location to drop your shop’s pin."}
        </p>
      </div>
      {pin ? (
        <div className="flex items-start gap-2 rounded-tile bg-grey-50 px-3 py-2.5" aria-live="polite">
          <MapPin size={16} strokeWidth={1.9} className="mt-0.5 flex-none text-muted" aria-hidden />
          <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-ink-2">
            {lookingUp ? <span className="text-muted">Finding address…</span> : pin.formattedAddress || <span className="text-muted">Address not found for this spot</span>}
            <span className="mt-0.5 block font-mono text-[11px] font-medium text-muted">{pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}</span>
          </p>
          <button type="button" disabled={busy} onClick={() => { seq.current++; setLookingUp(false); onChange(null); }}
            className="flex-none text-[12.5px] font-bold text-ink-2 underline decoration-grey-300 underline-offset-[3px]">Clear pin</button>
        </div>
      ) : (
        <p className="rounded-tile bg-grey-100 px-4 py-3 text-[13px] font-medium text-muted">
          No pin yet. Customers need a map location to find your shop.
        </p>
      )}
      {err ? <p role="alert" className="text-[13px] font-semibold text-ink">⚠︎ {err}</p> : null}
    </div>
  );
}

type Hit = { label: string; detail: string; lat: number; lng: number };
const HIT_CACHE = new Map<string, Hit[]>();

/** Floating search with live suggestions (PH-biased, debounced, via /api/geocode). */
function PlaceSearch({ near, onPick, disabled }: { near: { lat: number; lng: number }; onPick: (h: Hit) => void; disabled?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const nearRef = useRef(near);
  useEffect(() => { nearRef.current = near; }, [near]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const key = term.toLowerCase();
    const ctrl = new AbortController();
    const show = (d: { hits?: Hit[]; error?: string }) => { setHits(d.hits ?? []); setNote(d.error ?? (d.hits?.length ? "" : "No places found")); setLoading(false); };
    const hit = HIT_CACHE.get(key);
    const t = window.setTimeout(() => {
      if (hit) { show({ hits: hit }); return; }
      setLoading(true);
      void fetch(`/api/geocode?q=${encodeURIComponent(term)}&lat=${nearRef.current.lat}&lng=${nearRef.current.lng}`, { signal: ctrl.signal })
        .then((r) => r.json()).then((d: { hits?: Hit[]; error?: string }) => { if (!d.error) HIT_CACHE.set(key, d.hits ?? []); show(d); })
        .catch(() => undefined);
    }, hit ? 0 : 200);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [q]);
  return (
    <div className="pointer-events-auto relative min-w-0 flex-1">
      <label className="flex h-11 items-center gap-2 rounded-pill bg-surface px-3.5 shadow-card">
        <Search size={16} strokeWidth={2.2} className="flex-none text-muted" aria-hidden />
        <input value={q} disabled={disabled} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (hits[0]) { onPick(hits[0]); setOpen(false); } } if (e.key === "Escape") setOpen(false); }}
          placeholder="Search a place or street" aria-label="Search a place" role="combobox" aria-expanded={open && hits.length > 0} aria-controls="place-hits"
          className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none placeholder:text-muted" />
        {loading ? <Loader2 size={16} className="flex-none animate-spin text-muted" /> : q ? <button type="button" aria-label="Clear search" onClick={() => { setQ(""); setHits([]); }}><X size={16} className="text-muted" /></button> : null}
      </label>
      {open && (hits.length || note || loading) && q.trim().length >= 2 ? (
        <ul id="place-hits" role="listbox" className="absolute inset-x-0 top-12 max-h-[240px] overflow-y-auto rounded-[16px] bg-surface py-1 shadow-card">
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lng},${i}`} role="option" aria-selected={false}>
              <button type="button" onClick={() => { onPick(h); setQ(h.label); setOpen(false); }} className="flex w-full flex-col items-start px-3.5 py-2 text-left hover:bg-grey-50">
                <b className="text-[13.5px]">{h.label}</b>
                {h.detail ? <span className="text-[12px] font-semibold text-muted">{h.detail}</span> : null}
              </button>
            </li>
          ))}
          {loading && !hits.length ? [0, 1, 2].map((k) => <li key={k} aria-hidden className="px-3.5 py-2"><span className="block h-3.5 w-2/3 animate-pulse rounded bg-grey-200" /><span className="mt-1.5 block h-3 w-1/2 animate-pulse rounded bg-grey-100" /></li>) : null}
          {!loading && !hits.length && note ? <li className="px-3.5 py-2 text-[12.5px] font-semibold text-muted">{note}</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
