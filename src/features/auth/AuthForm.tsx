"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, cn } from "@river-apps/ui";
import { Brand } from "@/components/shell/Brand";
import { authErrorMessage, signInEmail, signUpEmail } from "@/lib/firebase/auth-context";
import { ensureShopAndRedirect } from "@/lib/post-login";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("Kanto Kings Barbershop");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (mode === "login") await signInEmail(email.trim(), password);
      else await signUpEmail(email.trim(), password, shopName.trim());
      await ensureShopAndRedirect(router, { shopName: shopName.trim() });
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Brand />
</div>
      <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">{mode === "login" ? "Sign in" : "Create your shop"}</h1>
      <p className="mt-1.5 text-[14px] font-semibold text-muted">
        {mode === "login" ? "Owner and staff access for Barbers.ph." : "Starts you on the Paid plan with demo queue, sales and River Mobile bookings."}
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        {mode === "signup" && (
          <Input label="Shop name" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Kanto Kings Barbershop" required />
        )}
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@shop.com" required />
        <Input label="Password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} />
        {error && <p className="rounded-card bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">{error}</p>}
        <Button type="submit" disabled={busy} className="mt-1 w-full">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create shop"}</Button>
      </form>


      <p className={cn("mt-6 text-center text-[13px] font-semibold text-muted")}>
        {mode === "login" ? (
          <>No account yet? <Link href="/signup" className="font-bold text-ink underline underline-offset-2">Create a shop</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="font-bold text-ink underline underline-offset-2">Sign in</Link></>
        )}
      </p>
      <p className="mt-3 text-center text-[12px] font-medium text-muted"><Link href="/" className="underline underline-offset-2">← Phone / Google sign-in</Link></p>
    </div>
  );
}
