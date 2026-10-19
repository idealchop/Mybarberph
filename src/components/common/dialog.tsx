"use client";
import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn, IconButton } from "@river-apps/ui";

/** Lightweight modal on kit tokens (overlay + white card). Esc and backdrop close it. */
export function Dialog({ open, onClose, title, subtitle, children, footer, className }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string;
}) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={id} className={cn("max-h-[92dvh] w-full overflow-y-auto rounded-t-card bg-surface p-5 shadow-float sm:max-w-[460px] sm:rounded-card", className)}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <h2 id={id} className="text-[19px] font-extrabold tracking-[-0.02em]">{title}</h2>
            {subtitle ? <p className="mt-1 text-[13px] font-semibold text-muted">{subtitle}</p> : null}
          </div>
          <IconButton label="Close" variant="soft" icon={<X size={18} strokeWidth={1.75} />} onClick={onClose} />
        </div>
        {children}
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Native select styled like the kit Input (md). */
export function SelectField<V extends string>({ label, value, onChange, options, className }: {
  label: string; value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={id} className="mb-2 text-[14px] font-bold">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as V)}
        className="h-[46px] rounded-tile bg-canvas px-4 text-[14px] font-semibold text-ink outline-none focus:bg-surface focus:ring-2 focus:ring-ink">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/** Kit-styled on/off switch. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-[26px] w-[44px] flex-none items-center rounded-pill transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-45",
        checked ? "bg-ink" : "bg-grey-200")}>
      <span className={cn("block size-5 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-transform", checked ? "translate-x-[21px]" : "translate-x-[3px]")} />
    </button>
  );
}
