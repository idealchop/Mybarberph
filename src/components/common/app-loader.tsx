import { RiverSmile } from "@/components/shell/brand";

const W = 46, H = Math.round(W * 256 / 472);

/**
 * The one loading screen (Jimboy, 2026-10-20): the River mark only, solid black, centred on the screen,
 * faded, with a soft shine sweeping across it. Reduced motion: just the faded mark.
 * Screens with cached data render content at once and never show this (see src/lib/cloud.ts fast launch).
 */
export function AppLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="fixed inset-0 z-[5] flex items-center justify-center bg-canvas">
      <span className="sr-only">{label}…</span>
      <span aria-hidden className="relative inline-block opacity-40">
        <RiverSmile color="#000" className="block" style={{ width: W, height: H }} />
        <span className="app-loader-shine absolute inset-0"><RiverSmile color="#fff" className="block" style={{ width: W, height: H }} /></span>
      </span>
    </div>
  );
}
