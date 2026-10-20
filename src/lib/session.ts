"use client";
/**
 * Who is signed in (Firebase Auth). Guests browse freely; actions ask them to sign in.
 */
import {
  EmailAuthProvider, GoogleAuthProvider, RecaptchaVerifier, reauthenticateWithCredential, updatePassword, getRedirectResult, onAuthStateChanged,
  signInWithPhoneNumber, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type ConfirmationResult, type User,
} from "firebase/auth";
import { useSyncExternalStore } from "react";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

export interface SessionUser {
  uid: string;
  name: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  /** Firebase sign-in providers on the account: "google.com", "phone", "password". */
  providers: string[];
}

/** `signingIn`: a Google redirect sign-in is being finished (page just came back from Google). */
let snap: { ready: boolean; user: SessionUser | null; signingIn: boolean } = { ready: false, user: null, signingIn: false };
const SERVER = { ready: false, user: null, signingIn: false };
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
    providers: u.providerData.map((p) => p.providerId),
  };
}

/** Starts listening to Firebase Auth once. Safe to call more than once. */
export function hydrateSession() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!isFirebaseConfigured()) { snap = { ready: true, user: null, signingIn: false }; emit(); return; }
  try { if (sessionStorage.getItem("bp.authRedirect")) snap = { ...snap, signingIn: true }; } catch { /* storage blocked */ }
  onAuthStateChanged(firebaseAuth(), (u) => {
    current = u;
    snap = { ...snap, ready: true, user: u ? toUser(u) : null };
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
  try {
    await signInWithPopup(firebaseAuth(), provider);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    // Mobile Safari / in-app browsers can block or break the popup: fall back to a full-page redirect.
    if (code.includes("popup-blocked") || code.includes("operation-not-supported") || code.includes("web-storage-unsupported")) {
      sessionStorage.setItem("bp.authRedirect", location.pathname + location.search);
      snap = { ...snap, signingIn: true }; emit();
      await signInWithRedirect(firebaseAuth(), provider);
      return;
    }
    throw err;
  }
}

/** Finishes a Google redirect sign-in (if one is pending) after the page reloads. */
export async function finishRedirectSignIn(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  const back = sessionStorage.getItem("bp.authRedirect");
  if (!back) return null;
  sessionStorage.removeItem("bp.authRedirect");
  try {
    const res = await getRedirectResult(firebaseAuth()).catch(() => null);
    return res ? back : null;
  } finally {
    // Keep the "Signing you in…" state until Firebase reports the user (or the redirect failed).
    const done = () => { snap = { ...snap, signingIn: false }; emit(); };
    if (firebaseAuth().currentUser || !snap.ready) { if (snap.ready) done(); else { const off = subscribe(() => { if (snap.ready) { off(); done(); } }); } } else done();
  }
}


let confirmation: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;

function resetVerifier() {
  try { verifier?.clear(); } catch { /* already gone */ }
  verifier = null;
}

/**
 * Sends a 6-digit code by SMS (Firebase phone auth). reCAPTCHA runs invisibly in the background on a hidden
 * container (`containerId`), so there's no checkbox; Google only shows a picture puzzle for suspicious traffic.
 * The verifier is rebuilt on every attempt and cleared on any error or expiry, so a retry gets a fresh token.
 */
export async function sendPhoneCode(e164: string, containerId: string) {
  resetVerifier();
  // Dev only: Firebase test numbers can skip reCAPTCHA for automated checks (opt-in per browser).
  if (process.env.NEXT_PUBLIC_AUTH_TEST_MODE === "1" && localStorage.getItem("bp.authTest") === "1") {
    firebaseAuth().settings.appVerificationDisabledForTesting = true;
  }
  verifier = new RecaptchaVerifier(firebaseAuth(), containerId, { size: "invisible", "expired-callback": resetVerifier });
  try {
    confirmation = await signInWithPhoneNumber(firebaseAuth(), e164, verifier);
  } catch (err) {
    resetVerifier();
    throw err;
  }
}

export async function confirmPhoneCode(code: string) {
  if (!confirmation) throw new Error("Your code expired. Request a new one.");
  await confirmation.confirm(code);
  confirmation = null;
}

/** How an account signs in, for Settings › Account. A password form is only offered when the account has one. */
export function signInKind(providers: string[]): "password" | "google" | "phone" | "unknown" {
  if (providers.includes("password")) return "password";
  if (providers.includes("google.com")) return "google";
  if (providers.includes("phone")) return "phone";
  return "unknown";
}

export const MIN_PASSWORD = 8;

/** Checks the new password before calling Firebase; returns an error message or null. */
export function newPasswordError(next: string, confirm: string, current: string): string | null {
  if (next.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (next !== confirm) return "The new passwords don’t match.";
  if (next === current) return "Choose a password you haven’t used here.";
  return null;
}

/** Re-authenticates with the current password, then sets the new one (Firebase Auth). */
export async function changePassword(current: string, next: string) {
  const u = firebaseAuth().currentUser;
  if (!u?.email) throw Object.assign(new Error("This account has no email password."), { code: "auth/no-password" });
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
  await updatePassword(u, next);
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
  if (code.includes("billing-not-enabled") || code.includes("quota")) return "Text codes aren’t available right now. Use Google instead.";
  if (code.includes("captcha")) return "Couldn’t confirm you’re not a robot. Reload and try again.";
  if (code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("invalid-login-credentials")) return "That’s not your current password.";
  if (code.includes("weak-password")) return `That password is too weak. Use at least ${MIN_PASSWORD} characters with letters and numbers.`;
  if (code.includes("requires-recent-login")) return "For your security, log out and sign in again, then change your password.";
  if (code.includes("user-mismatch") || code.includes("user-not-found")) return "That password is for a different account.";
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
