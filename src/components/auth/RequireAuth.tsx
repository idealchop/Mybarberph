"use client";

import type { ReactNode } from "react";

/**
 * @deprecated Prefer guest browse + AuthGateProvider (River Mobile pattern).
 * Kept as a passthrough so older imports don’t hard-block navigation.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
