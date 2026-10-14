"use client";

/**
 * Map pin picker for the shop profile.
 * River Maps (MapLibre + PMTiles) pin, browser geolocation, and a reverse-geocoded address.
 */
import { MapPin, Navigation } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, cn } from "@river-apps/ui";
const RiverPinMap = dynamic(() => import("@/components/map/RiverPinMap").then((m) => m.RiverPinMap), {
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

  return (
    <div className="flex flex-col gap-3">
      <FieldLabel aside="For customers" className="mb-0">Map pin</FieldLabel>
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
        <RiverPinMap
          pin={pin ? { lat: pin.lat, lng: pin.lng } : null}
          fallbackCenter={FALLBACK}
          onPin={(p) => movePin(p.lat, p.lng)}
          disabled={disabled}
          className="h-[240px]"
        />
        <p className="mt-1.5 px-1 text-[12px] font-semibold text-muted">
          {pin ? "Drag the pin or tap the map to move it to your exact spot." : "Tap the map to drop your shop’s pin."}
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
