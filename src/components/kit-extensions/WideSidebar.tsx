import { Sidebar, cn, type SidebarProps } from "@river-apps/ui";

export interface WideSidebarProps extends SidebarProps {
  /** `wide` = 268px so long module names don’t truncate (Laundry.ph owner pattern). */
  size?: "default" | "wide";
}

export function WideSidebar({ size = "wide", className, ...rest }: WideSidebarProps) {
  return <Sidebar className={cn(size === "wide" && "w-[268px]", className)} {...rest} />;
}
