"use client";

import { Card, Topbar } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { Check, Copy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { makeQrPoster } from "@/lib/qr-poster";
import { QrCode } from "@/components/common/QrCode";
import { PageBack } from "@/components/shell/PageBack";
import { useCloud } from "@/lib/cloud";
import { HOW_IT_WORKS, bookingUrl } from "@/lib/chair-bookings";
import { useShopLocations } from "@/lib/shop-locations";
import { useOwnerLogo, useShopProfile } from "@/lib/shop-profile";
import { useTier } from "@/lib/tier";

/** Paid shop page: one QR customers scan to book. */
export function QrScreen() {
  const { tier, setTier } = useTier();
  const { profile } = useShopProfile();
  const shops = useShopLocations();
  const cloud = useCloud();
  const ownerLogo = useOwnerLogo();
  const shopId = cloud.shopId;
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [making, setMaking] = useState(false);
  const [urlLoc, setUrlLoc] = useState<string | null>(null);
  useEffect(() => { setOrigin(window.location.origin); setUrlLoc(new URLSearchParams(window.location.search).get("loc")); }, []);
  const fromUrl = urlLoc && shops.branches.find((b) => b.id === urlLoc);
  const locationId = shops.enabled && fromUrl ? fromUrl.id : shops.enabled && shops.scopeId ? shops.scopeId : undefined;
  const listed = Boolean(profile.name && cloud.shop?.services.length);
  const url = origin && shopId && listed && (!shops.viewingAll || fromUrl) ? bookingUrl(origin, shopId, locationId) : "";
  const who = fromUrl ? `${profile.name} · ${fromUrl.name}` : shops.enabled && shops.branch ? `${profile.name} · ${shops.branch.name}` : profile.name || "your shop";

  if (tier !== "paid") {
    return (
      <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-6">
        <div className="flex items-center gap-1">
          <PageBack fallback="/home" />
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Shop QR</h1>
        </div>
        <p className="mt-2 text-[15px] font-medium text-ink-2">The booking QR is part of Pro and Lifetime.</p>
        <Button className="mt-5" onClick={() => setTier("paid")}>See Pro</Button>
      </div>
    );
  }

  const poster = async (mode: "download" | "print") => {
    if (!url || making) return;
    setMaking(true);
    try {
      const place = (fromUrl ? fromUrl.name : "") || (shops.enabled ? shops.branch?.name : "") || profile.area || "";
      const blob = await makeQrPoster({ url, shopName: profile.name, place, logoUrl: ownerLogo || undefined });
      const href = URL.createObjectURL(blob);
      if (mode === "download") {
        const a = document.createElement("a"); a.href = href; a.download = `${(profile.name || "shop").replace(/[^\w]+/g, "-")}${place ? `-${place.replace(/[^\w]+/g, "-")}` : ""}-QR-poster.png`; a.click();
      } else {
        const w = window.open("", "_blank");
        w?.document.write(`<title>QR poster</title><style>@page{size:A5;margin:0}html,body{margin:0}img{width:100%;height:auto;display:block}</style><img src="${href}" onload="setTimeout(()=>print(),200)">`);
      }
      window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } finally { setMaking(false); }
  };
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
            {url ? <QrCode value={url} size={220} label="Booking QR code" logo={ownerLogo || "/icon-192.png"} /> : <span className="block size-[220px]" />}
          </div>
          <p className="mt-3 max-w-[260px] truncate font-mono text-[11px] font-medium text-subtle" title={url}>{url ? url.replace(/^https?:\/\//, "") : " "}</p>
          {shops.viewingAll ? <Button size="sm" className="mt-3" href="/settings/shops">Manage Locations</Button> : (
            <>
              <div className="mt-3 grid w-full grid-cols-2 gap-2">
                <Button size="sm" variant="secondary" disabled={!url} onClick={copy} leadingIcon={copied ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} />}>{copied ? "Copied" : "Copy link"}</Button>
                <Button size="sm" disabled={!url || making} onClick={() => void poster("download")} leadingIcon={<Download size={15} />}>{making ? "Making…" : "Download QR"}</Button>
              </div>
            </>
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
