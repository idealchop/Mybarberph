"use client";
import { Button as KitButton, type ButtonProps } from "@river-apps/ui";
import { Loader2 } from "lucide-react";
import { useState, type MouseEvent } from "react";

/**
 * Kit Button + `loading`. When onClick returns a promise, the button shows a spinner and stays
 * disabled until it settles, so async actions can't be double-tapped.
 */
export function Button(props: ButtonProps & { loading?: boolean }) {
  const { loading, ...rest } = props;
  const [pending, setPending] = useState(false);
  const busy = Boolean(loading) || pending;
  const onClick = (rest as { onClick?: (e: MouseEvent<HTMLElement>) => unknown }).onClick;
  const wrapped = onClick ? (e: MouseEvent<HTMLElement>) => {
    if (busy) { e.preventDefault(); return; }
    const r = onClick(e);
    if (r && typeof (r as Promise<unknown>).then === "function") {
      setPending(true);
      (r as Promise<unknown>).finally(() => setPending(false));
    }
  } : undefined;
  const p = { ...rest, ...(wrapped ? { onClick: wrapped } : {}) } as ButtonProps;
  if (!busy) return <KitButton {...p} />;
  return (
    <KitButton {...p} {...({ disabled: true, "aria-busy": true } as object)} leadingIcon={<Loader2 size={15} strokeWidth={2.2} className="animate-spin" aria-hidden />}>
      {p.children}
    </KitButton>
  );
}

/** Inline spinner for custom buttons. */
export function Spinner({ size = 14 }: { size?: number }) {
  return <Loader2 size={size} strokeWidth={2.2} className="animate-spin" aria-hidden />;
}
