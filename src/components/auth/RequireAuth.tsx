"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { Spinner } from "./Screen";

/** Client guard: unsigned users go to the welcome landing. Server pages still enforce the session cookie. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);
  if (loading || !user) return <Spinner label="Checking sign-in" />;
  return <>{children}</>;
}
