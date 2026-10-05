"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { registerAuthRetry } from "@/data";
import { useAuth } from "@/lib/firebase/auth-context";
import { AuthGateSheet } from "./AuthGateSheet";

type AuthGateCtx = {
  isAuthenticated: boolean;
  /** Open the River Mobile–style sheet; run `after` once signed in. */
  requireAuth: (after?: () => void, subtitle?: string) => void;
  openAuth: (after?: () => void, subtitle?: string) => void;
};

const Ctx = createContext<AuthGateCtx | null>(null);

export function useAuthGate() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuthGate must be used inside <AuthGateProvider>");
  return v;
}

/** Optional: soft access when provider may be missing in isolated trees. */
export function useAuthGateOptional() {
  return useContext(Ctx);
}

/**
 * Guest browse + login-on-action (River Mobile AuthGate pattern).
 * Also registers a /api/repo 401 retry so Firestore mutations open the sheet.
 */
export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const isAuthenticated = Boolean(user);
  const [open, setOpen] = useState(false);
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const pendingRef = useRef<(() => void) | null>(null);
  const retryResolve = useRef<((v: unknown) => void) | null>(null);
  const retryReject = useRef<((e: unknown) => void) | null>(null);
  const retryFn = useRef<(() => Promise<unknown>) | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    pendingRef.current = null;
    if (retryReject.current) {
      retryReject.current(new Error("Sign-in canceled"));
      retryReject.current = null;
      retryResolve.current = null;
      retryFn.current = null;
    }
  }, []);

  const openAuth = useCallback((after?: () => void, text?: string) => {
    if (isAuthenticated) {
      after?.();
      return;
    }
    pendingRef.current = after ?? null;
    setSubtitle(text);
    setOpen(true);
  }, [isAuthenticated]);

  const onAuthenticated = useCallback(() => {
    setOpen(false);
    const next = pendingRef.current;
    pendingRef.current = null;
    const retry = retryFn.current;
    const resolve = retryResolve.current;
    const reject = retryReject.current;
    retryFn.current = null;
    retryResolve.current = null;
    retryReject.current = null;
    requestAnimationFrame(() => {
      next?.();
      if (retry && resolve && reject) {
        retry().then(resolve).catch(reject);
      }
    });
  }, []);

  useEffect(() => {
    registerAuthRetry((retry) => {
      if (isAuthenticated) return retry();
      return new Promise((resolve, reject) => {
        retryFn.current = retry;
        retryResolve.current = resolve;
        retryReject.current = reject;
        setSubtitle("Sign in to save this change.");
        setOpen(true);
      });
    });
    return () => registerAuthRetry(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && open && !retryFn.current && !pendingRef.current) {
      setOpen(false);
    }
  }, [isAuthenticated, open]);

  const value: AuthGateCtx = {
    isAuthenticated: isAuthenticated && !loading,
    requireAuth: openAuth,
    openAuth,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <AuthGateSheet open={open} onClose={close} onAuthenticated={onAuthenticated} subtitle={subtitle} />
    </Ctx.Provider>
  );
}
