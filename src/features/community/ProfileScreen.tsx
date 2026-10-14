"use client";

import { BadgeCheck } from "lucide-react";
import { PageBack } from "@/components/shell/PageBack";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar, cn } from "@river-apps/ui";
import { useShopLocations } from "@/lib/shop-locations";
import { locationCountLabel, useShopProfile } from "@/lib/shop-profile";
import { useCommunityFeed } from "./feed";
import { PostCard } from "./PostCard";
import { authorHandle, resolveProfile, type CommunityPost } from "./posts";

type Tab = "threads" | "replies" | "media" | "reposts";
const TABS: { id: Tab; label: string }[] = [
  { id: "threads", label: "Threads" },
  { id: "replies", label: "Replies" },
  { id: "media", label: "Media" },
  { id: "reposts", label: "Reposts" },
];

/** Profile for one shop in the community. */
export function ProfileScreen() {
  const handle = (useSearchParams().get("u") ?? "").toLowerCase();
  const feed = useCommunityFeed();
  const { profile: shop } = useShopProfile();
  const shops = useShopLocations();
  const profile = resolveProfile(handle, feed.me, feed.posts);
  const [tab, setTab] = useState<Tab>("threads");
  const isMe = !!profile && authorHandle(feed.me.name) === profile.handle;
  const locations = isMe ? (shops.enabled ? Math.max(1, shops.branches.length) : shop.locations) : null;
  const following = !!profile && feed.following.includes(profile.handle);
  const byAuthor = (p: CommunityPost) => !!profile && authorHandle(p.author.name) === profile.handle;
  const threads = feed.posts.filter(byAuthor);
  const replies = feed.posts.flatMap((p) => p.replies.filter((r) => profile && authorHandle(r.author.name) === profile.handle).map((reply) => ({ reply, parent: p })));
  const media = threads.flatMap((p) => p.images.map((src) => ({ src, postId: p.id })));
  const reposts = isMe ? feed.posts.filter((p) => p.reposted) : [];

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-[max(0.5rem,env(safe-area-inset-top))] lg:max-w-[640px] lg:px-[30px] lg:pt-6">
      <PageBack fallback="/moments" />
      {!profile ? <p className="px-1 py-16 text-center text-[15px] font-semibold text-muted">That profile isn’t in the community.</p> : (
        <>
          <header className="mt-2 px-1">
            <Avatar name={profile.name} src={profile.photoUrl} preset={profile.avatar} size={86} decorative={false} />
            <h1 className="mt-3 flex items-center gap-1.5 text-[24px] font-extrabold leading-tight tracking-[-0.03em]">
              <span className="min-w-0 truncate">{profile.name}</span>
              {profile.verified ? <BadgeCheck size={20} strokeWidth={2.2} className="flex-none fill-[#0095F6] text-white" aria-label="Verified" /> : null}
            </h1>
            <p className="mt-0.5 text-[15px] font-medium text-muted">@{profile.handle}</p>
            <p className="mt-3 max-w-[440px] text-[15px] font-medium leading-snug">{profile.bio}</p>
            {locations ? <p className="mt-3 text-[15px] font-semibold text-muted">{locationCountLabel(locations)}</p> : null}
            {isMe ? null : (
              <button type="button" aria-pressed={following} data-auth="action" onClick={() => feed.toggleFollow(profile.handle)} className={cn("mt-4 h-11 w-full rounded-pill text-[15px] font-bold sm:w-auto sm:min-w-[140px] sm:px-8", following ? "bg-grey-100" : "bg-ink text-on-ink")}>
                {following ? "Following" : "Follow"}
              </button>
            )}
          </header>
          <div role="tablist" aria-label="Profile" className="-mx-4 mt-5 flex border-b border-line lg:-mx-[30px]">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("-mb-px flex-1 border-b-2 py-3 text-[15px] font-bold", tab === t.id ? "border-ink" : "border-transparent text-muted")}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === "threads" ? <PostList posts={threads} empty="No threads yet" feed={feed} /> : null}
          {tab === "replies" ? (
            replies.length ? (
              <ul className="divide-y divide-line">
                {replies.map(({ reply, parent }) => (
                  <li key={reply.id} className="px-1 py-4">
                    <p className="text-[13px] font-semibold text-muted">Replying to {parent.author.name}</p>
                    <p className="mt-1.5 text-[15px] font-medium leading-snug">{reply.body}</p>
                  </li>
                ))}
              </ul>
            ) : <Empty label="No replies yet" />
          ) : null}
          {tab === "media" ? (
            media.length ? (
              <ul className="-mx-4 grid grid-cols-3 gap-0.5 lg:-mx-[30px]">
                {media.map((m) => (
                  <li key={`${m.postId}-${m.src}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.src} alt="" className="aspect-square w-full object-cover" />
                  </li>
                ))}
              </ul>
            ) : <Empty label="No media yet" />
          ) : null}
          {tab === "reposts" ? <PostList posts={reposts} empty="No reposts yet" feed={feed} /> : null}
        </>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="px-1 py-14 text-center text-[15px] font-semibold text-muted">{label}</p>;
}

function PostList({ posts, empty, feed }: { posts: CommunityPost[]; empty: string; feed: ReturnType<typeof useCommunityFeed> }) {
  if (!posts.length) return <Empty label={empty} />;
  return (
    <ul className="divide-y divide-line">
      {posts.map((p) => (
        <li key={p.id} id={p.id}>
          <PostCard post={p} now={feed.now} me={feed.me} onLike={() => feed.like(p.id)} onRepost={() => feed.repost(p)} onShare={() => void feed.share(p)} onReply={(body) => feed.reply(p, body)} onDelete={p.mine ? () => feed.remove(p) : undefined} onHide={() => feed.hide(p.id)} onCopy={() => feed.copy(p)} />
        </li>
      ))}
    </ul>
  );
}
