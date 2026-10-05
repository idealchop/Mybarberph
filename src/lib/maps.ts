/** Browser Maps key (Places + Maps JS). Optional — Settings falls back to manual lat/lng. */
export function googleMapsBrowserKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
}

export function hasGoogleMaps(): boolean {
  return Boolean(googleMapsBrowserKey());
}
