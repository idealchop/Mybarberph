"use client";

import { Button, FloatingCard, ProgressRing } from "@river-apps/ui";
import { Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarberChair, BarberIcon } from "@/components/art";
import { GoogleG } from "@/components/auth/GoogleG";
import { Screen } from "@/components/auth/Screen";
import { Brand } from "@/components/shell/Brand";
import { authErrorMessage, signInWithGoogle, useAuth } from "@/lib/firebase/auth-context";
import { ensureShopAndRedirect } from "@/lib/post-login";

/** Welcome / sign-in — mirrors MyCarwash landing (phone + Google, no password). */
export default function WelcomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (loading || !user || started.current) return;
    started.current = true;
    void ensureShopAndRedirect(router).catch((err) => {
      setError(authErrorMessage(err));
      started.current = false;
    });
  }, [loading, user, router]);

  async function google() {
    setError(null);
    setBusy(true);
    try {
      const u = await signInWithGoogle();
      if (u) await ensureShopAndRedirect(router);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  if (loading || (user && !error)) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center bg-canvas">
        <span className="size-8 animate-spin rounded-full border-[3px] border-grey-200 border-t-ink" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <Screen>
      <div className="px-6 pt-3.5"><Brand /></div>
      <div className="relative mx-4 mt-[18px] h-[322px] overflow-hidden rounded-[32px] bg-[radial-gradient(60%_55%_at_50%_60%,#fff_0%,rgba(255,255,255,0)_70%),linear-gradient(180deg,#ECECEF,#F6F6F8)]">
        <div className="absolute inset-x-[-8px] bottom-[10px] flex justify-center">
          <BarberChair size={210} />
        </div>
        <FloatingCard
          className="absolute left-[18px] top-[22px]"
          icon={<ProgressRing value={74} size={36} thickness={4.5} label="9m" labelSize={9} />}
          title="Chair 2"
          subtitle="Skin fade"
        />
        <FloatingCard
          className="absolute right-4 top-[70px]"
          icon={<BarberIcon name="ticket" size={30} />}
          title="+₱450"
          subtitle="New ticket"
        />
      </div>
      <div className="px-7 pt-[26px]">
        <h1 className="text-[31px] font-extrabold leading-[1.12] tracking-[-0.03em]">
          Run your barbershop
          <br />
          from your phone
        </h1>
        <p className="mt-2.5 text-[16px] font-medium text-muted">Queue, sales and River Mobile bookings in one simple app.</p>
      </div>
      <div className="mt-auto flex flex-col gap-2.5 px-6 pb-10 pt-6">
        <Button href="/sign-in/phone" fullWidth leadingIcon={<Smartphone size={20} strokeWidth={1.75} />}>
          Continue with phone number
        </Button>
        <Button fullWidth variant="secondary" leadingIcon={<GoogleG />} onClick={google} disabled={busy}>
          Continue with Google
        </Button>
        {error ? <p role="alert" className="text-center text-[13.5px] font-semibold">{error}</p> : null}
        <p className="mt-1.5 text-center text-[12.5px] font-medium text-muted">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
        <p className="text-center text-[12px] font-medium text-muted">
          <a href="/login" className="underline underline-offset-2">Email sign-in</a>
          {" · "}
          <a href="/demo" className="underline underline-offset-2">Demo screens</a>
        </p>
      </div>
    </Screen>
  );
}
