"use client";

import { Card, Topbar } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { Check, Copy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { makeQrPoster } from "@/lib/qr-poster";
import { QrCode } from "@/components/common/qr-code";
import { PageBack } from "@/components/shell/page-back";
import { useCloud } from "@/lib/cloud";
import { HOW_IT_WORKS } from "@/lib/chair-bookings";
import { qrTargets, type QrTarget } from "@/lib/qr-targets";
import { useShopLocations } from "@/lib/shop-locations";
import { useOwnerLogo, useShopProfile } from "@/lib/shop-profile";
import { useTier } from "@/lib/tier";

/** Paid shop page: one booking QR per location (v1.0.27), the active location first. */
export function QrScreen() {
  const { tier, setTier } = useTier();
  const { profile } = useShopProfile();
  const shops = useShopLocations();
  const cloud = useCloud();
  const ownerLogo = useOwnerLogo();
  const shopId = cloud.shopId;
  const [origin, setOrigin] = useState("");
  const [urlLoc, setUrlLoc] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only values (origin, ?loc) read once after hydration to avoid an SSR mismatch
  useEffect(() => { setOrigin(window.location.origin); setUrlLoc(new URLSearchParams(window.location.search).get("loc")); }, []);
  const listed = Boolean(profile.name && cloud.shop?.services.length);
  const activeId = (urlLoc && shops.branches.some((b) => b.id === urlLoc) ? urlLoc : null) ?? shops.scopeId;
  const targets = listed && shopId ? qrTargets({ origin, shopId, shopName: profile.name, enabled: shops.enabled, branches: shops.branches, activeId }) : [];

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

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 md:max-w-[760px] lg:max-w-[1080px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" leading={<PageBack fallback="/home" />} title="QR codes" subtitle={targets.length > 1 ? `One booking QR per location · ${targets.length} locations` : "Customers scan this to book"} />
      <div className="mt-5 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        {!listed ? (
          <Card className="px-5 py-6 text-center">
            <b className="text-[16px]">Booking</b>
            <p className="mx-auto mt-1 max-w-[300px] text-[13px] font-medium text-muted">Add the shop name and save your haircut in Services. Then your QR codes appear here.</p>
          </Card>
        ) : (
          <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0" aria-label="Booking QR codes">
            {targets.map((t) => <QrCard key={t.id ?? "main"} t={t} shopName={profile.name} logo={ownerLogo} />)}
          </ul>
        )}
        <Card className="px-5 py-5 lg:sticky lg:top-6">
          <h2 className="text-[16px] font-extrabold tracking-[-0.02em]">How it works</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-7 flex-none items-center justify-center rounded-full bg-ink text-[13px] font-bold text-on-ink">{i + 1}</span>
                <p className="pt-0.5 text-[14px] font-medium leading-snug text-ink-2">{step}</p>
              </li>
            ))}
          </ol>
          {shops.enabled ? <Button size="sm" variant="secondary" className="mt-4" href="/settings/shops">Manage locations</Button> : null}
        </Card>
      </div>
    </div>
  );
}

/** One location's QR: name, code, link, Copy link and Download QR (file named after the location). */
function QrCard({ t, shopName, logo }: { t: QrTarget; shopName: string; logo?: string | null }) {
  const [copied, setCopied] = useState(false);
  const [making, setMaking] = useState(false);
  const copy = () => { void navigator.clipboard?.writeText(t.url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }); };
  const download = async () => {
    if (making) return;
    setMaking(true);
    try {
      const blob = await makeQrPoster({ url: t.url, shopName, place: t.id ? t.name : "", logoUrl: logo || undefined });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = href; a.download = t.file; a.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } finally { setMaking(false); }
  };
  return (
    <li className={`flex w-full min-w-0 flex-col items-center overflow-hidden rounded-card bg-surface px-4 py-5 text-center shadow-card ${t.active ? "ring-2 ring-ink" : ""}`}>
      <span className="flex max-w-full items-center gap-2">
        <b className="truncate text-[16px]">{t.name}</b>
        {t.active ? <span className="flex-none rounded-pill bg-ink px-2 py-0.5 text-[11px] font-bold text-on-ink">Active</span> : null}
      </span>
      {/* v1.0.36: centered, shrinks on narrow phones (max 188px code), never wider than the card. */}
      <div className="mx-auto mt-3 w-full max-w-[212px] rounded-tile bg-surface p-3 ring-1 ring-grey-200 [&_svg]:h-auto [&_svg]:w-full">
        <QrCode value={t.url} size={188} label={`Booking QR code for ${t.name}`} logo={logo || "/icon-192.png"} />
      </div>
      <p className="mt-3 w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] font-medium text-subtle" title={t.url}>{t.url.replace(/^https?:\/\//, "")}</p>
      <div className="mt-3 grid w-full min-w-0 grid-cols-2 gap-2 [&>*]:min-w-0 [&>*]:w-full">
        <Button size="sm" variant="secondary" onClick={copy} leadingIcon={copied ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} />}><span className="truncate">{copied ? "Copied" : "Copy link"}</span></Button>
        <Button size="sm" onClick={download} loading={making} leadingIcon={<Download size={15} />}><span className="truncate">Download</span></Button>
      </div>
    </li>
  );
}
