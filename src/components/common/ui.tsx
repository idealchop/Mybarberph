import type { ReactNode } from "react";
import { Check, CreditCard, Banknote, Smartphone, Wallet } from "lucide-react";
import { cn, CardHeader } from "@river-apps/ui";
import type { PaymentMethod, TicketStatus } from "@/data";
import { PAYMENT_LABEL } from "@/lib/format";

/** White card with the mockups' panel padding (kit Card surface tokens). */
export function Panel({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={cn("rounded-card bg-surface px-[18px] pb-3 pt-4 shadow-card", className)}>{children}</As>;
}

/** Kit CardHeader re-export with the mockups' spacing. */
export function PanelHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return <CardHeader title={title} subtitle={subtitle} action={action} className={className} />;
}

/** Bold underlined text link used in card headers ("Open queue", "See all"). */
export function TextLink({ href, children, onClick }: { href?: string; children: ReactNode; onClick?: () => void }) {
  const cls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px] hover:decoration-ink";
  return href ? <a href={href} className={cls}>{children}</a> : <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

/** Grey or black pill (kit Badge geometry). */
export function Pill({ children, tone = "soft", className }: { children: ReactNode; tone?: "soft" | "solid" | "outline"; className?: string }) {
  return (
    <span className={cn("inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-[12px] font-bold leading-none",
      tone === "soft" && "bg-grey-100 text-ink", tone === "solid" && "bg-ink text-on-ink", tone === "outline" && "bg-surface text-ink ring-1 ring-inset ring-grey-200", className)}>
      {children}
    </span>
  );
}

/** Queue status, never colour-only (dot + words). */
export function StatusPill({ status, nextUp }: { status: TicketStatus; nextUp?: boolean }) {
  const base = "inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-pill font-bold leading-none px-2.5 py-1 text-[12px]";
  if (status === "in_service") return <span className={cn(base, "bg-ink text-on-ink")}><i aria-hidden className="block size-[6px] rounded-full bg-on-ink" />In chair</span>;
  if (status === "waiting" && nextUp) return <span className={cn(base, "bg-grey-100 text-ink ring-1 ring-inset ring-ink")}><i aria-hidden className="block size-[6px] rounded-full bg-ink" />Next up</span>;
  if (status === "waiting" || status === "called") return <span className={cn(base, "bg-grey-100 text-ink")}><i aria-hidden className="block size-[6px] rounded-full bg-grey-400" />{status === "called" ? "Called" : "Waiting"}</span>;
  if (status === "pending_verification") return <span className={cn(base, "bg-surface text-ink ring-1 ring-inset ring-ink")}>To verify</span>;
  if (status === "awaiting_confirmation") return <span className={cn(base, "bg-grey-100 text-ink")}>Confirming</span>;
  return <span className={cn(base, "gap-1 bg-surface text-muted ring-1 ring-inset ring-grey-200")}><Check size={12} strokeWidth={2.4} />Done</span>;
}

const PAY_ICON: Record<PaymentMethod, ReactNode> = {
  cash: <Banknote size={13} strokeWidth={1.75} />, gcash: <Smartphone size={13} strokeWidth={1.75} />,
  maya: <Wallet size={13} strokeWidth={1.75} />, card: <CreditCard size={13} strokeWidth={1.75} />,
};
export function PaymentPill({ method }: { method: PaymentMethod }) {
  return <Pill tone="outline">{PAY_ICON[method]}{PAYMENT_LABEL[method]}</Pill>;
}

/** Monospace ticket reference. */
export function Ref({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[13px] font-semibold tracking-[0.02em]", className)}>{children}</span>;
}

/** Black monospace code chip (voucher codes, River Mobile refs). */
export function CodeChip({ children, tone = "ink", className }: { children: ReactNode; tone?: "ink" | "grey"; className?: string }) {
  return <span className={cn("rounded-sm px-2 py-1 font-mono text-[11.5px] font-semibold tracking-[0.04em]", tone === "ink" ? "bg-ink text-on-ink" : "bg-grey-100", className)}>{children}</span>;
}

/** Small filter chip with a chevron, used above tables. */
export function FilterSelect<V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; label: string }) {
  return (
    <label className="relative inline-flex h-[34px] items-center rounded-pill bg-grey-100 text-[13px] font-bold">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as V)} className="h-full appearance-none rounded-pill bg-transparent pl-3 pr-7 outline-none focus-visible:ring-2 focus-visible:ring-ink">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-2.5"><path d="m6 9 6 6 6-6" /></svg>
    </label>
  );
}
