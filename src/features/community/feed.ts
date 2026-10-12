"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { shop } from "@/data";
import { useShopProfile } from "@/lib/shop-profile";
import {
  SEED_POSTS, updateCommunityStore, useCommunityStore, useNow,
  type CommunityPost, type CommunityStore, type PostAuthor, type PostReply,
} from "./posts";

/** Feed with this device's likes, replies, photos and reposts. */
export function useCommunityFeed() {
  const { profile } = useShopProfile();
  const me: PostAuthor = useMemo(
    () => ({ name: profile.name, meta: shop.city, avatar: "sky" }),
    [profile.name],
  );
  const store = useCommunityStore();
  const now = useNow();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const update = useCallback((fn: (s: CommunityStore) => CommunityStore, done?: string) => {
    const ok = updateCommunityStore(fn);
    if (!ok) flash("Storage is full on this device. Try fewer or smaller photos.");
    else if (done) flash(done);
    return ok;
  }, [flash]);

  const posts = useMemo(() => {
    const hidden = new Set(store.hidden);
    const liked = new Set(store.liked);
    const reposted = new Set(store.reposted);
    return [...store.mine, ...SEED_POSTS]
      .filter((p) => !hidden.has(p.id))
      .map((p) => {
        const isLiked = liked.has(p.id);
        const isReposted = reposted.has(p.id);
        return {
          ...p,
          liked: isLiked,
          reposted: isReposted,
          likes: p.likes + (isLiked ? 1 : 0),
          reposts: p.reposts + (isReposted ? 1 : 0),
          replies: [...p.replies, ...(store.replies[p.id] ?? [])],
        };
      });
  }, [store]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const share = async (p: CommunityPost) => {
    const url = `${window.location.origin}/community#${p.id}`;
    const text = p.body ? `${p.author.name}: ${p.body.slice(0, 140)}` : `Post by ${p.author.name}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Barbers.ph Community", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("Link copied");
    } catch {
      /* share sheet dismissed */
    }
  };

  return {
    me,
    now,
    posts,
    toast,
    following: store.following,
    post(body: string, images: string[]) {
      const post: CommunityPost = {
        id: `mine-${Date.now().toString(36)}`,
        author: me,
        body,
        images,
        createdAt: Date.now(),
        likes: 0,
        reposts: 0,
        replies: [],
        mine: true,
      };
      return update((st) => ({ ...st, mine: [post, ...st.mine] }), "Posted");
    },
    like(id: string) {
      update((st) => ({ ...st, liked: toggle(st.liked, id) }));
    },
    repost(p: CommunityPost) {
      update((st) => ({ ...st, reposted: toggle(st.reposted, p.id) }), p.reposted ? undefined : "Reposted");
    },
    share,
    reply(p: CommunityPost, body: string) {
      const r: PostReply = { id: `r-${Date.now().toString(36)}`, author: me, body, createdAt: Date.now() };
      update((st) => ({ ...st, replies: { ...st.replies, [p.id]: [...(st.replies[p.id] ?? []), r] } }));
    },
    remove(p: CommunityPost) {
      update((st) => ({ ...st, mine: st.mine.filter((x) => x.id !== p.id) }), "Post deleted");
    },
    hide(id: string) {
      update((st) => ({ ...st, hidden: [...st.hidden, id] }), "Post hidden");
    },
    copy(p: CommunityPost) {
      void navigator.clipboard?.writeText(p.body).then(() => flash("Copied"), () => undefined);
    },
    toggleFollow(handle: string) {
      const on = store.following.includes(handle);
      update((st) => ({ ...st, following: toggle(st.following, handle) }), on ? undefined : "Following");
    },
  };
}
