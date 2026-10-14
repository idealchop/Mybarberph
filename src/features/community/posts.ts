"use client";

import { useSyncExternalStore } from "react";
import { cloudStorage } from "@/lib/cloud";
import type { AvatarPreset } from "@river-apps/icons";

/** Community feed shared by every shop on Barbers.ph (served by /api/community). */
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
  hidden: string[];
  following: string[];
};

const EMPTY: CommunityStore = { hidden: [], following: [] };

export function authorHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "shop";
}

export function profileHref(name: string): string {
  return `/community/profile?u=${encodeURIComponent(authorHandle(name))}`;
}

export type CommunityProfile = PostAuthor & { handle: string; bio: string };

/** A shop's community profile, built from what it has posted. */
export function resolveProfile(handle: string, me: PostAuthor, posts: CommunityPost[]): CommunityProfile | null {
  const key = handle.toLowerCase();
  if (!key) return null;
  if (me.name && authorHandle(me.name) === key) return { ...me, handle: key, bio: me.meta ? `Barbershop in ${me.meta}.` : "Barbershop on Barbers.ph." };
  const author = posts.flatMap((p) => [p.author, ...p.replies.map((r) => r.author)]).find((a) => authorHandle(a.name) === key);
  if (!author) return null;
  return { ...author, handle: key, bio: author.meta ? `Barbershop in ${author.meta}.` : "Barbershop on Barbers.ph." };
}

let current: CommunityStore | null = null;
const listeners = new Set<() => void>();

function read(): CommunityStore {
  try {
    const raw = cloudStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CommunityStore> | null;
    return { hidden: parsed?.hidden ?? [], following: parsed?.following ?? [] };
  } catch {
    return EMPTY;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("barbers-profile", () => {
    current = null;
    listeners.forEach((l) => l());
  });
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
    cloudStorage.setItem(KEY, JSON.stringify(next));
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
