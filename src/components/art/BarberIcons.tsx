"use client";
import type { ReactNode } from "react";
import { KitDefs, ref, usePrefix } from "./defs";

export type BarberIconName = "scissors" | "clipper" | "pole" | "ticket" | "gift" | "qr";

const shapes: Record<BarberIconName, (p: string) => ReactNode> = {
  scissors: (p) => (
    <g filter={ref(p, "sh")}>
      <path d="M53 8 L26 42" stroke={ref(p, "rim")} strokeWidth="6" strokeLinecap="round" />
      <path d="M11 8 L38 42" stroke={ref(p, "rim")} strokeWidth="6" strokeLinecap="round" />
      <path d="M48 12 L36 27" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
      <circle cx="21" cy="49" r="8" fill="none" stroke={ref(p, "peach")} strokeWidth="5.5" />
      <circle cx="43" cy="49" r="8" fill="none" stroke={ref(p, "sky")} strokeWidth="5.5" />
      <circle cx="32" cy="29" r="3.2" fill={ref(p, "gold")} />
    </g>
  ),
  clipper: (p) => (
    <g filter={ref(p, "sh")}>
      <rect x="19" y="7" width="26" height="10" rx="3" fill={ref(p, "rim")} />
      <path d="M22 7v-3M26 7v-3M30 7v-3M34 7v-3M38 7v-3M42 7v-3" stroke="#7E8794" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 18 C18 15 20 14 23 14 L41 14 C44 14 46 15 46 18 L44 50 C44 55 40 58 32 58 C24 58 20 55 20 50 Z" fill={ref(p, "sky")} />
      <rect x="28" y="28" width="8" height="13" rx="4" fill="#fff" opacity=".9" />
      <circle cx="32" cy="32" r="2.4" fill="#2563EB" />
      <path d="M24 21 C24 19 25 18 27 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".75" />
    </g>
  ),
  pole: (p) => (
    <>
      <defs><clipPath id={`${p}-clip`}><rect x="23" y="14" width="18" height="36" rx="9" /></clipPath></defs>
      <g filter={ref(p, "sh")}>
        <rect x="23" y="14" width="18" height="36" rx="9" fill="#fff" />
        <g clipPath={`url(#${p}-clip)`}>
          <path d="M14 22 L50 4 L50 11 L14 29Z M14 36 L50 18 L50 25 L14 43Z M14 50 L50 32 L50 39 L14 57Z" fill={ref(p, "peach")} />
          <path d="M14 29 L50 11 L50 14.5 L14 32.5Z M14 43 L50 25 L50 28.5 L14 46.5Z" fill={ref(p, "sky")} />
        </g>
        <rect x="23" y="14" width="18" height="36" rx="9" fill="none" stroke="#D6DBE2" strokeWidth="1.2" />
        <path d="M21 14 C21 9 25 6 32 6 C39 6 43 9 43 14 Z" fill={ref(p, "gold")} />
        <path d="M21 50 L43 50 L41 58 L23 58 Z" fill={ref(p, "gold")} />
        <path d="M27 19 L27 44" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      </g>
    </>
  ),
  ticket: (p) => (
    <g filter={ref(p, "sh")}>
      <path d="M8 18 C8 15 10 13 13 13 L51 13 C54 13 56 15 56 18 L56 26 C52 26 50 29 50 32 C50 35 52 38 56 38 L56 46 C56 49 54 51 51 51 L13 51 C10 51 8 49 8 46 L8 38 C12 38 14 35 14 32 C14 29 12 26 8 26 Z" fill={ref(p, "lil")} />
      <path d="M38 17 L38 47" stroke="#fff" strokeOpacity=".7" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M18 26 L30 26 M18 33 L28 33" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  gift: (p) => (
    <g filter={ref(p, "sh")}>
      <rect x="10" y="26" width="44" height="28" rx="5" fill={ref(p, "peach")} />
      <rect x="7" y="18" width="50" height="11" rx="4" fill={ref(p, "peach")} />
      <rect x="28" y="18" width="8" height="36" fill={ref(p, "gold")} />
      <path d="M32 18 C26 8 16 10 20 16 C22 19 28 18 32 18 C36 18 42 19 44 16 C48 10 38 8 32 18 Z" fill={ref(p, "gold")} />
      <path d="M13 32 L13 46" stroke="#fff" strokeOpacity=".6" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  qr: (p) => (
    <g filter={ref(p, "sh")}>
      <rect x="8" y="8" width="48" height="48" rx="10" fill="#fff" />
      <rect x="14" y="14" width="14" height="14" rx="3" fill="#0A0A0A" /><rect x="36" y="14" width="14" height="14" rx="3" fill="#0A0A0A" /><rect x="14" y="36" width="14" height="14" rx="3" fill="#0A0A0A" />
      <rect x="18" y="18" width="6" height="6" rx="1" fill="#fff" /><rect x="40" y="18" width="6" height="6" rx="1" fill="#fff" /><rect x="18" y="40" width="6" height="6" rx="1" fill="#fff" />
      <rect x="36" y="36" width="5" height="5" fill="#0A0A0A" /><rect x="45" y="36" width="5" height="5" fill="#0A0A0A" /><rect x="40" y="44" width="5" height="6" fill="#0A0A0A" />
      <path d="M4 30 L60 30" stroke={ref(p, "mint")} strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
};

/**
 * Barber 3D icons drawn in the kit's style (kit gradient set + drop shadow, 64×64 grid). New art for
 * Barbers.ph; generic icons (sparkle, coin, check, shield, chat) come from @river-apps/icons.
 */
export function BarberIcon({ name, size = 32, title, className }: { name: BarberIconName; size?: number; title?: string; className?: string }) {
  const p = usePrefix("bi");
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={{ display: "block", flex: "none" }}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}>
      <KitDefs p={p} />
      {shapes[name](p)}
    </svg>
  );
}
