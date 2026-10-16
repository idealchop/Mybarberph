import { LEFTCORNER_PATH, RIGHTCORNER_PATH, SMILE_PATH, UNDERLINE_PATH } from "./riverLogoPaths";

const PATHS = [SMILE_PATH, UNDERLINE_PATH, LEFTCORNER_PATH, RIGHTCORNER_PATH];

/** The official River smile mark (exact vector paths from River Mobile), crisp at any size. */
export function RiverSmile({ color = "#fff", className, style }: { color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="-10 -6 472 256" fill={color} aria-hidden className={className} style={style}>
      {PATHS.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** River smile in the app ink colour, directly on the page (no tile). Height ≈ 0.54 × width. */
export function RiverMark({ size = 34 }: { size?: number }) {
  const w = Math.round(size * 1.18);
  return <RiverSmile color="currentColor" className="block shrink-0 text-ink" style={{ width: w, height: Math.round(w * 256 / 472) }} />;
}

export function Brand({ size = 34, sub = true }: { size?: number; sub?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <RiverMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="text-[19px] font-extrabold tracking-[-0.02em]">Barbers.ph</span>
        {sub ? <span className="mt-[3px] text-[11px] font-semibold text-muted">by River Apps</span> : null}
      </span>
    </span>
  );
}
