"use client";
/**
 * Settings › Account: how the owner signs in, and Change password for accounts that have one.
 * Barbers.ph signs in with Google or a text code today, so most accounts see "You sign in with …" and no form.
 */
import { Card, Input, Topbar } from "@river-apps/ui";
import { KeyRound, Phone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/common/button";
import { PageBack } from "@/components/shell/page-back";
import { useAuthGate } from "@/components/auth/auth-gate-provider";
import { authErrorMessage, changePassword, newPasswordError, signInKind, useSession } from "@/lib/session";

export function AccountScreen() {
  const { ready, user } = useSession();
  const { requireAuth } = useAuthGate();
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pb-10 pt-4">
      <Topbar className="px-1" leading={<PageBack fallback="/settings" />} title="Account" subtitle="Sign-in and password" />
      {!ready ? <div aria-busy="true" aria-label="Loading" className="mt-4 h-28 animate-pulse rounded-card bg-surface shadow-card" /> : !user ? (
        <Card className="mt-4 px-4 py-4">
          <p className="text-[14.5px] font-semibold text-ink-2">Sign in to see your account.</p>
          <Button className="mt-3" size="sm" onClick={() => requireAuth()}>Sign in</Button>
        </Card>
      ) : <AccountBody providers={user.providers} email={user.email} phone={user.phone} />}
    </main>
  );
}

function AccountBody({ providers, email, phone }: { providers: string[]; email?: string; phone?: string }) {
  const kind = signInKind(providers);
  if (kind === "password") return <ChangePasswordForm email={email} />;
  return (
    <Card className="mt-4 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 flex-none items-center justify-center rounded-tile bg-grey-100">{kind === "phone" ? <Phone size={18} strokeWidth={1.75} /> : <KeyRound size={18} strokeWidth={1.75} />}</span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold">{kind === "google" ? "You sign in with Google" : kind === "phone" ? "You sign in with a text code" : "No password on this account"}</h2>
          <p className="mt-1 text-[13.5px] font-medium text-muted">
            {kind === "google" ? `${email ? `${email}. ` : ""}There’s no Barbers.ph password to change. Manage your password in your Google account.`
              : kind === "phone" ? `We text a 6-digit code to ${phone || "your number"} each time you sign in. There’s no password to change.`
                : "This account signs in without a password."}
          </p>
        </div>
      </div>
    </Card>
  );
}

function ChangePasswordForm({ email }: { email?: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setDone(false);
    const bad = !current ? "Enter your current password." : newPasswordError(next, confirm, current);
    if (bad) { setError(bad); return; }
    setBusy(true); setError(null);
    try {
      await changePassword(current, next);
      setDone(true); setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mt-4 px-4 py-4">
      <h2 className="text-[16px] font-extrabold">Change password</h2>
      {email ? <p className="mt-0.5 text-[13px] font-semibold text-muted">{email}</p> : null}
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3" noValidate>
        <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" fullWidth loading={busy}>{busy ? "Saving…" : "Change password"}</Button>
      </form>
      {error ? <p role="alert" className="mt-3 text-[13.5px] font-semibold text-[#C2410C]">{error}</p> : null}
      {done ? <p role="status" className="mt-3 text-[13.5px] font-semibold text-ink">Password changed.</p> : null}
    </Card>
  );
}
