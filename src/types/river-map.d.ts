/**
 * Type surface of @river/map (vendor/river-maps/packages/river-map) used by this app.
 * The bundler aliases @river/map to the package source (next.config.ts); tsc reads this file
 * instead so the package isn't re-checked under this app's stricter compiler options.
 */
declare module "@river/map" {
  import type { CSSProperties, ForwardRefExoticComponent, ReactNode, RefAttributes } from "react";
  import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

  export type LatLng = { latitude: number; longitude: number };
  export type RiverMapPin<T = unknown> = { id: string; coords: LatLng; title?: string; data?: T };
  export type Padding = { top: number; right: number; bottom: number; left: number };
  export type RiverMapHandle = { fitAll: () => void; locate: (zoom?: number) => void; getMap: () => MapLibreMap | null };
  export type RiverMapProps<T = unknown> = {
    styleUrl: string | StyleSpecification;
    user?: LatLng | null;
    center?: LatLng;
    zoom?: number;
    pins?: RiverMapPin<T>[];
    selectedId?: string | null;
    onSelect?: (id: string | null) => void;
    renderPin?: (pin: RiverMapPin<T>, selected: boolean) => ReactNode;
    fitCoords?: LatLng[];
    padding?: Partial<Padding>;
    gestures?: "greedy" | "cooperative";
    workerUrl?: string;
    attribution?: boolean;
    className?: string;
    style?: CSSProperties;
    children?: (map: MapLibreMap) => ReactNode;
  };
  export const RiverMap: ForwardRefExoticComponent<RiverMapProps & RefAttributes<RiverMapHandle>>;
  export const RIVER_STYLE_URL_V2026_10: string;
}
