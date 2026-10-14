"use client";
/**
 * Who is signed in (Firebase Auth). Guests browse freely; actions ask them to sign in.
 */
import {
  GoogleAuthProvider, RecaptchaVerifier, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,
  signInWithPhoneNumber, signInWithPopup, signOut as fbSignOut, type ConfirmationResult, type User,
} from "firebase/auth";
import { useSyncExternalStore } from "react";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

export interface SessionUser {
  uid: string;
  name: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
}

let snap: { ready: boolean; user: SessionUser | null } = { ready: false, user: null };
const SERVER = { ready: false, user: null };
const listeners = new Set<() => void>();
let started = false;
let current: User | null = null;

function emit() { listeners.forEach((l) => l()); }

function toUser(u: User): SessionUser {
  return {
    uid: u.uid,
    name: u.displayName || u.email?.split("@")[0] || u.phoneNumber || "Shop owner",
    phone: u.phoneNumber ?? undefined,
    email: u.email ?? undefined,
    photoUrl: u.photoURL ?? undefined,
  };
}

/** Starts listening to Firebase Auth once. Safe to call more than once. */
export function hydrateSession() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!isFirebaseConfigured()) { snap = { ready: true, user: null }; emit(); return; }
  onAuthStateChanged(firebaseAuth(), (u) => {
    current = u;
    snap = { ready: true, user: u ? toUser(u) : null };
    emit();
  });
}

export async function idToken(): Promise<string | null> {
  const u = current ?? (isFirebaseConfigured() ? firebaseAuth().currentUser : null);
  return u ? u.getIdToken() : null;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(firebaseAuth(), provider);
}

export async function signInEmail(email: string, password: string, create: boolean) {
  if (create) await createUserWithEmailAndPassword(firebaseAuth(), email, password);
  else await signInWithEmailAndPassword(firebaseAuth(), email, password);
}

let confirmation: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;

/** Sends a 6-digit code by SMS (Firebase phone auth, invisible reCAPTCHA on `buttonId`). */
export async function sendPhoneCode(e164: string, buttonId: string) {
  verifier?.clear();
  verifier = new RecaptchaVerifier(firebaseAuth(), buttonId, { size: "invisible" });
  confirmation = await signInWithPhoneNumber(firebaseAuth(), e164, verifier);
}

export async function confirmPhoneCode(code: string) {
  if (!confirmation) throw new Error("Your code expired. Request a new one.");
  await confirmation.confirm(code);
  confirmation = null;
}

export async function signOut() {
  if (isFirebaseConfigured()) await fbSignOut(firebaseAuth());
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("popup-closed") || code.includes("cancelled-popup")) return "Sign-in was closed before it finished.";
  if (code.includes("popup-blocked")) return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
  if (code.includes("invalid-verification-code")) return "That code is not right. Check it and try again.";
  if (code.includes("code-expired")) return "That code expired. Request a new one.";
  if (code.includes("invalid-phone-number")) return "Enter a valid PH mobile number.";
  if (code.includes("too-many-requests")) return "Too many tries. Wait a few minutes and try again.";
  if (code.includes("operation-not-allowed")) return "This sign-in method isn’t turned on yet. Try another one.";
  if (code.includes("billing-not-enabled") || code.includes("quota")) return "Text codes aren’t available right now. Use Google or email.";
  if (code.includes("email-already-in-use")) return "That email already has an account. Log in instead.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Email or password is not right.";
  if (code.includes("weak-password")) return "Use at least 6 characters for your password.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("unauthorized-domain")) return "Sign-in isn’t allowed on this web address yet.";
  return (err as Error)?.message || "Something went wrong. Try again.";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** `ready` is false until Firebase has told us who is signed in. */
export function useSession() {
  return useSyncExternalStore(subscribe, () => snap, () => SERVER);
}

export function subscribeSession(cb: () => void) { return subscribe(cb); }
export function sessionSnapshot() { return snap; }
