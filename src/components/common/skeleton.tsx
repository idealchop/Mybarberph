import { cn } from "@river-apps/ui";

/** Shimmering placeholder block (pulse only when motion is allowed). */
export function Sk({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton-shimmer block rounded-[12px] bg-grey-200", className)} />;
}


const Row = () => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Sk className="size-10 flex-none rounded-full" />
    <span className="flex-1 space-y-1.5"><Sk className="h-4 w-2/3" /><Sk className="h-3 w-1/3" /></span>
    <Sk className="h-4 w-14" />
  </div>
);

/** Rows only (inside an existing screen). */
export function RowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return <div role="status" aria-label="Loading" className={cn("mt-3 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card", className)}>{Array.from({ length: rows }, (_, i) => <Row key={i} />)}</div>;
}
