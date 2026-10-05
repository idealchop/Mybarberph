"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [state, setState] = useState<AuthState>({ user: null, loading: configured ? true : false, configured });

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(firebaseAuth(), async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      }
      setState({ user, loading: false, configured: true });
    });
  }, [configured]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export async function signInEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(firebaseAuth(), email, password);
  const idToken = await cred.user.getIdToken();
  await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
  return cred.user;
}

export async function signUpEmail(email: string, password: string, shopName: string) {
  const cred = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
  const idToken = await cred.user.getIdToken();
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, shopName, email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not create your shop.");
  }
  await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
  return cred.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const cred = await signInWithPopup(firebaseAuth(), provider);
    const idToken = await cred.user.getIdToken();
    await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
    // Ensure a shop exists for Google-first users
    await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, shopName: "My Barbershop", email: cred.user.email }),
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/popup-blocked") await signInWithRedirect(firebaseAuth(), provider);
    else throw err;
  }
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  await fbSignOut(firebaseAuth());
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("email-already-in-use")) return "That email already has an account. Try signing in.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Email or password is not right.";
  if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (code.includes("invalid-email")) return "Please enter a valid email.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup-request")) return "Google sign-in was closed before finishing.";
  if (code.includes("unauthorized-domain")) return "This site is not allowed to sign in yet.";
  if (code.includes("operation-not-allowed")) return "That sign-in method is not enabled yet.";
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}
