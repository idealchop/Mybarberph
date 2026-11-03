"use client";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * v1.0.43: the largest number size (px) at which no grid amount cell overflows (exact amounts, never clipped).
 * Starts at 10.5px and steps down to 7px; re-checks on data changes and on resize. Names may ellipsize; numbers never.
 */
export function useFitNumbers(deps: unknown[], max = 10.5, min = 7) {
  const ref = useRef<HTMLTableElement>(null);
  const [px, setPx] = useState(max);
  useLayoutEffect(() => {
    const t = ref.current; if (!t) return;
    const fit = () => {
      let s = max;
      const over = () => [...t.querySelectorAll("td")].some((td) => td.scrollWidth > td.clientWidth + 0.5);
      t.style.setProperty("--gn", `${s}px`);
      while (s > min && over()) { s = Math.round((s - 0.25) * 100) / 100; t.style.setProperty("--gn", `${s}px`); }
      setPx(s);
    };
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(t.parentElement ?? t);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, px };
}
