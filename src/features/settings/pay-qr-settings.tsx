"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/common/button";
import { useShopProfile } from "@/lib/shop-profile";
import { uploadPhoto } from "@/lib/upload";

/** Services › Online payment QR: one QR (GCash, Maya, bank QR Ph…) shown to customers who choose Online. */
export function PayQrSettings() {
  const { profile, save, signedIn } = useShopProfile();
  const url = profile.payQrUrl ?? "";
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError("");
    // QR codes must stay sharp: keep up to 1600 px and high quality.
    try { save({ ...profile, payQrUrl: await uploadPhoto(file, 1600, 0.92) }); } catch (e) { setError((e as Error).message || "Upload failed. Try again."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return (
    <section className="mt-6">
      <h2 className="px-1 text-[13px] font-bold text-muted">Online payment QR</h2>
      <p className="mt-1 px-1 text-[13px] font-medium text-ink-2">Customers who choose Online when booking see this QR so they can pay there. GCash, Maya or a bank QR all work.</p>
      <div className="mt-2 flex items-center gap-3 rounded-card bg-surface p-3 shadow-card">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Payment QR code" className="size-20 flex-none rounded-[12px] bg-white object-contain ring-1 ring-grey-200" />
        ) : (
          <span className="inline-flex size-20 flex-none items-center justify-center rounded-[12px] bg-grey-100 text-center text-[11.5px] font-semibold text-muted">No QR yet</span>
        )}
        <span className="min-w-0 flex-1">
          <b className="block text-[15px]">Payment QR</b>
          <small className="block text-[12.5px] font-medium text-muted">{url ? "Shown when customers pick Online" : "Upload your shop's payment QR"}</small>
          <span className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant={url ? "secondary" : "primary"} loading={busy} disabled={!signedIn || busy} data-auth="action" onClick={() => input.current?.click()}>
              {busy ? "Uploading…" : url ? "Replace" : "Upload"}
            </Button>
            {url && !busy ? <Button size="sm" variant="ghost" disabled={!signedIn} onClick={() => save({ ...profile, payQrUrl: "" })}>Remove</Button> : null}
          </span>
          {error ? <small role="alert" className="mt-1 block text-[12px] font-semibold text-ink">{error}</small> : null}
        </span>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
    </section>
  );
}
