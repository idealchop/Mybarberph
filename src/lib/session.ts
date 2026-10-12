"use client";

import { useSyncExternalStore } from "react";

/** Who is signed in on this device. Demo only: no server account. */
export interface SessionUser {
  name: string;
  phone?: string;
}

const KEY = "barbers.session";

let hydrated = false;
let snap: { ready: boolean; user: SessionUser | null } = { ready: false, user: null };
const SERVER = { ready: false, user: null };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function read(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    return parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

/** Load the saved session once. Safe to call more than once. */
export function hydrateSession() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  snap = { ready: true, user: read() };
  emit();
}

export function signIn(next: SessionUser) {
  hydrated = true;
  snap = { ready: true, user: next };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  emit();
}

export function signOut() {
  hydrated = true;
  snap = { ready: true, user: null };
  window.localStorage.removeItem(KEY);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** `ready` is false until this device's saved session has been read. */
export function useSession() {
  return useSyncExternalStore(subscribe, () => snap, () => SERVER);
}
