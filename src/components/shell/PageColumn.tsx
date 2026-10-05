import type { ReactNode } from "react";
import { cn } from "@river-apps/ui";

/**
 * Laundry.ph owner content column: centered with wide side margins.
 * Mobile max 560px → desktop max 880px (list pages) or wider for boards.
 */
export function PageColumn({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  /** Queue / dashboard boards that need more width (still centered). */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pb-6 pt-4",
        wide ? "max-w-[560px] lg:max-w-[1100px] lg:px-[30px] lg:pt-6" : "max-w-[560px] lg:max-w-[880px] lg:px-[30px] lg:pt-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
