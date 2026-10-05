"use client";

import { useRef, useState } from "react";
import { ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { Button, cn } from "@river-apps/ui";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { getRepository, isFirebaseDataSource, type Shop } from "@/data";

const MAX_PHOTOS = 8;
const MAX_BYTES = 5 * 1024 * 1024;

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Multi-photo gallery for River Mobile — upload / remove / set cover. Guests hit the auth gate. */
export function ShopPhotosGallery({
  shop,
  onChange,
}: {
  shop: Shop;
  onChange: (shop: Shop) => void;
}) {
  const { requireAuth, isAuthenticated } = useAuthGate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photos = shop.shopPhotos ?? [];
  const cover = shop.coverPhoto ?? photos[0];

  async function uploadFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Choose a photo (JPG, PNG, WebP, or GIF).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Photo must be 5 MB or smaller.");
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      setError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    if (!isAuthenticated) {
      requireAuth(() => void uploadFile(file), "Sign in to upload shop photos for River Mobile.");
      return;
    }

    setBusy(true);
    try {
      if (isFirebaseDataSource()) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/shop-photos", { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({}))) as { result?: Shop; error?: string };
        if (!res.ok) throw new Error(json.error || "Upload failed");
        if (json.result) onChange(json.result);
      } else {
        const url = await readDataUrl(file);
        const nextPhotos = [...photos, url];
        const next = await getRepository().updateShopProfile({
          shopPhotos: nextPhotos,
          coverPhoto: cover || url,
        });
        onChange(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removePhoto(url: string) {
    if (!isAuthenticated) {
      requireAuth(() => void removePhoto(url), "Sign in to remove shop photos.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isFirebaseDataSource()) {
        const res = await fetch("/api/shop-photos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const json = (await res.json().catch(() => ({}))) as { result?: Shop; error?: string };
        if (!res.ok) throw new Error(json.error || "Remove failed");
        if (json.result) onChange(json.result);
      } else {
        const nextPhotos = photos.filter((u) => u !== url);
        const next = await getRepository().updateShopProfile({
          shopPhotos: nextPhotos,
          coverPhoto: cover === url ? nextPhotos[0] : cover,
        });
        onChange(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function setCover(url: string) {
    if (!isAuthenticated) {
      requireAuth(() => void setCover(url), "Sign in to set your cover photo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isFirebaseDataSource()) {
        const res = await fetch("/api/shop-photos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coverPhoto: url }),
        });
        const json = (await res.json().catch(() => ({}))) as { result?: Shop; error?: string };
        if (!res.ok) throw new Error(json.error || "Could not set cover");
        if (json.result) onChange(json.result);
      } else {
        const next = await getRepository().updateShopProfile({ coverPhoto: url });
        onChange(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set cover");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="md:col-span-2">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col leading-snug">
          <b className="text-[14px]">Shop photos</b>
          <span className="mt-0.5 text-[12.5px] font-medium text-muted">
            Shown on River Mobile so customers see how your shop looks · up to {MAX_PHOTOS}
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || photos.length >= MAX_PHOTOS}
          leadingIcon={<Upload size={15} strokeWidth={1.75} />}
          onClick={() => {
            if (!isAuthenticated) {
              requireAuth(() => inputRef.current?.click(), "Sign in to upload shop photos for River Mobile.");
              return;
            }
            inputRef.current?.click();
          }}
        >
          {busy ? "Working…" : "Add photo"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
          }}
        />
      </div>

      {photos.length === 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!isAuthenticated) {
              requireAuth(() => inputRef.current?.click(), "Sign in to upload shop photos for River Mobile.");
              return;
            }
            inputRef.current?.click();
          }}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-grey-300 bg-grey-50 px-4 py-10 text-center transition-colors hover:bg-grey-100"
        >
          <ImagePlus size={28} strokeWidth={1.5} className="text-muted" />
          <b className="text-[14px]">Add photos of your shop</b>
          <span className="max-w-[280px] text-[12.5px] font-medium text-muted">
            Storefront, chairs, and waiting area help River Mobile customers pick you.
          </span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((url) => {
            const isCover = url === cover;
            return (
              <li key={url} className="group relative aspect-[4/3] overflow-hidden rounded-[16px] bg-grey-100 shadow-tile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-full object-cover" />
                {isCover ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-ink px-2 py-0.5 text-[11px] font-bold text-on-ink">
                    <Star size={11} fill="currentColor" strokeWidth={0} /> Cover
                  </span>
                ) : null}
                <div className={cn(
                  "absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/55 to-transparent p-2 pt-8",
                  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                )}>
                  {!isCover ? (
                    <Button size="xs" variant="white" className="flex-1" disabled={busy} onClick={() => void setCover(url)}>
                      Set cover
                    </Button>
                  ) : null}
                  <Button
                    size="xs"
                    variant="white"
                    aria-label="Remove photo"
                    disabled={busy}
                    onClick={() => void removePhoto(url)}
                    leadingIcon={<Trash2 size={13} strokeWidth={1.75} />}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="mt-2 text-[12.5px] font-semibold text-muted">{error}</p> : null}
    </div>
  );
}
