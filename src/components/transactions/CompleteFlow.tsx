"use client";
import { Button, Input, SegmentedControl } from "@river-apps/ui";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { markDone, type ChairRequest } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { TransactionSheet } from "./TransactionSheet";

const EVT = "barbers-complete-cut";

/** Opens the "Confirm payment" popup for a cut; on confirm it's marked done and its order details open. */
export function completeCut(row: ChairRequest) {
  window.dispatchEvent(new CustomEvent<ChairRequest>(EVT, { detail: row }));
}

export function CompleteFlowHost() {
  const [row, setRow] = useState<ChairRequest | null>(null);
  const [details, setDetails] = useState<ChairRequest | null>(null);
  useEffect(() => {
    const on = (e: Event) => setRow((e as CustomEvent<ChairRequest>).detail);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return (
    <>
      {row ? <CompletePaymentSheet key={row.id} row={row} onClose={() => setRow(null)} onDone={(r) => { setRow(null); setDetails(r); }} /> : null}
      {details ? <TransactionSheet row={details} onClose={() => setDetails(null)} /> : null}
    </>
  );
}

function CompletePaymentSheet({ row, onClose, onDone }: { row: ChairRequest; onClose: () => void; onDone: (r: ChairRequest) => void }) {
  const onlinePaid = Boolean(row.paid) && row.payWhere === "online";
  const [amount, setAmount] = useState(row.price ? String(row.price / 100) : "");
  const [method, setMethod] = useState<"cash" | "gcash">(row.payMethod === "gcash" ? "gcash" : "cash");
  const [paid, setPaid] = useState(true);
  const cents = Math.max(0, Math.round(Number(amount) * 100) || 0);
  const confirm = () => {
    const pay = { price: onlinePaid ? row.price : cents, paid: onlinePaid || paid, method };
    markDone(row.id, onlinePaid ? undefined : pay);
    onDone({ ...row, status: "done", completedAt: Date.now(), price: pay.price, paid: pay.paid, payMethod: onlinePaid ? row.payMethod : paid ? method : undefined });
  };
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pay-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div className="relative z-[1] w-full max-w-[440px] rounded-t-[28px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-card sm:rounded-[28px]">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-grey-100"><X size={16} strokeWidth={2.2} /></button>
        <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-muted">Complete · {row.ref}</p>
        <h2 id="pay-title" className="mt-1 pr-10 text-[22px] font-extrabold tracking-[-0.02em]">Confirm payment</h2>
        <p className="mt-1 text-[13.5px] font-semibold text-muted">{row.customerLabel || "Walk-in"} · {row.serviceName}</p>
        {onlinePaid ? <p className="mt-4 rounded-[14px] bg-grey-100 px-3 py-3 text-[14px] font-semibold">Paid online · {peso(row.price ?? 0)}</p> : (
          <div className="mt-4 flex flex-col gap-3">
            <Input label="Amount (₱)" inputMode="decimal" value={amount} placeholder="e.g. 150" onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            <SegmentedControl label="Method" value={method} onChange={(v: string) => setMethod(v as "cash" | "gcash")} options={[{ value: "cash", label: "Cash" }, { value: "gcash", label: "GCash" }]} />
            <label className="flex items-center justify-between rounded-[14px] bg-grey-100 px-3 py-3">
              <span className="text-[14.5px] font-bold">Paid</span>
              <input type="checkbox" role="switch" aria-label="Paid" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-5 accent-[var(--color-ink,#111)]" />
            </label>
          </div>
        )}
        <Button data-auth="action" className="mt-5" fullWidth onClick={confirm}>Confirm &amp; complete</Button>
      </div>
    </div>
  );
}
