import { APP_VERSION, BUILD_ID } from "@/lib/app-version";

/** Minimal, centered version line: "Version 1.0.0 · build". */
export function AppVersion({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-[10.5px] font-medium text-muted ${className}`}>
      Version {APP_VERSION} <span className="opacity-70">· {BUILD_ID}</span>
    </p>
  );
}
