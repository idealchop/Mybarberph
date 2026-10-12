"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Badge, Button, Card } from "@river-apps/ui";
import { fileToDataUrl } from "@/features/community/posts";

const MAX_SHOP_PHOTOS = 6;

/** Facade photos for the shop front. Changes stay in the editor until Save. */
export function ShopPhotos({ urls, onChange, disabled = false }: { urls: string[]; onChange: (urls: string[]) => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const full = urls.length >= MAX_SHOP_PHOTOS;

  async function addFiles(files: FileList | null) {
    if (!files?.length || disabled) return;
    setError("");
    setBusy(true);
    try {
      const next = [...urls];
      for (const file of Array.from(files)) {
        if (next.length >= MAX_SHOP_PHOTOS) break;
        if (!file.type.startsWith("image/")) continue;
        next.push(await fileToDataUrl(file, 960, 0.72));
      }
      onChange(next);
    } catch {
      setError("Couldn’t read those photos. Try a smaller image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    setError("");
    onChange(urls.filter((_, i) => i !== index));
  }

  return (
    <Card className="px-4 py-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <b className="text-[16px]">Facades</b>
          <p className="mt-0.5 text-[13px] font-medium text-muted">
            Photos of the shop front. JPG, PNG or WebP · up to {MAX_SHOP_PHOTOS}.
          </p>
        </div>
        <Badge variant="soft" size="sm" className="shrink-0">{urls.length}/{MAX_SHOP_PHOTOS}</Badge>
      </div>

      {urls.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {urls.map((url, i) => (
            <li key={`${i}-${url.slice(0, 24)}`} className="group relative overflow-hidden rounded-[16px] bg-grey-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Facade ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/80 text-white sm:opacity-0 sm:group-hover:opacity-100"
                aria-label={`Remove facade ${i + 1}`}
                disabled={busy}
                onClick={() => removeAt(i)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-tile border border-dashed border-line px-4 py-8 text-center text-[13.5px] font-semibold text-muted">
          No facades yet. Add a clear shot of the shop front first.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={busy || full || disabled}
        onChange={(e) => void addFiles(e.target.files)}
      />

      {error ? <p className="mt-3 text-[13px] font-semibold">{error}</p> : null}

      <div className="mt-3">
        <Button
          type="button"
          size="md"
          disabled={busy || full || disabled}
          leadingIcon={<ImagePlus size={18} />}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : full ? "Facade limit reached" : "Upload facades"}
        </Button>
      </div>
    </Card>
  );
}
