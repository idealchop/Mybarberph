import { cn } from "@river-apps/ui";
import type { CSSProperties, ReactNode } from "react";

/** Mobile-first column; phone-width card on desktop (MyCarwash Screen pattern). */
export function Screen({ children, tone = "white", className, style }: { children: ReactNode; tone?: "white" | "canvas"; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("min-h-dvh", tone === "canvas" ? "bg-canvas" : "bg-surface sm:bg-canvas")}>
      <div
        className={cn(
          "relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col pt-3",
          tone === "canvas" ? "bg-canvas" : "bg-surface sm:my-6 sm:min-h-[calc(100dvh-48px)] sm:rounded-device sm:shadow-card",
          className,
        )}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}

export function AuthBadge({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex size-[88px] items-center justify-center rounded-[28px] bg-grey-100">
      {children}
      <i aria-hidden className="absolute -right-1.5 top-1.5 size-4 rounded-full border-2 border-white/90 bg-white/35" />
      <i aria-hidden className="absolute -right-3.5 top-[26px] size-2.5 rounded-full border-2 border-white/90 bg-white/35" />
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center bg-canvas">
      <span className="size-8 animate-spin rounded-full border-[3px] border-grey-200 border-t-ink" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
