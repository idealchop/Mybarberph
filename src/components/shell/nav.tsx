import { ChartColumn, CircleHelp, LayoutGrid, List, MessageSquare, Scissors, Settings, TicketPercent, Users } from "lucide-react";
import type { Feature } from "@/lib/tier";

/** Lucide at stroke 1.75 / 20px, as in the kit demo. */
export const ic = { size: 20, strokeWidth: 1.75 } as const;

export interface ShopNavDef { key: Feature; label: string; short?: string; href: string; icon: React.ReactNode; badgeKey?: "queue" | "messages" }

export const SHOP_NAV: ShopNavDef[] = [
  { key: "dashboard", label: "Dashboard", short: "Home", href: "/dashboard", icon: <LayoutGrid {...ic} /> },
  { key: "queue", label: "Queue", href: "/queue", icon: <List {...ic} />, badgeKey: "queue" },
  { key: "sales", label: "Sales", short: "Sales", href: "/sales", icon: <ChartColumn {...ic} /> },
  { key: "customers", label: "Customers", href: "/customers", icon: <Users {...ic} /> },
  { key: "barbers", label: "Barbers", href: "/barbers", icon: <Scissors {...ic} /> },
  { key: "vouchers", label: "Vouchers", href: "/vouchers", icon: <TicketPercent {...ic} /> },
  { key: "messages", label: "Messages", href: "/messages", icon: <MessageSquare {...ic} />, badgeKey: "messages" },
  { key: "settings", label: "Settings", href: "/settings", icon: <Settings {...ic} /> },
];

export const HELP_ITEM = { key: "help", label: "Help", href: "/demo", icon: <CircleHelp {...ic} /> };
