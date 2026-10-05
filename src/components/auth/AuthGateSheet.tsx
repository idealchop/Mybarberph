"use client";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Smartphone } from "lucide-react";
import { Button, cn } from "@river-apps/ui";
import { GoogleG } from "@/components/auth/GoogleG";
import {
  authErrorMessage,
  sendPhoneCode,
  confirmPhoneCode,
  signInWithGoogle,
  useAuth,
} from "@/lib/firebase/auth-context";

type Props = {
  open: boolean;
  onClose: () => void;
  /** After session + shop ensure succeed (stay on the current screen). */
  onAuthenticated: () => void;
  subtitle?: string;
};

/**
 * Bottom sheet sign-in — mirrors River Mobile AuthGateSheet:
 * guest can dismiss; signing in continues the pending action on this page.
 */
export function AuthGateSheet({
  open,
  onClose,
  onAuthenticated,
  subtitle = "Sign in to save changes and run your shop.",
}: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const btnId = useId().replace(/:/g, "");
  const [step, setStep] = useState<"methods" | "code">("methods");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("methods");
      setCode("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && user) {
      void finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  async function finish() {
    try {
      setBusy(true);
      const res = await fetch("/api/auth/ensure-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not open your shop.");
      }
      router.refresh();
      onAuthenticated();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // onAuthStateChanged mints session; effect calls finish when user is set
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  }

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      const digits = phone.replace(/\D/g, "");
      const e164 = digits.startsWith("63") ? `+${digits}` : digits.startsWith("0") ? `+63${digits.slice(1)}` : `+63${digits}`;
      await sendPhoneCode(e164, `bp-gate-recaptcha-${btnId}`);
      setStep("code");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setError(null);
    setBusy(true);
    try {
      await confirmPhoneCode(code.trim());
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="bp-auth-gate-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div
        className={cn(
          "relative z-[1] flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-raised",
          "sm:rounded-[28px] sm:max-h-[90dvh]",
          "",
        )}
      >
        <div className="flex items-center justify-between bg-ink px-5 py-4 text-on-ink">
          <b className="text-[15px] tracking-[-0.01em]">Barbers.ph</b>
          <button type="button" onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-full bg-on-ink-subtle" aria-label="Close">
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div className="max-h-[min(70dvh,560px)] overflow-y-auto px-5 pb-6 pt-5">
          <h2 id="bp-auth-gate-title" className="text-[24px] font-extrabold tracking-[-0.025em] leading-[1.15]">
            Sign up or log in
          </h2>
          <p className="mt-2 text-[14.5px] font-medium leading-snug text-muted">{subtitle}</p>

          {step === "methods" ? (
            <div className="mt-5 flex flex-col gap-2.5">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold" htmlFor="bp-gate-phone">Mobile number</label>
                <div className="flex gap-2">
                  <span className="inline-flex h-12 items-center rounded-[16px] bg-grey-100 px-3 text-[14px] font-bold">+63</span>
                  <input
                    id="bp-gate-phone"
                    inputMode="tel"
                    placeholder="917 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 min-w-0 flex-1 rounded-[16px] bg-grey-100 px-3.5 text-[15px] font-semibold outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>
              </div>
              <Button
                id={`bp-gate-recaptcha-${btnId}`}
                fullWidth
                disabled={busy || phone.replace(/\D/g, "").length < 10}
                leadingIcon={<Smartphone size={18} strokeWidth={1.75} />}
                onClick={() => void sendCode()}
              >
                {busy ? "Sending…" : "Continue with phone"}
              </Button>
              <Button fullWidth variant="secondary" leadingIcon={<GoogleG />} disabled={busy} onClick={() => void google()}>
                Continue with Google
              </Button>
              <Button fullWidth variant="ghost" href="/login" onClick={onClose}>
                Email sign-in
              </Button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3">
              <label className="text-[13px] font-bold" htmlFor="bp-gate-code">Enter the 6-digit code</label>
              <input
                id="bp-gate-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-12 rounded-[16px] bg-grey-100 px-3.5 font-mono text-[18px] font-bold tracking-[0.2em] outline-none focus:ring-2 focus:ring-ink"
              />
              <Button fullWidth disabled={busy || code.trim().length < 6} onClick={() => void verifyCode()}>
                {busy ? "Verifying…" : "Verify & continue"}
              </Button>
              <Button fullWidth variant="ghost" disabled={busy} onClick={() => setStep("methods")}>
                Use a different number
              </Button>
            </div>
          )}

          {error ? <p role="alert" className="mt-3 text-center text-[13.5px] font-semibold">{error}</p> : null}
          <p className="mt-4 text-center text-[12px] font-medium text-muted">You can keep browsing. Sign in when you’re ready to make changes.</p>
        </div>
      </div>
    </div>
  );
}
