"use client";

import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge, Card } from "@river-apps/ui";
import { uploadPhoto } from "@/lib/upload";

export const MAX_SHOP_PHOTOS = 8;

type Pending = { key: string; preview: string };

/** Facade photos for the shop front. Tap the card to pick several; each shows uploading, then Uploaded. Changes stay until Save. */
export function ShopPhotos({ urls, onChange, onBusy, disabled = false }: { urls: string[]; onChange: (urls: string[]) => void; onBusy?: (busy: boolean) => void; disabled?: boolean }) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [swapAt, setSwapAt] = useState<number | null>(null);
  const [swapping, setSwapping] = useState<number | null>(null);
  const move = (from: number, to: number) => { if (to < 0 || to >= urls.length) return; const n = [...urls]; const [x] = n.splice(from, 1); n.splice(to, 0, x as string); onChange(n); };
  function startReplace(i: number) { setSwapAt(i); (document.getElementById("facade-replace") as HTMLInputElement | null)?.click(); }
  async function replace(files: FileList | null) {
    const i = swapAt; const f = files?.[0]; const el = document.getElementById("facade-replace") as HTMLInputElement | null; if (el) el.value = ""; 
    if (i === null || !f) return;
    setSwapping(i); setError("");
    try {
      const url = await uploadPhoto(f, 1280, 0.8);
      const n = [...latest.current]; n[i] = url; latest.current = n; onChange(n);
      setFresh((st) => new Set(st).add(url)); window.setTimeout(() => setFresh((st) => { const m = new Set(st); m.delete(url); return m; }), 4000);
    } catch (e) { setError((e as Error).message || "Couldn’t replace the photo."); } finally { setSwapping(null); setSwapAt(null); }
  }
  const latest = useRef(urls);
  useEffect(() => { latest.current = urls; }, [urls]);
  useEffect(() => { onBusy?.(pending.length > 0); }, [pending.length, onBusy]);
  const room = MAX_SHOP_PHOTOS - urls.length - pending.length;
  const full = room <= 0;
  const pick = () => { if (!full && !disabled) inputRef.current?.click(); };

  async function addFiles(files: FileList | null) {
    if (!files?.length || disabled) return;
    setError("");
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (inputRef.current) inputRef.current.value = "";
    const items = list.map((f, i) => ({ file: f, key: `${Date.now()}-${i}`, preview: URL.createObjectURL(f) }));
    setPending((cur) => [...cur, ...items.map(({ key, preview }) => ({ key, preview }))]);
    let ok = 0;
    await Promise.all(items.map(async (it) => {
      try {
        const url = await uploadPhoto(it.file, 1280, 0.8);
        latest.current = [...latest.current, url];
        onChange(latest.current);
        ok++;
        setFresh((s) => new Set(s).add(url));
        window.setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(url); return n; }), 4000);
      } catch (e) {
        setError((e as Error).message || "Couldn’t upload a photo. Try a smaller image.");
      } finally {
        URL.revokeObjectURL(it.preview);
        setPending((cur) => cur.filter((p) => p.key !== it.key));
      }
    }));
    if (ok) { setToast(`${ok} photo${ok === 1 ? "" : "s"} uploaded`); window.setTimeout(() => setToast(""), 3000); }
  }

  const empty = !urls.length && !pending.length;
  return (
    <Card className="px-4 py-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <b className="text-[16px]">Facades</b>
          <p className="mt-0.5 text-[13px] font-medium text-muted">Photos of the shop front. JPG, PNG or WebP · up to {MAX_SHOP_PHOTOS}.</p>
        </div>
        <Badge variant="soft" size="sm" className="shrink-0">{urls.length}/{MAX_SHOP_PHOTOS}</Badge>
      </div>

      {empty ? (
        <button type="button" data-auth="action" onClick={pick} disabled={disabled} aria-label="Upload facade photos"
          className="flex w-full flex-col items-center gap-2 rounded-tile border-2 border-dashed border-grey-300 px-4 py-9 text-center active:scale-[0.99]">
          <ImagePlus size={28} className="text-ink" />
          <b className="text-[14.5px]">Tap to add photos</b>
          <span className="text-[12.5px] font-semibold text-muted">Pick up to {MAX_SHOP_PHOTOS} at once. Start with a clear shot of the shop front.</span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {urls.map((url, i) => (
            <li key={`${i}-${url.slice(-24)}`} className="group relative overflow-hidden rounded-[16px] bg-grey-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Facade ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              {i === 0 ? <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-white/95 px-2 py-0.5 text-[11px] font-extrabold text-ink"><Star size={11} className="fill-ink" /> Cover</span> : null}
              {swapping === i ? <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/60 text-[12px] font-bold" role="status"><Loader2 size={22} className="animate-spin" /> Uploading…</span> : null}
              {fresh.has(url) && swapping !== i ? (
                <span className="absolute bottom-11 left-2 inline-flex items-center gap-1 rounded-pill bg-ink/85 px-2 py-1 text-[11.5px] font-bold text-white" role="status">
                  <Check size={13} strokeWidth={3} /> Uploaded
                </span>
              ) : null}
              <div className="flex items-center justify-between gap-1 bg-surface px-1.5 py-1.5">
                {([
                  [ArrowLeft, `Move facade ${i + 1} left`, () => move(i, i - 1), i === 0],
                  [ArrowRight, `Move facade ${i + 1} right`, () => move(i, i + 1), i === urls.length - 1],
                  [Star, `Set facade ${i + 1} as cover`, () => move(i, 0), i === 0],
                  [RefreshCw, `Replace facade ${i + 1}`, () => startReplace(i), false],
                  [Trash2, `Remove facade ${i + 1}`, () => onChange(urls.filter((_, j) => j !== i)), false],
                ] as const).map(([Ic, label, fn, off]) => (
                  <button key={label} type="button" aria-label={label} title={label} disabled={disabled || off || swapping !== null} onClick={fn}
                    className="inline-flex size-8 items-center justify-center rounded-full bg-grey-100 text-ink disabled:opacity-30">
                    <Ic size={15} strokeWidth={2} />
                  </button>
                ))}
              </div>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="relative overflow-hidden rounded-[16px] bg-grey-100" aria-busy="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="aspect-[4/3] w-full object-cover opacity-50" />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[12px] font-bold" role="status">
                <Loader2 size={22} className="animate-spin" /> Uploading…
              </span>
            </li>
          ))}
          {!full ? (
            <li>
              <button type="button" data-auth="action" onClick={pick} disabled={disabled} aria-label="Add more photos"
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-[16px] border-2 border-dashed border-grey-300 text-[12.5px] font-bold">
                <Plus size={22} /> Add photo
              </button>
            </li>
          ) : null}
        </ul>
      )}

      <input id="facade-replace" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void replace(e.target.files)} />
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={full || disabled} onChange={(e) => void addFiles(e.target.files)} />
      {toast ? <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold" role="status"><Check size={15} strokeWidth={3} /> {toast}</p> : null}
      {error ? <p className="mt-3 text-[13px] font-semibold">{error}</p> : null}
    </Card>
  );
}
