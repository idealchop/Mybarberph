"use client";
import { Button as KitButton, cn, type ButtonProps as KitProps } from "@river-apps/ui";
import { Loader2 } from "lucide-react";
import { useRef, useState, type MouseEvent } from "react";

/**
 * The app's ONE button (v1.0.22, Jimboy: "be consistent with buttons; show loading on the button").
 * Kit variants plus `danger`, `dark` (white-on-dark) and `icon` (round, icon-only, 44px).
 * `loading`, or an onClick that returns a promise, shows an inline spinner in place of the label (the width is kept,
 * the label stays for screen readers), disables the button and ignores repeat taps until the action settles.
 */
export type ButtonVariant = KitProps["variant"] | "danger" | "danger-outline" | "dark";
type Extra = { variant?: ButtonVariant; loading?: boolean; icon?: boolean };
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ButtonProps = DistOmit<KitProps, "variant"> & Extra;

const EXTRA: Record<string, string> = {
  danger: "!bg-[#D92D20] !text-white !shadow-none hover:!bg-[#B42318]",
  "danger-outline": "!bg-surface !text-[#D92D20] !ring-[1.5px] !ring-inset !ring-[#D92D20]",
  dark: "",
};

export function Button(props: ButtonProps) {
  const { loading, icon, variant, className, leadingIcon, trailingIcon, children, ...rest } = props;
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const busy = Boolean(loading) || pending;
  const onClick = (rest as { onClick?: (e: MouseEvent<HTMLElement>) => unknown }).onClick;
  function handle(e: MouseEvent<HTMLElement>) {
    if (busy || lock.current || !onClick) { e.preventDefault(); return; }
    const r = onClick(e);
    if (r && typeof (r as Promise<unknown>).then === "function") {
      lock.current = true; setPending(true);
      (r as Promise<unknown>).finally(() => { lock.current = false; setPending(false); });
    }
  }
  const kitVariant = (variant === "danger" || variant === "danger-outline" ? "primary" : variant === "dark" ? "ghost-inverse" : variant) as KitProps["variant"];
  const cls = cn(
    "relative active:scale-[0.98] transition-[transform,background-color]",
    variant && EXTRA[variant],
    icon && "!size-11 !rounded-full !p-0",
    busy && "!opacity-100 cursor-progress",
    className,
  );
  const p = { ...rest, ...(onClick ? { onClick: handle } : {}), variant: kitVariant, className: cls } as KitProps;
  if (!busy) return <KitButton {...p} leadingIcon={leadingIcon} trailingIcon={trailingIcon}>{children}</KitButton>;
  return (
    <KitButton {...p} {...({ disabled: true, "aria-busy": true } as object)}>
      <span className="invisible inline-flex items-center gap-[inherit]">{leadingIcon}{children}{trailingIcon}</span>
      <span className="absolute inset-0 flex items-center justify-center"><Loader2 size={icon ? 18 : 17} strokeWidth={2.4} className="animate-spin" aria-hidden /></span>
    </KitButton>
  );
}

/** Inline spinner for the rare custom control (toggles, tiles) that can't be a Button. */
export function Spinner({ size = 14 }: { size?: number }) {
  return <Loader2 size={size} strokeWidth={2.2} className="animate-spin" aria-hidden />;
}
