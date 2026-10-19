"use client";
import { useEffect, useState } from "react";

export interface PublicShop {
  id: string;
  name: string;
  address: string;
  area: string;
  hours: string | null;
  hoursWeek?: import("@/lib/shop-hours").WeekHours | null;
  location: { lat: number; lng: number; formattedAddress: string } | null;
  photoUrls: string[];
  logoUrl: string | null;
  branches: { id: string; name: string; address: string; area: string }[];
  services: { id: string; name: string; durationMins: number; price: number; kind: "haircut" | "treatment"; icon?: string | null }[];
  servicesByLocation?: Record<string, PublicShop["services"]>;
}

/** Public shop profile for the customer booking page. `null` = not found. */
export function usePublicShop(shopId: string) {
  const [shop, setShop] = useState<PublicShop | null | undefined>(undefined);
  const [payOnline, setPayOnline] = useState(false);
  useEffect(() => {
    if (!shopId) return;
    let live = true;
    fetch(`/api/public/shops/${encodeURIComponent(shopId)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()).shop as PublicShop) : null))
      .then((s) => { if (live) setShop(s); })
      .catch(() => { if (live) setShop(null); });
    fetch("/api/billing/status").then((r) => r.json()).then((d) => { if (live) setPayOnline(Boolean(d.paymongo)); }).catch(() => undefined);
    return () => { live = false; };
  }, [shopId]);
  return { shop, payOnline };
}
