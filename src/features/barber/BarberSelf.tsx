"use client";
import { Button, Input, SegmentedControl } from "@river-apps/ui";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import type { BarberSales, BarberSalesRow } from "@/lib/barber-sales";
import { saveBarberName } from "@/lib/cloud";
import { peso } from "@/lib/format";

/** The barber sets their own name on the link (only their chair's name changes). */
export function BarberNameEdit({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!open) {
    return (
      <button type="button" onClick={() => { setValue(name); setOpen(true); }} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-ink-2 underline decoration-grey-300 underline-offset-[3px]">
        <Pencil size={12} strokeWidth={2} /> {name ? "Edit my name" : "Set my name"}
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-card bg-surface p-3 shadow-card">
      <Input label="Your name" value={value} maxLength={40} onChange={(e) => setValue(e.target.value)} />
      {err ? <p className="mt-2 text-[12.5px] font-semibold">{err}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="flex-1" disabled={busy || !value.trim()} onClick={async () => {
          setBusy(true); setErr("");
          try { await saveBarberName(value.trim()); setOpen(false); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
        }}>Save</Button>
      </div>
    </div>
  );
}

/** This barber's own totals: this week (Mon–Sun) or this month, Manila time. */
export function BarberTotals({ token, refreshKey }: { token: string; refreshKey: number }) {
  const [range, setRange] = useState<"week" | "month">("week");
  const [data, setData] = useState<(BarberSales & { mine: BarberSalesRow }) | null>(null);
  useEffect(() => {
    let live = true;
    const pull = () => void fetch(`/api/barber/${token}/sales?range=${range}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((d) => { if (live && d) setData(d); }).catch(() => undefined);
    pull();
    // A just-completed cut is saved in the background; read again once it has landed, then every 30s.
    const soon = window.setTimeout(pull, 2500);
    const every = window.setInterval(pull, 30_000);
    return () => { live = false; window.clearTimeout(soon); window.clearInterval(every); };
  }, [token, range, refreshKey]);
  const m = data?.mine;
  return (
    <section className="mt-5 rounded-card bg-surface px-4 py-4 shadow-card" aria-label="My sales">
      <div className="flex items-center justify-between gap-3">
        <b className="text-[16px]">My sales</b>
        <span className="text-[12px] font-semibold text-muted">{data?.label ?? ""}</span>
      </div>
      <SegmentedControl className="mt-3" label="Period" value={range} onChange={(v: string) => setRange(v as "week" | "month")} options={[{ value: "week", label: "This week" }, { value: "month", label: "This month" }]} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat k="Cuts" v={m ? String(m.cuts) : "–"} />
        <Stat k="Sales" v={m ? peso(m.gross) : "–"} />
        <Stat k="Cash collected" v={m ? peso(m.cash) : "–"} />
        <Stat k="GCash" v={m ? peso(m.gcash) : "–"} />
      </div>
      <p className="mt-3 rounded-[12px] bg-ink px-3 py-2.5 text-[14px] font-bold text-on-ink">Cash to hand to the shop: {m ? peso(m.remit) : "–"}</p>
      {m && m.unpaid ? <p className="mt-2 text-[12.5px] font-semibold text-muted">Not paid yet: {peso(m.unpaid)}</p> : null}
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[12px] bg-grey-100 px-3 py-2.5">
      <p className="text-[12px] font-semibold text-muted">{k}</p>
      <b className="text-[17px] tracking-[-0.02em]">{v}</b>
    </div>
  );
}
