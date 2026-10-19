"use client";
/**
 * Guest browse + login-on-action (River Mobile AuthGate pattern).
 * Guests can open every page. Controls marked `data-auth="action"` (and forms
 * whose submit button is marked) open the sign-in sheet instead of running;
 * once signed in, the same action is replayed so the guest continues where they were.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { startCloud } from "@/lib/cloud";
import { usePathname } from "next/navigation";
import { autoOpensLogin, takeAutoLoginTurn } from "@/lib/auto-login";
import { finishRedirectSignIn, useSession } from "@/lib/session";
import { AuthGateSheet } from "./auth-gate-sheet";

type Ctx = { isAuthenticated: boolean; requireAuth: (after?: () => void) => void };
const AuthGateContext = createContext<Ctx | null>(null);

export function useAuthGate(): Ctx {
  const v = useContext(AuthGateContext);
  return v ?? { isAuthenticated: true, requireAuth: (after) => after?.() };
}

const SELECTOR = '[data-auth="action"]';

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { ready, user, signingIn } = useSession();
  const pathname = usePathname() || "/";
  const authed = Boolean(user);
  const authedRef = useRef(authed);
  useEffect(() => { authedRef.current = authed; }, [authed]);
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const replaying = useRef(false);

  useEffect(() => { startCloud(); void finishRedirectSignIn(); }, []);

  // A signed-out visitor on a dashboard page sees the sign-in sheet once per visit. It stays dismissable
  // (guests keep browsing; actions still ask). Never on guest pages or while a Google redirect is finishing.
  useEffect(() => {
    if (!ready || user || signingIn || !autoOpensLogin(pathname)) return;
    if (!takeAutoLoginTurn()) return;
    const t = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(t);
  }, [ready, user, signingIn, pathname]);

  const requireAuth = useCallback((after?: () => void) => {
    if (authedRef.current) { after?.(); return; }
    pending.current = after ?? null;
    setOpen(true);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (authedRef.current || replaying.current) return;
      const el = (e.target as Element | null)?.closest?.(SELECTOR) as HTMLElement | null;
      if (!el || el.closest('[aria-labelledby="auth-gate-title"]')) return;
      if ((el as HTMLButtonElement).disabled) return;
      e.preventDefault();
      e.stopPropagation();
      requireAuth(() => {
        if (!el.isConnected) return;
        replaying.current = true;
        try { el.click(); } finally { replaying.current = false; }
      });
    }
    function onSubmit(e: SubmitEvent) {
      if (authedRef.current || replaying.current) return;
      const form = e.target as HTMLFormElement;
      const sub = e.submitter as HTMLElement | null;
      if (!(sub?.matches(SELECTOR) || form.matches(SELECTOR))) return;
      e.preventDefault();
      e.stopPropagation();
      requireAuth(() => {
        if (!form.isConnected) return;
        replaying.current = true;
        try { form.requestSubmit(sub && sub.isConnected ? (sub as HTMLButtonElement) : undefined); } finally { replaying.current = false; }
      });
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [requireAuth]);

  const close = useCallback(() => { pending.current = null; setOpen(false); }, []);
  const onAuthenticated = useCallback(() => {
    setOpen(false);
    const next = pending.current;
    pending.current = null;
    if (next) requestAnimationFrame(() => requestAnimationFrame(next));
  }, []);

  return (
    <AuthGateContext.Provider value={{ isAuthenticated: authed, requireAuth }}>
      {children}
      <AuthGateSheet open={open && !signingIn} onClose={close} onAuthenticated={onAuthenticated} />
      {signingIn ? (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-canvas/85 backdrop-blur-sm">
          <Loader2 size={28} strokeWidth={2.2} className="animate-spin text-ink" aria-hidden />
          <b className="text-[15px] font-extrabold">Signing you in…</b>
        </div>
      ) : null}
    </AuthGateContext.Provider>
  );
}
