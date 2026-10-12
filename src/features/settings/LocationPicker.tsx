"use client";

/**
 * Map pin picker for the shop profile.
 * Draggable pin on an OpenStreetMap tile map, browser geolocation, and a reverse-geocoded address.
 */
import { MapPin, Navigation } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, cn } from "@river-apps/ui";
import { PinMap } from "@/components/map/PinMap";
import { reverseGeocodePin } from "@/lib/geocode";
import type { ShopLocation } from "@/lib/shop-profile";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

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
  const placesId = "barber-places-search";
  const googleLoaded = useRef(false);
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

  useEffect(() => {
    if (!GOOGLE_KEY || googleLoaded.current || disabled) return;
    type Autocomplete = {
      addListener: (e: string, cb: () => void) => void;
      getPlace: () => { geometry?: { location?: { lat: () => number; lng: () => number } }; formatted_address?: string; place_id?: string };
    };
    const boot = () => {
      const el = document.getElementById(placesId) as HTMLInputElement | null;
      const g = (window as unknown as { google?: { maps?: { places?: { Autocomplete: new (el: HTMLInputElement, opts: object) => Autocomplete } } } }).google;
      if (!g?.maps?.places || !el) return;
      googleLoaded.current = true;
      const ac = new g.maps.places.Autocomplete(el, {
        fields: ["geometry", "formatted_address", "place_id"],
        componentRestrictions: { country: "ph" },
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const loc = place.geometry?.location;
        if (!loc) return;
        movePin(loc.lat(), loc.lng(), place.formatted_address, place.place_id);
      });
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-barber-maps]");
    if (existing) {
      if ((window as unknown as { google?: unknown }).google) boot();
      else existing.addEventListener("load", boot);
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&libraries=places`;
    s.async = true;
    s.dataset.barberMaps = "1";
    s.onload = boot;
    document.head.appendChild(s);
  }, [movePin, disabled]);

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

  return (
    <div className="flex flex-col gap-3">
      <FieldLabel aside="For customers" className="mb-0">Map pin</FieldLabel>
      {GOOGLE_KEY ? (
        <div className="flex flex-col">
          <label htmlFor={placesId} className="mb-2 text-[14px] font-bold">Search address (Google)</label>
          <input
            id={placesId}
            type="text"
            disabled={busy}
            placeholder="Start typing a Philippine address…"
            className="h-[46px] rounded-tile bg-canvas px-4 text-[14px] font-semibold outline-none focus:bg-surface focus:ring-2 focus:ring-ink"
            autoComplete="off"
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" leadingIcon={<Navigation size={16} />} onClick={useMyLocation} disabled={busy}>
          {locating ? "Locating…" : "Use my location"}
        </Button>
        {pin ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => { seq.current++; setLookingUp(false); onChange(null); }} disabled={busy}>
            Clear pin
          </Button>
        ) : null}
      </div>
      <div>
        <PinMap
          pin={pin ? { lat: pin.lat, lng: pin.lng } : null}
          fallbackCenter={FALLBACK}
          onPin={(p) => movePin(p.lat, p.lng)}
          disabled={disabled}
          className="h-[240px]"
        />
        <p className="mt-1.5 px-1 text-[12px] font-semibold text-muted">
          {pin ? "Drag the pin or tap the map to fine-tune your exact spot." : "Tap the map to drop your shop’s pin."}
        </p>
      </div>
      {pin ? (
        <div className="flex items-start gap-2 rounded-tile bg-grey-50 px-3 py-2.5" aria-live="polite">
          <MapPin size={16} strokeWidth={1.9} className="mt-0.5 flex-none text-muted" aria-hidden />
          <p className="min-w-0 text-[12.5px] font-semibold leading-snug text-ink-2">
            {lookingUp ? <span className="text-muted">Finding address…</span> : pin.formattedAddress || <span className="text-muted">Address not found for this spot</span>}
            <span className="mt-0.5 block font-mono text-[11px] font-medium text-muted">{pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}</span>
          </p>
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
