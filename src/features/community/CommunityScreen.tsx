"use client";

import { PageBack } from "@/components/shell/PageBack";
import { Composer } from "./Composer";
import { useCommunityFeed } from "./feed";
import { PostCard } from "./PostCard";

/** Feed shared by every shop on Barbers.ph. */
export function CommunityScreen() {
  const feed = useCommunityFeed();
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))] lg:max-w-[640px] lg:px-[30px] lg:pt-6">
      <div className="flex items-center">
        <PageBack fallback="/home" />
        <h1 className="sr-only">Moments</h1>
      </div>
      <div className="border-b border-line">
        <Composer me={feed.me} onPost={feed.post} />
      </div>
      <ul className="divide-y divide-line" aria-label="Moments">
        {feed.posts.map((p) => (
          <li key={p.id} id={p.id} className="scroll-mt-20">
            <PostCard
              post={p}
              now={feed.now}
              me={feed.me}
              onLike={() => feed.like(p.id)}
              onRepost={() => feed.repost(p)}
              onShare={() => void feed.share(p)}
              onReply={(body) => feed.reply(p, body)}
              onDelete={p.mine ? () => feed.remove(p) : undefined}
              onHide={() => feed.hide(p.id)}
              onCopy={() => feed.copy(p)}
            />
          </li>
        ))}
      </ul>
      {feed.loading ? <p className="px-1 py-10 text-center text-[14px] font-semibold text-muted">Loading posts…</p> : feed.posts.length === 0 ? (
        <div className="px-1 py-12 text-center">
          <b className="block text-[16px]">No posts yet</b>
          <p className="mt-1 text-[14px] font-medium text-muted">Be the first shop to share a tip, a cut, or a question.</p>
        </div>
      ) : <p className="border-t border-line px-1 py-4 text-center text-[13px] font-semibold text-muted">You’re all caught up</p>}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-[70] flex justify-center lg:bottom-8">
        {feed.toast ? <span className="rounded-pill bg-ink px-4 py-2.5 text-[14px] font-bold text-on-ink shadow-raised">{feed.toast}</span> : null}
      </div>
    </div>
  );
}
