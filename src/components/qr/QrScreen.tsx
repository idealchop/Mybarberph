"use client";

import { Button, Card, Topbar } from "@river-apps/ui";
import { useEffect, useState } from "react";
import { QrCode } from "@/components/common/QrCode";
import { PageBack } from "@/components/shell/PageBack";
import { useCloud } from "@/lib/cloud";
import { HOW_IT_WORKS, bookingUrl } from "@/lib/chair-bookings";
import { useShopLocations } from "@/lib/shop-locations";
import { useShopProfile } from "@/lib/shop-profile";
import { useTier } from "@/lib/tier";

/** Paid shop page: one QR customers scan to book. */
export function QrScreen() {
  const { tier, setTier } = useTier();
  const { profile } = useShopProfile();
  const shops = useShopLocations();
  const cloud = useCloud();
  const shopId = cloud.shopId;
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const locationId = shops.enabled && shops.scopeId ? shops.scopeId : undefined;
  const listed = Boolean(profile.name && cloud.shop?.services.length);
  const url = origin && shopId && listed && !shops.viewingAll ? bookingUrl(origin, shopId, locationId) : "";
  const who = shops.enabled && shops.branch ? `${profile.name} · ${shops.branch.name}` : profile.name || "your shop";

  if (tier !== "paid") {
    return (
      <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-6">
        <div className="flex items-center gap-1">
          <PageBack fallback="/home" />
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Shop QR</h1>
        </div>
        <p className="mt-2 text-[15px] font-medium text-ink-2">The booking QR is part of Paid, with walk-ins.</p>
        <Button className="mt-5" onClick={() => setTier("paid")}>See Paid</Button>
      </div>
    );
  }

  const copy = () => {
    if (!url) return;
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[960px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" leading={<PageBack fallback="/home" />} title="QR code" subtitle={shops.viewingAll ? "Open one shop in Settings → Shops. Each shop has its own QR." : `Customers scan this for ${who}`} />
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card className="flex flex-col items-center px-4 py-5 text-center">
          <b className="text-[16px]">Booking</b>
          <p className="mt-1 max-w-[280px] text-[13px] font-medium text-muted">{shops.viewingAll ? "This code stays blank until one shop is open." : !listed ? "Add the shop name and save your haircut in Services. Then your QR appears here." : `One code for ${who}.`}</p>
          <div className="mt-4 rounded-tile bg-surface p-3 ring-1 ring-grey-200">
            {url ? <QrCode value={url} size={220} label="Booking QR code" /> : <span className="block size-[220px]" />}
          </div>
          <p className="mt-3 max-w-full break-all font-mono text-[12px] font-semibold text-muted">{url || " "}</p>
          {shops.viewingAll ? <Button size="sm" className="mt-3" href="/settings/shops">Shops</Button> : (
            <Button size="sm" variant="secondary" className="mt-3" disabled={!url} onClick={copy}>{copied ? "Copied" : "Copy link"}</Button>
          )}
        </Card>
        <Card className="px-5 py-5">
          <h2 className="text-[16px] font-extrabold tracking-[-0.02em]">How it works</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-7 flex-none items-center justify-center rounded-full bg-ink text-[13px] font-bold text-on-ink">{i + 1}</span>
                <p className="pt-0.5 text-[14px] font-medium leading-snug text-ink-2">{step}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
