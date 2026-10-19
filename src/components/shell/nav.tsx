import type { NavItem } from "@river-apps/ui";
import { NavIcon3D } from "./nav-icon3d";

/** Lucide stroke used by older screen headers that are no longer in the nav. */
export const ic = { size: 20, strokeWidth: 1.75 } as const;

const BASE = [
  { key: "home", label: "Home", href: "/home" },
  { key: "queue", label: "Queue", href: "/queue" },
  { key: "moments", label: "Moments", href: "/moments" },
] as const;

/** Paid and Partner share the same three places, with River Mobile 3D icons. */
export function appNav(activeKey: string | undefined, size: number): NavItem[] {
  return BASE.map((it) => ({ ...it, icon: <NavIcon3D name={it.key} size={size} active={it.key === activeKey} /> }));
}

export function activeKeyFor(pathname: string): string | undefined {
  if (pathname === "/queue" || pathname.startsWith("/queue/")) return "queue";
  if (pathname === "/moments" || pathname.startsWith("/moments/")) return "moments";
  if (pathname === "/home" || pathname === "/") return "home";
  return undefined;
}
