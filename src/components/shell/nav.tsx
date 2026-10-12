import { House, List, MessagesSquare } from "lucide-react";
import type { NavItem } from "@river-apps/ui";

/** Lucide stroke used by older screen headers that are no longer in the nav. */
export const ic = { size: 20, strokeWidth: 1.75 } as const;

const side = { size: 20, strokeWidth: 1.75 } as const;
const tab = { size: 22, strokeWidth: 1.75 } as const;

/** Paid and Partner share the same three places. Account and the shop QR sit outside this list. */
export const APP_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: <House {...side} /> },
  { key: "queue", label: "Queue", href: "/queue", icon: <List {...side} /> },
  { key: "community", label: "Community", href: "/community", icon: <MessagesSquare {...side} /> },
];

export const APP_TABS: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: <House {...tab} /> },
  { key: "queue", label: "Queue", href: "/queue", icon: <List {...tab} /> },
  { key: "community", label: "Community", href: "/community", icon: <MessagesSquare {...tab} /> },
];

export function activeKeyFor(pathname: string): string | undefined {
  if (pathname === "/queue" || pathname.startsWith("/queue/")) return "queue";
  if (pathname === "/community" || pathname.startsWith("/community/")) return "community";
  if (pathname === "/home" || pathname === "/") return "home";
  return undefined;
}
