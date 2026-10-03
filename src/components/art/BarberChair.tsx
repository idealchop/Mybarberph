"use client";
import { KitDefs, ref, usePrefix } from "./defs";

/** Barber chair hero illustration (new art in the kit palette, the barber counterpart of the kit's CarIllustration). */
export function BarberChair({ size = 132, className }: { size?: number; className?: string }) {
  const p = usePrefix("bc");
  return (
    <svg viewBox="0 0 220 180" width={size} height={Math.round(size * 0.82)} aria-hidden className={className} style={{ display: "block" }}>
      <KitDefs p={p} />
      <ellipse cx="112" cy="168" rx="70" ry="8" fill="#000" opacity=".28" />
      <g filter={ref(p, "sh")}>
        <ellipse cx="112" cy="160" rx="52" ry="9" fill={ref(p, "chrome")} />
        <rect x="102" y="124" width="20" height="36" rx="4" fill={ref(p, "chrome")} />
        <rect x="96" y="120" width="32" height="8" rx="4" fill={ref(p, "chrome")} />
        <path d="M150 118 L178 150 L188 150" stroke={ref(p, "chrome")} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="170" y="146" width="26" height="8" rx="4" fill={ref(p, "chrome")} />
        <path d="M58 30 C58 20 64 14 74 14 L90 14 C100 14 104 20 104 30 L104 104 L58 104 Z" fill={ref(p, "peach")} />
        <rect x="66" y="0" width="30" height="14" rx="7" fill={ref(p, "peach")} />
        <rect x="76" y="12" width="10" height="6" fill={ref(p, "chrome")} />
        <path d="M66 30 L66 92 M80 30 L80 92 M94 30 L94 92" stroke="#fff" strokeOpacity=".28" strokeWidth="2" strokeLinecap="round" />
        <path d="M52 100 C52 94 56 90 62 90 L150 90 C158 90 162 96 160 104 L156 116 C155 120 151 122 147 122 L62 122 C56 122 52 118 52 112 Z" fill={ref(p, "peach")} />
        <path d="M60 98 L150 98" stroke="#fff" strokeOpacity=".45" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="56" y="70" width="70" height="8" rx="4" fill={ref(p, "chrome")} />
        <rect x="100" y="64" width="44" height="12" rx="6" fill={ref(p, "tyre")} />
        <path d="M126 76 L126 92" stroke={ref(p, "chrome")} strokeWidth="5" />
        <path d="M64 22 C64 18 67 17 70 17" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      </g>
    </svg>
  );
}
