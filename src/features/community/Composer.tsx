"use client";

/* eslint-disable @next/next/no-img-element -- local photo previews (data URLs). */
import { ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Avatar, Button, cn } from "@river-apps/ui";
import { fileToDataUrl, profileHref, type PostAuthor } from "./posts";

const MAX_IMAGES = 4;
const MAX_CHARS = 1000;

/** "What's new?" composer. Text plus up to 4 photos from this device. */
export function Composer({ me, onPost }: { me: PostAuthor; onPost: (body: string, images: string[]) => boolean }) {
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const room = MAX_IMAGES - images.length;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (!picked.length) {
      setError(room <= 0 ? `Up to ${MAX_IMAGES} photos per post.` : "Pick an image file (JPG, PNG, WebP).");
      return;
    }
    setBusy(true);
    try {
      const urls = await Promise.all(picked.map((f) => fileToDataUrl(f)));
      setImages((cur) => [...cur, ...urls].slice(0, MAX_IMAGES));
      if (files.length > picked.length) setError(`Up to ${MAX_IMAGES} photos per post.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that photo.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const canPost = !busy && (body.trim().length > 0 || images.length > 0) && body.length <= MAX_CHARS;
  const submit = () => {
    if (!canPost) return;
    if (!onPost(body.trim(), images)) {
      setError("Could not save this post on your device. Remove a photo and try again.");
      return;
    }
    setBody("");
    setImages([]);
    setError(null);
    if (textRef.current) textRef.current.style.height = "";
  };

  return (
    <section aria-label="New post" className="px-1 pb-3.5 pt-3">
      <Link href={profileHref(me.name)} className="flex w-fit max-w-full items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-ink">
        <Avatar name={me.name || "Shop"} src={me.photoUrl} preset={me.avatar} size={40} className="flex-none" />
        <b className="min-w-0 truncate text-[15px] font-extrabold leading-tight tracking-[-0.01em]">{me.name || "Your shop"}</b>
      </Link>
      <div className="mt-2.5">
        <label htmlFor="community-composer" className="sr-only">Write a post</label>
        <textarea
          id="community-composer"
          ref={textRef}
          rows={1}
          value={body}
          maxLength={MAX_CHARS + 200}
          onChange={(e) => {
            setBody(e.target.value);
            const t = e.target;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 320)}px`;
          }}
          onPaste={(e) => {
            const files = e.clipboardData?.files;
            if (files?.length) {
              e.preventDefault();
              void addFiles(files);
            }
          }}
          placeholder="What’s new at your shop?"
          className="block w-full resize-none bg-transparent text-[15px] font-medium leading-[1.45] text-ink outline-none placeholder:text-muted"
        />
        {images.length ? (
          <ul className="mt-2.5 flex gap-2 overflow-x-auto pb-1" aria-label="Attached photos">
            {images.map((src, i) => (
              <li key={`${i}-${src.slice(-24)}`} className="relative flex-none">
                <img src={src} alt={`Attached photo ${i + 1}`} className="h-36 w-28 rounded-[14px] object-cover ring-1 ring-inset ring-black/5" />
                <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/65 text-white">
                  <X size={15} strokeWidth={2.4} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p role="alert" className="mt-2 text-[13px] font-semibold text-[#E5484D]">{error}</p> : null}
        <div className="-ml-2 mt-2 flex items-center gap-1">
          <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void addFiles(e.target.files)} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || room <= 0} aria-label="Add photos" className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-grey-100 disabled:opacity-40">
            <ImagePlus size={20} strokeWidth={1.9} />
          </button>
          {busy ? <span className="ml-1 text-[12.5px] font-semibold text-muted">Adding photo…</span> : null}
          <span className="ml-auto flex items-center gap-3">
            {body.length > MAX_CHARS - 150 ? (
              <span className={cn("text-[12.5px] font-bold tabular-nums", body.length > MAX_CHARS ? "text-[#E5484D]" : "text-muted")}>{MAX_CHARS - body.length}</span>
            ) : null}
            <Button size="sm" pill data-auth="action" onClick={submit} disabled={!canPost}>Post</Button>
          </span>
        </div>
      </div>
    </section>
  );
}
