"use client";

import { useSyncExternalStore } from "react";
import type { AvatarPreset } from "@river-apps/icons";

/** Community feed. Posts, likes and photos stay on this device. */
export type PostAuthor = {
  name: string;
  meta?: string;
  avatar?: AvatarPreset;
  photoUrl?: string;
  verified?: boolean;
};

export type PostReply = {
  id: string;
  author: PostAuthor;
  body: string;
  createdAt?: number;
  ageMin?: number;
};

export type CommunityPost = {
  id: string;
  author: PostAuthor;
  body: string;
  images: string[];
  createdAt?: number;
  ageMin?: number;
  likes: number;
  reposts: number;
  replies: PostReply[];
  moreReplies?: number;
  liked?: boolean;
  reposted?: boolean;
  mine?: boolean;
};

const IMG = "/community";

export const RIVER_TEAM: PostAuthor = { name: "River Apps", meta: "Barbers.ph team", avatar: "indigo", verified: true };

export const SEED_POSTS: CommunityPost[] = [
  {
    id: "seed-1",
    author: { name: "Kanto Kings Barbershop", meta: "Marikina", avatar: "sky" },
    body: "Sunday queue is steady. Skin fades are the ones people book from the QR.\n\nTip: put the shop code on the mirror. Customers scan it while they wait, and the status page stops the “is it my turn?” texts.",
    images: [`${IMG}/chairs.svg`],
    ageMin: 95,
    likes: 48,
    reposts: 6,
    replies: [
      { id: "r1", author: { name: "Fade Room QC", avatar: "mint" }, body: "We did the mirror sticker last week. It actually gets used.", ageMin: 70 },
    ],
    moreReplies: 4,
  },
  {
    id: "seed-2",
    author: { name: "Fade Room QC", meta: "Quezon City", avatar: "mint" },
    body: "If you only keep one code at the door, customers actually use it. Separate links for each barber just confused people.",
    images: [`${IMG}/shopfront.svg`],
    ageMin: 260,
    likes: 23,
    reposts: 3,
    replies: [],
    moreReplies: 2,
  },
  {
    id: "seed-3",
    author: { name: "Barrio Cut Club", meta: "Pasig", avatar: "peach" },
    body: "We stopped a separate sales screen. Today’s number sits on the queue, and that’s enough for the chair.",
    images: [],
    ageMin: 60 * 8,
    likes: 19,
    reposts: 2,
    replies: [{ id: "r2", author: { name: "Kanto Kings Barbershop", avatar: "sky" }, body: "Same here. Done on the ticket is the sale.", ageMin: 60 * 7 }],
  },
  {
    id: "seed-4",
    author: RIVER_TEAM,
    body: "Shop photos now show on your community profile. Add a clear shot of the chairs and the storefront. Shops with photos get more follows.",
    images: [`${IMG}/chairs.svg`, `${IMG}/clippers.svg`, `${IMG}/shopfront.svg`],
    ageMin: 60 * 26,
    likes: 120,
    reposts: 18,
    replies: [{ id: "r3", author: { name: "Lineup Barbers", avatar: "butter" }, body: "Uploaded ours today. Thanks team.", ageMin: 60 * 20 }],
    moreReplies: 9,
  },
  {
    id: "seed-5",
    author: { name: "Lineup Barbers", meta: "Makati", avatar: "butter" },
    body: "How do you price a beard add-on when the fade already includes a lineup? We charge ₱150 on top. Curious what other shops do.",
    images: [`${IMG}/clippers.svg`],
    ageMin: 60 * 50,
    likes: 31,
    reposts: 1,
    replies: [],
    moreReplies: 6,
  },
];

export function shortAge(createdAt: number | undefined, ageMin: number | undefined, now: number | null): string {
  const mins = ageMin ?? (createdAt != null && now != null ? Math.max(0, Math.floor((now - createdAt) / 60000)) : 0);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const at = createdAt ?? (now ?? 0) - mins * 60000;
  return new Date(at).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(n / 1000)}K`;
}

const KEY = "barbers.community.v1";

export type CommunityStore = {
  mine: CommunityPost[];
  liked: string[];
  reposted: string[];
  replies: Record<string, PostReply[]>;
  hidden: string[];
  following: string[];
};

const EMPTY: CommunityStore = { mine: [], liked: [], reposted: [], replies: {}, hidden: [], following: [] };

export function authorHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "shop";
}

export function profileHref(name: string): string {
  return `/community/profile?u=${encodeURIComponent(authorHandle(name))}`;
}

const PROFILE_COPY: Record<string, { bio: string; followers: number; rating: number; locations: number }> = {
  kantokingsbarbershop: { bio: "Marikina barbershop. Walk-ins, the queue, and one shop QR.", followers: 860, rating: 4.8, locations: 1 },
  faderoomqc: { bio: "Quezon City. Fades, the door code, and a short queue.", followers: 640, rating: 4.7, locations: 1 },
  barriocutclub: { bio: "Pasig. Today’s number lives on the queue.", followers: 410, rating: 4.9, locations: 2 },
  riverapps: { bio: "The Barbers.ph team. Updates for shop owners.", followers: 2100, rating: 5, locations: 1 },
  lineupbarbers: { bio: "Makati. Fades, lineups, and beard add-ons.", followers: 530, rating: 4.6, locations: 3 },
};

export type CommunityProfile = PostAuthor & { handle: string; bio: string; followers: number; rating: number; locations: number };

export function resolveProfile(handle: string, me: PostAuthor): CommunityProfile | null {
  const key = handle.toLowerCase();
  if (!key) return null;
  if (authorHandle(me.name) === key) {
    return { ...me, handle: key, bio: me.meta ? `Barbershop in ${me.meta}.` : "Barbershop on Barbers.ph.", followers: 86, rating: 4.8, locations: 1 };
  }
  const author = knownAuthors().find((a) => authorHandle(a.name) === key);
  if (!author) return null;
  const copy = PROFILE_COPY[key];
  return {
    ...author,
    handle: key,
    bio: copy?.bio ?? (author.meta ? `${author.meta}. On Barbers.ph Community.` : "On Barbers.ph Community."),
    followers: copy?.followers ?? 120,
    rating: copy?.rating ?? 4.8,
    locations: copy?.locations ?? 1,
  };
}

function knownAuthors(): PostAuthor[] {
  const out: PostAuthor[] = [];
  const seen = new Set<string>();
  const add = (a: PostAuthor) => {
    const k = authorHandle(a.name);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(a);
  };
  for (const p of SEED_POSTS) {
    add(p.author);
    for (const r of p.replies) add(r.author);
  }
  return out;
}

let current: CommunityStore | null = null;
const listeners = new Set<() => void>();

function read(): CommunityStore {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CommunityStore>;
    return { ...EMPTY, ...parsed, following: parsed.following ?? [], replies: parsed.replies ?? {}, mine: parsed.mine ?? [] };
  } catch {
    return EMPTY;
  }
}

function subscribeStore(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getStore = () => (current ??= read());
const getServerStore = () => EMPTY;

export function useCommunityStore(): CommunityStore {
  return useSyncExternalStore(subscribeStore, getStore, getServerStore);
}

export function updateCommunityStore(fn: (s: CommunityStore) => CommunityStore): boolean {
  const next = fn(getStore());
  let ok = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    ok = false;
  }
  if (ok) {
    current = next;
    listeners.forEach((l) => l());
  }
  return ok;
}

let clockNow = 0;
function subscribeClock(cb: () => void) {
  clockNow = Date.now();
  const t = setInterval(() => {
    clockNow = Date.now();
    cb();
  }, 60_000);
  queueMicrotask(cb);
  return () => clearInterval(t);
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribeClock, () => clockNow || null, () => null);
}

export async function fileToDataUrl(file: File, maxSide = 1280, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read that image."));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read that image.");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
