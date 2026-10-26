"use client";
import { useEffect, useState } from "react";

/** Current time for render-time date math (Manila day bounds). Refreshes every minute so day rollovers show up. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
