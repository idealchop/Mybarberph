"use client";

import { ShieldIcon } from "@river-apps/icons";
import { Button, OtpInput, formatPhilippineMobile } from "@river-apps/ui";
import { Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthNav } from "@/components/auth/AuthNav";
import { AuthBadge, Screen } from "@/components/auth/Screen";
import { authErrorMessage, confirmPhoneCode, pendingPhone } from "@/lib/firebase/auth-context";
import { ensureShopAndRedirect } from "@/lib/post-login";

const RESEND_SECONDS = 45;

export default function CodePage() {
  const router = useRouter();
  const [pending] = useState(() => pendingPhone());
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending) router.replace("/sign-in/phone");
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pending, router]);

  async function verify(value = code) {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await confirmPhoneCode(value);
      await ensureShopAndRedirect(router);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  const left = pending ? Math.max(0, RESEND_SECONDS - Math.floor((now - pending.sentAt) / 1000)) : 0;
  const national = pending ? formatPhilippineMobile(pending.phoneE164.replace(/^\+63/, "")) : "";

  return (
    <Screen>
      <AuthNav back="/sign-in/phone" />
      <div className="px-6 pt-2">
        <AuthBadge><ShieldIcon size={58} /></AuthBadge>
        <h1 className="mt-[22px] text-[27px] font-extrabold leading-[1.15] tracking-[-0.025em]">Enter the code</h1>
        <p className="mt-1.5 text-[15.5px] font-medium text-muted">
          Sent to +63 {national} ·{" "}
          <Link href="/sign-in/phone" className="font-bold text-ink underline decoration-grey-300 underline-offset-[3px]">Change</Link>
        </p>
        <OtpInput className="mt-6" value={code} onChange={setCode} onComplete={verify} autoFocus error={!!error} />
        {error ? (
          <p role="alert" className="mt-3 text-[13.5px] font-semibold">{error}</p>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-[13.5px] font-medium text-muted">
            <Clock size={15} strokeWidth={1.75} />
            {left > 0 ? `Resend code in 0:${String(left).padStart(2, "0")}` : <Link href="/sign-in/phone" className="font-bold text-ink underline">Send a new code</Link>}
          </p>
        )}
      </div>
      <div className="mt-auto px-6 pb-10 pt-6">
        <Button fullWidth onClick={() => verify()} disabled={busy || code.length !== 6}>
          {busy ? "Checking…" : "Verify"}
        </Button>
      </div>
    </Screen>
  );
}
