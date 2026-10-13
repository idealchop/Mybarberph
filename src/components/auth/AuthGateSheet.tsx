"use client";

/**
 * Sign-in sheet. Shown only when this device has no saved session.
 * Phone and Google both sign in locally; nothing is sent to a server.
 */
import { ChatIcon } from "@river-apps/icons";
import { Button, OtpInput, PhoneInput, cn } from "@river-apps/ui";
import { ArrowLeft, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { signIn } from "@/lib/session";

type Step = "methods" | "phone" | "code";

export function AuthGateSheet({ open, onClose, onAuthenticated }: { open: boolean; onClose: () => void; onAuthenticated?: () => void }) {
  if (!open) return null;
  return <Sheet onClose={onClose} onAuthenticated={onAuthenticated ?? onClose} />;
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7A5.4 5.4 0 0 1 3.6 9c0-.6.1-1.2.3-1.7V5H.9A9 9 0 0 0 0 9c0 1.4.3 2.8.9 4l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}

function Sheet({ onClose, onAuthenticated }: { onClose: () => void; onAuthenticated: () => void }) {
  const [step, setStep] = useState<Step>("methods");
  const [formatted, setFormatted] = useState("");
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function finish(phone?: string) {
    signIn({ name: "Jimboy", phone });
    onAuthenticated();
  }

  function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!e164) {
      setError("Enter your 10-digit mobile number, e.g. 917 123 4567.");
      return;
    }
    setError(null);
    setStep("code");
  }

  function verify(value = code) {
    if (value.length !== 6) return;
    setCode(value);
    finish(e164 ?? undefined);
  }

  const national = formatted || "your number";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="auth-gate-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div className={cn("relative z-[1] flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-card sm:rounded-[28px]")}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-[1] inline-flex size-9 items-center justify-center rounded-full bg-grey-100 text-ink hover:bg-grey-200"
          aria-label="Close"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
        <div className="max-h-[min(70dvh,560px)] overflow-y-auto px-5 pb-6 pt-5">
          <h2 id="auth-gate-title" className="pr-10 text-[24px] font-extrabold leading-[1.15] tracking-[-0.025em]">
            {step === "phone" ? "Your mobile number" : step === "code" ? "Enter the code" : "Sign up or log in"}
          </h2>
          <p className="mt-2 text-[14.5px] font-medium leading-snug text-muted">
            {step === "phone"
              ? "We’ll text you a 6-digit code to sign in."
              : step === "code"
                ? `Code sent to +63 ${national}.`
                : "Sign in to continue. You can keep browsing without an account."}
          </p>

          {step === "methods" ? (
            <div className="mt-5 flex flex-col gap-2.5">
              <Button type="button" fullWidth leadingIcon={<ChatIcon size={20} />} onClick={() => { setError(null); setStep("phone"); }}>
                Continue with phone
              </Button>
              <Button type="button" fullWidth variant="secondary" leadingIcon={<GoogleMark />} onClick={() => finish()}>
                Continue with Google
              </Button>
            </div>
          ) : null}

          {step === "phone" ? (
            <form onSubmit={sendCode} className="mt-5 flex flex-col gap-2.5">
              <PhoneInput
                label="Mobile number"
                value={formatted}
                onChange={(f, v) => { setFormatted(f); setE164(v); setError(null); }}
                autoFocus
                error={error ?? undefined}
              />
              <Button type="submit" fullWidth disabled={!e164} leadingIcon={<ChatIcon size={20} />}>Continue with phone</Button>
              <Button type="button" fullWidth variant="ghost" leadingIcon={<ArrowLeft size={18} strokeWidth={2.2} />} onClick={() => setStep("methods")}>
                Back
              </Button>
            </form>
          ) : null}

          {step === "code" ? (
            <div className="mt-5 flex flex-col gap-3">
              <OtpInput value={code} onChange={setCode} onComplete={(v) => verify(v)} autoFocus />
              <Button fullWidth disabled={code.length < 6} onClick={() => verify()}>Verify & continue</Button>
              <Button fullWidth variant="ghost" onClick={() => { setCode(""); setStep("phone"); }}>Use a different number</Button>
            </div>
          ) : null}

          <p className="mt-4 text-center text-[12px] font-medium text-muted">By continuing you agree to our Terms and Privacy Policy.</p>
        </div>
      </div>
    </div>
  );
}
