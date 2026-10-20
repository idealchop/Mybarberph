"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/common/button";
import { WALLET_LABEL, type Wallet } from "@/components/qr/pay-qr";
import { useShopProfile } from "@/lib/shop-profile";
import { uploadPhoto } from "@/lib/upload";

/** Services › Payment QR codes: the shop's GCash and Maya QR images, shown to customers who pick that wallet. */
export function PayQrSettings() {
  const { profile, save, signedIn } = useShopProfile();
  return (
    <section className="mt-6">
      <h2 className="px-1 text-[13px] font-bold text-muted">Payment QR codes</h2>
      <p className="mt-1 px-1 text-[13px] font-medium text-ink-2">Customers who choose GCash or Maya when booking see your QR so they can pay there.</p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {(["gcash", "maya"] as const).map((w) => (
          <QrCard key={w} wallet={w} url={profile.payQr?.[w] ?? ""} disabled={!signedIn}
            onChange={(url) => save({ ...profile, payQr: { gcash: profile.payQr?.gcash ?? "", maya: profile.payQr?.maya ?? "", [w]: url } })} />
        ))}
      </div>
    </section>
  );
}

function QrCard({ wallet, url, disabled, onChange }: { wallet: Wallet; url: string; disabled?: boolean; onChange: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = WALLET_LABEL[wallet];
  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError("");
    // QR codes must stay sharp: keep up to 1600 px and high quality.
    try { onChange(await uploadPhoto(file, 1600, 0.92)); } catch (e) { setError((e as Error).message || "Upload failed. Try again."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-card">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`${label} QR code`} className="size-20 flex-none rounded-[12px] bg-white object-contain ring-1 ring-grey-200" />
      ) : (
        <span className="inline-flex size-20 flex-none items-center justify-center rounded-[12px] bg-grey-100 text-center text-[11.5px] font-semibold text-muted">No QR yet</span>
      )}
      <span className="min-w-0 flex-1">
        <b className="block text-[15px]">{label}</b>
        <small className="block text-[12.5px] font-medium text-muted">{url ? "Shown when customers pick " + label : "Upload your " + label + " QR"}</small>
        <span className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant={url ? "secondary" : "primary"} loading={busy} disabled={disabled || busy} data-auth="action" onClick={() => input.current?.click()}>
            {busy ? "Uploading…" : url ? "Replace" : "Upload"}
          </Button>
          {url && !busy ? <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange("")}>Remove</Button> : null}
        </span>
        {error ? <small role="alert" className="mt-1 block text-[12px] font-semibold text-ink">{error}</small> : null}
      </span>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
