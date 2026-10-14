import { LogoMark } from "@river-apps/ui";
import { LEFTCORNER_PATH, RIGHTCORNER_PATH, SMILE_PATH, UNDERLINE_PATH } from "./riverLogoPaths";

const PATHS = [SMILE_PATH, UNDERLINE_PATH, LEFTCORNER_PATH, RIGHTCORNER_PATH];

/** The official River smile mark (exact vector paths from River Mobile), crisp at any size. */
export function RiverSmile({ color = "#fff", className }: { color?: string; className?: string }) {
  return (
    <svg viewBox="-10 -6 472 256" fill={color} aria-hidden className={className}>
      {PATHS.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** River smile in white on the kit's black tile. */
export function RiverMark({ size = 34 }: { size?: number }) {
  return <LogoMark size={size} className="[&>svg]:!h-auto [&>svg]:!w-[66%]"><RiverSmile /></LogoMark>;
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
