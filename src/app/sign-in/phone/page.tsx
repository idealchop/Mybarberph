"use client";

import { ChatIcon } from "@river-apps/icons";
import { Button, PhoneInput } from "@river-apps/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthNav } from "@/components/auth/AuthNav";
import { AuthBadge, Screen } from "@/components/auth/Screen";
import { authErrorMessage, sendPhoneCode } from "@/lib/firebase/auth-context";

export default function PhoneNumberPage() {
  const router = useRouter();
  const [formatted, setFormatted] = useState("");
  const [e164, setE164] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!e164) return setError("Enter your 10-digit mobile number, e.g. 917 123 4567.");
    setBusy(true);
    setError(null);
    try {
      await sendPhoneCode(e164, "send-code");
      router.push("/sign-in/code");
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AuthNav back="/" />
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <div className="px-6 pt-2">
          <AuthBadge><ChatIcon size={58} /></AuthBadge>
          <h1 className="mt-[22px] text-[27px] font-extrabold leading-[1.15] tracking-[-0.025em]">Your mobile number</h1>
          <p className="mt-1.5 text-[15.5px] font-medium text-muted">We’ll text you a 6-digit code to sign in.</p>
          <div className="mt-6">
            <PhoneInput
              label="Mobile number"
              hideLabel
              name="phone"
              value={formatted}
              onChange={(f, v) => {
                setFormatted(f);
                setE164(v);
              }}
              autoFocus
              hint="Leave out the first 0, e.g. 917 123 4567"
              error={error ?? undefined}
            />
          </div>
        </div>
        <div className="mt-auto px-6 pb-10 pt-6">
          <Button id="send-code" type="submit" fullWidth disabled={busy || !e164}>
            {busy ? "Sending…" : "Send code"}
          </Button>
        </div>
      </form>
    </Screen>
  );
}
