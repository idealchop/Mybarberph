import { APP_VERSION } from "@/lib/app-version";

/** Minimal, centered version line: "Version 1.0.0" (the build id stays in /api/version). */
export function AppVersion({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-[10.5px] font-medium text-muted ${className}`}>
      Version {APP_VERSION}
    </p>
  );
}
