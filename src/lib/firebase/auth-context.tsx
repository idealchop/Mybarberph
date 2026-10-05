"use client";

import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { firebaseAuth, isFirebaseConfigured } from "./client";

interface AuthState {
  user: User | null;
  loading: boolean;
  configured: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, configured: false });

async function mintSession(user: User) {
  const idToken = await user.getIdToken();
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [state, setState] = useState<AuthState>({ user: null, loading: configured ? true : false, configured });

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(firebaseAuth(), async (user) => {
      if (user) {
        try {
          await mintSession(user);
        } catch (err) {
          console.error("session mint failed", err);
        }
      }
      setState({ user, loading: false, configured: true });
    });
  }, [configured]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/* ---------- Phone (SMS code) — MyCarwash pattern ---------- */

let pending: { phoneE164: string; confirmation: ConfirmationResult; sentAt: number } | null = null;
let verifier: RecaptchaVerifier | null = null;

/** Sends the SMS code using an invisible reCAPTCHA attached to the Send button. */
export async function sendPhoneCode(phoneE164: string, buttonId: string) {
  const auth = firebaseAuth();
  verifier?.clear();
  verifier = new RecaptchaVerifier(auth, buttonId, { size: "invisible" });
  const confirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
  pending = { phoneE164, confirmation, sentAt: Date.now() };
}

export const pendingPhone = () => pending;

export async function confirmPhoneCode(code: string) {
  if (!pending) throw new Error("Your code expired. Please request a new one.");
  const cred = await pending.confirmation.confirm(code);
  pending = null;
  await mintSession(cred.user);
  return cred.user;
}

/* ---------- Google ---------- */

export async function signInWithGoogle() {
  const auth = firebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const cred = await signInWithPopup(auth, provider);
    await mintSession(cred.user);
    return cred.user;
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

/* ---------- Email (optional /dev) ---------- */

export async function signInEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(firebaseAuth(), email, password);
  await mintSession(cred.user);
  return cred.user;
}

export async function signUpEmail(email: string, password: string, shopName: string) {
  const cred = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
  await mintSession(cred.user);
  const res = await fetch("/api/auth/ensure-shop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopName, email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not create your shop.");
  }
  return cred.user;
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  await fbSignOut(firebaseAuth());
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("invalid-verification-code")) return "That code is not right. Please check and try again.";
  if (code.includes("code-expired")) return "That code expired. Please request a new one.";
  if (code.includes("invalid-phone-number")) return "Please enter a valid PH mobile number.";
  if (code.includes("too-many-requests")) return "Too many tries. Please wait a few minutes.";
  if (code.includes("email-already-in-use")) return "That email already has an account. Try signing in.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Email or password is not right.";
  if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (code.includes("invalid-email")) return "Please enter a valid email.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup-request")) return "Google sign-in was closed before finishing.";
  if (code.includes("unauthorized-domain")) return "This site is not allowed to sign in yet.";
  if (code.includes("operation-not-allowed")) return "That sign-in method is not enabled yet.";
  if (code.includes("captcha")) return "We couldn’t verify you’re not a robot. Please try again.";
  if (code.includes("network-request-failed")) return "No connection. Check your internet and try again.";
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}
