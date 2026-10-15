"use client";
import { Button, Input } from "@river-apps/ui";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { markDone, type ChairRequest } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { TransactionSheet } from "./TransactionSheet";
import { useShopMenu } from "@/lib/shop-services";

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
  const { haircut, treatments } = useShopMenu(row.locationId || undefined);
  // Default amount: the booked amount, else the menu prices (this shop) of the services on the visit. Never empty.
  const names = (row.serviceName || "").split(" · ");
  const menuTotal = Math.round(([haircut, ...treatments].filter((m) => names.includes(m.name)).reduce((s, m) => s + (m.price ?? 0), 0) || (haircut.price ?? 0)) * 100);
  const base = row.price || menuTotal;
  const method = row.payPref === "gcash" ? "gcash" : "cash";
  const [adjust, setAdjust] = useState(false);
  const [amount, setAmount] = useState(String(base / 100));
  const [busy, setBusy] = useState(false);
  const typed = Math.round(Number(amount) * 100);
  const cents = adjust && typed > 0 ? typed : base;
  /** One tap: paid at the default amount (cash unless the customer chose GCash). Change it after in order details. */
  const confirm = () => {
    if (busy) return;
    setBusy(true);
    const price = onlinePaid ? row.price : cents;
    markDone(row.id, onlinePaid ? undefined : { price, paid: true, method });
    onDone({ ...row, status: "done", completedAt: Date.now(), price, paid: true, payMethod: onlinePaid ? row.payMethod : method, chairLabel: undefined, seatLabel: row.seatLabel || row.chairLabel });
  };
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pay-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div className="relative z-[1] w-full max-w-[440px] rounded-t-[28px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-card sm:rounded-[28px]">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-grey-100"><X size={16} strokeWidth={2.2} /></button>
        <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-muted">Complete · {row.ref}</p>
        <p className="mt-1 pr-10 text-[13.5px] font-semibold text-muted">{row.customerLabel || "Walk-in"} · {row.serviceName}{row.barberName ? ` · ${row.barberName}` : ""}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="pay-title" className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(onlinePaid ? row.price : cents)}</h2>
            <p className="mt-1.5 text-[13.5px] font-bold">{onlinePaid ? "Already paid online" : `Paid · ${method === "gcash" ? "GCash" : "Cash"}`}</p>
          </div>
          {onlinePaid ? null : <button type="button" onClick={() => setAdjust(!adjust)} className="text-[13px] font-bold underline decoration-grey-300 underline-offset-[3px]">{adjust ? "Use default" : "Adjust"}</button>}
        </div>
        {adjust && !onlinePaid ? (
          <div className="mt-3">
            <Input label="Amount (₱)" inputMode="decimal" value={amount} autoFocus onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
        ) : null}
        {onlinePaid ? null : <p className="mt-3 text-[12.5px] font-semibold text-muted">GCash, cash or not paid yet? Change it later in the order details.</p>}
        <Button data-auth="action" className="mt-5" fullWidth disabled={busy} onClick={confirm}>Confirm &amp; complete</Button>
      </div>
    </div>
  );
}
