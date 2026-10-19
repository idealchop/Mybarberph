"use client";

/* eslint-disable @next/next/no-img-element -- user images of unknown size. */
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@river-apps/ui";

/** Post photos. One photo is large; several sit in a grid. Tap opens them. */
export function PostMedia({ images, alt, className }: { images: string[]; alt: string; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;

  const tile = (src: string, i: number, cls: string) => (
    <button key={`${i}-${src.slice(0, 40)}`} type="button" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${images.length}`} className={cn("relative block overflow-hidden bg-grey-100", cls)}>
      <img src={src} alt={images.length === 1 ? alt : ""} loading="lazy" className="size-full object-cover" />
      {extra > 0 && i === 3 ? <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[24px] font-extrabold text-white">+{extra}</span> : null}
    </button>
  );

  return (
    <>
      <div className={cn("overflow-hidden rounded-[16px] ring-1 ring-inset ring-black/5", className)}>
        {shown.length === 1 ? (
          <button type="button" onClick={() => setOpen(0)} aria-label="Open photo" className="block w-full bg-grey-100">
            <img src={shown[0]} alt={alt} loading="lazy" className="max-h-[560px] min-h-[180px] w-full object-cover" />
          </button>
        ) : shown.length === 2 ? (
          <div className="grid grid-cols-2 gap-0.5">{shown.map((s, i) => tile(s, i, "aspect-[4/5]"))}</div>
        ) : shown.length === 3 ? (
          <div className="grid grid-cols-2 gap-0.5">
            {tile(shown[0]!, 0, "col-span-2 aspect-[16/10]")}
            {tile(shown[1]!, 1, "aspect-square")}
            {tile(shown[2]!, 2, "aspect-square")}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-0.5">{shown.map((s, i) => tile(s, i, "aspect-square"))}</div>
        )}
      </div>
      {open != null ? <Lightbox images={images} start={open} alt={alt} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function Lightbox({ images, start, alt, onClose }: { images: string[]; start: number; alt: string; onClose: () => void }) {
  const [i, setI] = useState(start);
  const many = images.length > 1;
  const go = useCallback((d: number) => setI((v) => (v + d + images.length) % images.length), [images.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);
  const ctl = "absolute flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25";
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92" onClick={onClose}>
      <img src={images[i]} alt={alt} className="max-h-[88vh] max-w-[94vw] rounded-[12px] object-contain" onClick={(e) => e.stopPropagation()} />
      <button type="button" aria-label="Close" className={cn(ctl, "right-4 top-4")} onClick={onClose}><X size={22} strokeWidth={2} /></button>
      {many ? (
        <>
          <button type="button" aria-label="Previous photo" className={cn(ctl, "left-3 top-1/2 -translate-y-1/2")} onClick={(e) => { e.stopPropagation(); go(-1); }}><ChevronLeft size={24} /></button>
          <button type="button" aria-label="Next photo" className={cn(ctl, "right-3 top-1/2 -translate-y-1/2")} onClick={(e) => { e.stopPropagation(); go(1); }}><ChevronRight size={24} /></button>
          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-pill bg-white/15 px-3 py-1 text-[13px] font-bold text-white">{i + 1} / {images.length}</span>
        </>
      ) : null}
    </div>
  );
}
