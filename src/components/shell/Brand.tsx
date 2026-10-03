import { LogoMark } from "@river-apps/ui";

/** White scissors glyph for the Barbers.ph mark. */
export function ScissorsGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
    </svg>
  );
}

/** Barbers.ph wordmark on the kit LogoMark. */
export function Brand({ size = 34, sub = true }: { size?: number; sub?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size}><ScissorsGlyph /></LogoMark>
      <span className="flex flex-col leading-none">
        <span className="text-[19px] font-extrabold tracking-[-0.02em]">Barbers<span className="font-semibold text-subtle">.ph</span></span>
        {sub ? <span className="mt-[3px] text-[11px] font-semibold text-muted">by River Apps</span> : null}
      </span>
    </span>
  );
}
