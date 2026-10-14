/**
 * Barbers.ph wordmark with the River icon (same artwork as River Mobile's app icon,
 * river/logo/final/favicon/favicon.svg), in its black-tile variant to match the app's black UI.
 * SVG, so it stays crisp at every size.
 */
export function RiverMark({ size = 34 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/river-mark-black.svg" width={size} height={size} alt="" aria-hidden className="block shrink-0" style={{ width: size, height: size }} />;
}

export function Brand({ size = 34, sub = true }: { size?: number; sub?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <RiverMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="text-[19px] font-extrabold tracking-[-0.02em]">Barbers<span className="font-semibold text-subtle">.ph</span></span>
        {sub ? <span className="mt-[3px] text-[11px] font-semibold text-muted">by River Apps</span> : null}
      </span>
    </span>
  );
}
