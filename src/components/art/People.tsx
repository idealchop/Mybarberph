"use client";
import { AVATAR_PRESETS, type AvatarPreset } from "@river-apps/icons";
import type { HaircutKind } from "@/data";
import { usePrefix } from "./defs";

/* Same geometry and presets as the kit PersonAvatar (packages/icons/src/PersonAvatar.tsx). */
const HAIR = {
  short: "M12.2 15.2c0-5 3.4-8 7.8-8s7.8 3 7.8 8c-1.2-1.8-3.6-3-7.8-3s-6.6 1.2-7.8 3Z",
  long: "M11.6 22c-.6-9 2.8-14.6 8.4-14.6s9 5.6 8.4 14.6c-1-.5-1.6-2.4-1.8-6-1.6-1.6-3.8-2.6-6.6-2.6s-5 1-6.6 2.6c-.2 3.6-.8 5.5-1.8 6Z",
  bun: "M12.4 15.6c0-5 3.3-7.8 7.6-7.8s7.6 2.8 7.6 7.8c-1.4-2-3.8-3.2-7.6-3.2s-6.2 1.2-7.6 3.2Z",
} as const;

/** Square (uncropped) kit PersonAvatar, used as the barber photo placeholder. */
export function Portrait({ preset = "sky", size = 236 }: { preset?: AvatarPreset; size?: number }) {
  const id = usePrefix("pt");
  const [bg, shirt, skin, hair, st] = AVATAR_PRESETS[preset];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden style={{ display: "block", flex: "none" }}>
      <defs><clipPath id={`${id}c`}><rect width="40" height="40" /></clipPath></defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="40" height="40" fill={bg} />
        <path d="M5 42c1-8.5 7-13 15-13s14 4.5 15 13Z" fill={shirt} />
        <rect x="17" y="22" width="6" height="8" rx="3" fill={skin} />
        <circle cx="20" cy="16.5" r="7.6" fill={skin} />
        <g fill={hair}>{st === "bun" ? <circle cx="20" cy="6.2" r="3.4" /> : null}<path d={HAIR[st]} /></g>
      </g>
    </svg>
  );
}

const CUTS: Record<HaircutKind, { top: string; sides?: boolean; beard?: boolean; op?: number }> = {
  fade: { top: "M11.4 15.6c0-5.6 3.8-8.8 8.6-8.8s8.6 3.2 8.6 8.8c-1.4-2.4-4.4-3.6-8.6-3.6s-7.2 1.2-8.6 3.6Z", sides: true },
  crew: { top: "M11.8 15c.4-5 3.8-7.6 8.2-7.6s7.8 2.6 8.2 7.6c-2-1.6-4.8-2.2-8.2-2.2s-6.2.6-8.2 2.2Z", sides: true },
  pompadour: { top: "M11.6 15.8c-.6-6.6 2.6-11.2 9.4-11.6 5.6-.3 9 3.8 7.6 11.6-1.8-2.4-4.8-3.4-8.4-3.4s-6.8 1-8.6 3.4Z" },
  twoblock: { top: "M11.2 17.6c-.4-7 3.6-11 8.8-11s9.2 4 8.8 11c-.6-1.6-1.4-2.8-2.6-3.6-2 1.6-5.2 2.4-9.2 2-2-.2-3.6-.8-4.6-1.6-.6 1-1 2-1.2 3.2Z" },
  buzz: { top: "M11.6 16.4c0-5.6 3.8-8.6 8.4-8.6s8.4 3 8.4 8.6c-1.6-2-4.4-3-8.4-3s-6.8 1-8.4 3Z", op: 0.5 },
  beard: { top: "M11.8 15.2c0-5 3.4-8 8.2-8s8.2 3 8.2 8c-1.2-1.8-3.8-3-8.2-3s-7 1.2-8.2 3Z", beard: true, sides: true },
};

/** Haircut thumbnail built on the kit PersonAvatar head (default haircut catalog art). */
export function HaircutArt({ kind, size = 64, preset = "sky" }: { kind: HaircutKind; size?: number; preset?: AvatarPreset }) {
  const id = usePrefix("hc");
  const [bg, shirt, skin, hair] = AVATAR_PRESETS[preset];
  const c = CUTS[kind];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden style={{ display: "block" }}>
      <defs>
        <clipPath id={id}><rect width="40" height="40" /></clipPath>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hair} stopOpacity=".7" /><stop offset="1" stopColor={hair} stopOpacity="0" /></linearGradient>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="40" height="40" fill={bg} />
        <path d="M6 44c1-8.5 6.6-12.6 14-12.6S33 35.5 34 44Z" fill={shirt} />
        <rect x="17" y="22" width="6" height="9" rx="3" fill={skin} />
        <ellipse cx="11.6" cy="18" rx="1.6" ry="2.2" fill={skin} /><ellipse cx="28.4" cy="18" rx="1.6" ry="2.2" fill={skin} />
        <ellipse cx="20" cy="17" rx="8" ry="8.6" fill={skin} />
        {c.sides ? <path d="M12 13.5 L12.4 19.5 L13.8 19.5 L13.6 13 Z M28 13.5 L27.6 19.5 L26.2 19.5 L26.4 13 Z" fill={`url(#${id}f)`} /> : null}
        {c.beard ? <path d="M12.4 18.6c.4 6 3.6 9.2 7.6 9.2s7.2-3.2 7.6-9.2c-1 2.2-2.6 3-3.6 3-1-.8-2.4-1.2-4-1.2s-3 .4-4 1.2c-1 0-2.6-.8-3.6-3Z" fill={hair} /> : null}
        <path d={c.top} fill={hair} opacity={c.op} />
      </g>
    </svg>
  );
}
