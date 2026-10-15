import { cn } from "@river-apps/ui";

/** Shimmering placeholder block (pulse only when motion is allowed). */
export function Sk({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block rounded-[12px] bg-grey-100 motion-safe:animate-pulse", className)} />;
}

function Shell({ children, wide, className }: { children: React.ReactNode; wide?: boolean; className?: string }) {
  return (
    <div role="status" aria-label="Loading" aria-busy="true" className={cn("mx-auto w-full max-w-[402px] px-4 pb-8 pt-5", wide ? "lg:max-w-[980px] lg:px-[30px]" : "lg:max-w-[720px] lg:px-[30px]", className)}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

const Title = () => <div className="flex items-center gap-2"><Sk className="size-9 rounded-full" /><Sk className="h-7 w-40" /></div>;
const Row = () => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Sk className="size-10 flex-none rounded-full" />
    <span className="flex-1 space-y-1.5"><Sk className="h-4 w-2/3" /><Sk className="h-3 w-1/3" /></span>
    <Sk className="h-4 w-14" />
  </div>
);

/** List screens: History, Activity, leaderboard, Queue. */
export function ListSkeleton({ rows = 6, chips = true, title = true }: { rows?: number; chips?: boolean; title?: boolean }) {
  return (
    <Shell>
      {title ? <Title /> : null}
      {chips ? <div className="mt-4 flex gap-2"><Sk className="h-8 w-24 rounded-pill" /><Sk className="h-8 w-16 rounded-pill" /><Sk className="h-8 w-16 rounded-pill" /></div> : null}
      <div className="mt-3 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">{Array.from({ length: rows }, (_, i) => <Row key={i} />)}</div>
    </Shell>
  );
}

/** Rows only (inside an existing screen). */
export function RowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return <div role="status" aria-label="Loading" className={cn("mt-3 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card", className)}>{Array.from({ length: rows }, (_, i) => <Row key={i} />)}</div>;
}

/** Sales / Performance: tabs, stat cards, chart, ranking. */
export function DashboardSkeleton({ title = true }: { title?: boolean }) {
  return (
    <Shell wide>
      {title ? <Title /> : null}
      <Sk className="mt-4 h-11 w-full rounded-pill" />
      <div className="mt-3 flex gap-2"><Sk className="h-8 w-20 rounded-pill" /><Sk className="h-8 w-12 rounded-pill" /><Sk className="h-8 w-10 rounded-pill" /></div>
      <div className="mt-4 grid grid-cols-2 gap-3"><Sk className="col-span-2 h-24 rounded-card" /><Sk className="h-20 rounded-card" /><Sk className="h-20 rounded-card" /></div>
      <Sk className="mt-3 h-52 rounded-card" />
      <div className="mt-3 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">{Array.from({ length: 3 }, (_, i) => <Row key={i} />)}</div>
    </Shell>
  );
}

/** Home and the barber link: header, hero, stats, cards. */
export function HomeSkeleton() {
  return (
    <Shell>
      <div className="flex items-center gap-2"><Sk className="size-9 rounded-[11px]" /><span className="space-y-1.5"><Sk className="h-3 w-24" /><Sk className="h-4 w-32" /></span></div>
      <Sk className="mt-4 h-[150px] rounded-banner" />
      <div className="mt-3 grid grid-cols-3 gap-3"><Sk className="h-[72px] rounded-card" /><Sk className="h-[72px] rounded-card" /><Sk className="h-[72px] rounded-card" /></div>
      <Sk className="mt-3 h-44 rounded-card" />
      <Sk className="mt-4 h-5 w-40" />
      <Sk className="mt-2 h-28 rounded-card" />
    </Shell>
  );
}

/** Settings / forms: cards of rows and inputs. */
export function FormSkeleton() {
  return (
    <Shell>
      <Title />
      <Sk className="mt-4 h-24 rounded-card" />
      <div className="mt-4 space-y-3 rounded-card bg-surface p-4 shadow-card">{Array.from({ length: 4 }, (_, i) => <Sk key={i} className="h-11 w-full" />)}</div>
      <div className="mt-4 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">{Array.from({ length: 3 }, (_, i) => <Row key={i} />)}</div>
    </Shell>
  );
}

/** Customer ticket / booking page. */
export function TicketSkeleton() {
  return (
    <Shell className="max-w-[440px]">
      <div className="flex items-center gap-3"><Sk className="size-12 rounded-full" /><span className="space-y-1.5"><Sk className="h-5 w-40" /><Sk className="h-3 w-24" /></span></div>
      <Sk className="mt-5 h-4 w-28" />
      <Sk className="mt-2 h-36 rounded-card" />
      <Sk className="mt-3 h-24 rounded-card" />
      <Sk className="mt-4 h-12 rounded-pill" />
    </Shell>
  );
}
