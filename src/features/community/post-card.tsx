"use client";

import { BadgeCheck, Copy, Ellipsis, EyeOff, Heart, MessageCircle, Repeat2, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Avatar, cn } from "@river-apps/ui";
import { PostMedia } from "./post-media";
import { compact, profileHref, shortAge, type CommunityPost, type PostAuthor, type PostReply } from "./posts";

export function PostCard({
  post, now, me, onLike, onRepost, onShare, onReply, onDelete, onHide, onCopy,
}: {
  post: CommunityPost;
  now: number | null;
  me: PostAuthor;
  onLike: () => void;
  onRepost: () => void;
  onShare: () => void;
  onReply: (body: string) => void;
  onDelete?: () => void;
  onHide: () => void;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const replyCount = post.replies.length + (post.moreReplies ?? 0);
  const long = post.body.length > 280 || post.body.split("\n").length > 6;
  const repliers = uniqueAuthors(post.replies).slice(0, 3);
  const hasFooter = replyCount > 0 || post.likes > 0;

  return (
    <article className="px-1 pb-3 pt-4" aria-label={`Post by ${post.author.name}`}>
      <header className="flex items-start gap-2.5">
        <AuthorLink author={post.author} className="flex min-w-0 flex-1 items-start gap-2.5">
          <Avatar name={post.author.name} src={post.author.photoUrl} preset={post.author.avatar} size={40} className="flex-none" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="flex min-w-0 items-center gap-1.5">
              <b className="truncate text-[15px] font-extrabold tracking-[-0.01em]">{post.author.name}</b>
              {post.author.verified ? <BadgeCheck size={16} strokeWidth={2.2} className="flex-none fill-[#0095F6] text-white" aria-label="Verified" /> : null}
              <span className="flex-none text-[14px] font-medium text-muted">{shortAge(post.createdAt, post.ageMin, now)}</span>
            </span>
            {post.author.meta ? <span className="mt-0.5 block truncate text-[12.5px] font-semibold text-muted">{post.author.meta}</span> : null}
          </span>
        </AuthorLink>
        <PostMenu mine={!!post.mine} onDelete={onDelete} onHide={onHide} onCopy={onCopy} />
      </header>
      {post.body ? (
        <div className="mt-2.5">
          <p className={cn("whitespace-pre-line break-words text-[15px] font-medium leading-[1.45]", long && !expanded && "line-clamp-6")}>{post.body}</p>
          {long && !expanded ? (
            <button type="button" onClick={() => setExpanded(true)} className="mt-0.5 text-[14px] font-bold text-muted">See more</button>
          ) : null}
        </div>
      ) : null}
      <PostMedia images={post.images} alt={post.body ? post.body.slice(0, 120) : `Photo by ${post.author.name}`} className="mt-3" />
      <div className="-ml-2 mt-2 flex items-center gap-0.5 text-ink-2">
        <Action label={post.liked ? "Unlike" : "Like"} pressed={!!post.liked} onClick={onLike} count={post.likes}>
          <Heart size={20} strokeWidth={1.9} className={cn("transition-transform", post.liked && "scale-110 fill-[#FF3040] text-[#FF3040]")} />
        </Action>
        <Action label="Reply" onClick={() => { setShowReplies(true); requestAnimationFrame(() => replyRef.current?.focus()); }} count={replyCount}>
          <MessageCircle size={20} strokeWidth={1.9} className="-scale-x-100" />
        </Action>
        <Action label={post.reposted ? "Undo repost" : "Repost"} pressed={!!post.reposted} onClick={onRepost} count={post.reposts}>
          <Repeat2 size={21} strokeWidth={1.9} className={cn(post.reposted && "text-ink")} />
        </Action>
        <Action label="Share" onClick={onShare}><Send size={19} strokeWidth={1.9} /></Action>
      </div>
      {hasFooter ? (
        <div className="mt-1 flex items-center gap-2.5">
          {repliers.length ? (
            <span className="flex -space-x-1.5">
              {repliers.map((a) => (
                <AuthorLink key={a.name} author={a} className="rounded-full">
                  <Avatar name={a.name} preset={a.avatar} size={18} className="ring-2 ring-canvas" />
                </AuthorLink>
              ))}
            </span>
          ) : null}
          <p className="text-[14px] font-medium text-muted">
            {replyCount > 0 ? (
              <button type="button" onClick={() => setShowReplies((v) => !v)} className="hover:text-ink hover:underline" aria-expanded={showReplies}>
                {compact(replyCount)} {replyCount === 1 ? "reply" : "replies"}
              </button>
            ) : null}
            {replyCount > 0 && post.likes > 0 ? <span aria-hidden> · </span> : null}
            {post.likes > 0 ? <span>{compact(post.likes)} {post.likes === 1 ? "like" : "likes"}</span> : null}
          </p>
        </div>
      ) : null}
      {showReplies ? <Replies post={post} now={now} me={me} replyRef={replyRef} onReply={onReply} /> : null}
    </article>
  );
}

function Action({ label, onClick, count, pressed, children }: { label: string; onClick: () => void; count?: number; pressed?: boolean; children: ReactNode }) {
  return (
    <button type="button" data-auth={label === "Share" || label === "Reply" ? undefined : "action"} onClick={onClick} aria-label={count ? `${label} (${count})` : label} aria-pressed={pressed} className="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-pill px-2 text-[13.5px] font-semibold text-ink-2 hover:bg-grey-100">
      {children}
      {count ? <span className="tabular-nums">{compact(count)}</span> : null}
    </button>
  );
}

function Replies({ post, now, me, replyRef, onReply }: { post: CommunityPost; now: number | null; me: PostAuthor; replyRef: React.RefObject<HTMLTextAreaElement | null>; onReply: (body: string) => void }) {
  const [text, setText] = useState("");
  const id = useId();
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onReply(t);
    setText("");
  };
  return (
    <div className="mt-3 border-t border-line pt-3">
      <ul className="flex flex-col gap-3.5" aria-label="Replies">
        {post.replies.map((r) => (
          <li key={r.id}>
            <AuthorLink author={r.author} className="flex items-center gap-2.5">
              <Avatar name={r.author.name} src={r.author.photoUrl} preset={r.author.avatar} size={32} className="flex-none" />
              <span className="flex min-w-0 items-center gap-1.5 leading-tight">
                <b className="truncate text-[14px] font-extrabold">{r.author.name}</b>
                <span className="flex-none text-[13px] font-medium text-muted">{shortAge(r.createdAt, r.ageMin, now)}</span>
              </span>
            </AuthorLink>
            <p className="mt-1.5 whitespace-pre-line text-[14.5px] font-medium leading-snug">{r.body}</p>
          </li>
        ))}
      </ul>
      {post.moreReplies ? <p className="mt-2 text-[13px] font-semibold text-muted">+ {post.moreReplies} more {post.moreReplies === 1 ? "reply" : "replies"}</p> : null}
      <form data-auth="action" className="mt-3 flex items-end gap-2.5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Avatar name={me.name || "Shop"} src={me.photoUrl} preset={me.avatar} size={32} />
        <label htmlFor={id} className="sr-only">Reply to {post.author.name}</label>
        <textarea id={id} ref={replyRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Reply to ${post.author.name}…`} className="max-h-32 min-h-10 flex-1 resize-none rounded-[20px] bg-grey-100 px-4 py-2.5 text-[14.5px] font-medium outline-none placeholder:text-muted" />
        <button type="submit" disabled={!text.trim()} className="h-10 rounded-pill px-3 text-[14px] font-extrabold disabled:text-subtle">Post</button>
      </form>
    </div>
  );
}

function AuthorLink({ author, className, children }: { author: PostAuthor; className?: string; children: ReactNode }) {
  return <Link href={profileHref(author.name)} className={cn("rounded-full focus-visible:outline-2 focus-visible:outline-ink", className)}>{children}</Link>;
}

function PostMenu({ mine, onDelete, onHide, onCopy }: { mine: boolean; onDelete?: () => void; onHide: () => void; onCopy: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const item = "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] font-semibold hover:bg-grey-50";
  return (
    <div ref={ref} className="relative -mr-2 -mt-1.5 flex-none">
      <button type="button" aria-label="More" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-grey-100">
        <Ellipsis size={20} strokeWidth={2} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-[14px] bg-surface py-1 shadow-card ring-1 ring-black/5">
          <button type="button" className={item} onClick={() => { setOpen(false); onCopy(); }}><Copy size={17} /> Copy text</button>
          {mine && onDelete ? (
            <button type="button" className={cn(item, "text-[#E5484D]")} onClick={() => { setOpen(false); onDelete(); }}><Trash2 size={17} /> Delete post</button>
          ) : (
            <button type="button" className={item} onClick={() => { setOpen(false); onHide(); }}><EyeOff size={17} /> Hide post</button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function uniqueAuthors(replies: PostReply[]): PostAuthor[] {
  const seen = new Set<string>();
  const out: PostAuthor[] = [];
  for (const r of replies) {
    if (seen.has(r.author.name)) continue;
    seen.add(r.author.name);
    out.push(r.author);
  }
  return out;
}
