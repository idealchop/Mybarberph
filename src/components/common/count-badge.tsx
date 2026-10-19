"use client";
import { useEffect, useRef, useState } from "react";

/** Vivid red count badge with white bold text; hidden at 0; pulses briefly when the count goes up. */
export function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  const prev = useRef(count);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const up = count > prev.current;
    prev.current = count;
    if (!up) return;
    const a = window.setTimeout(() => setPulse(true), 0);
    const b = window.setTimeout(() => setPulse(false), 2400);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [count]);
  if (count <= 0) return null;
  return (
    <span className={`relative inline-flex ${className}`} aria-hidden>
      {pulse ? <span className="absolute inset-0 animate-ping rounded-full bg-[#E5352B] opacity-60 motion-reduce:hidden" /> : null}
      <span className="relative inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E5352B] px-1.5 text-[11.5px] font-extrabold tabular-nums leading-5 text-white">{count > 99 ? "99+" : count}</span>
    </span>
  );
}
