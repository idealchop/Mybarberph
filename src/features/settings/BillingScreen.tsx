"use client";

import { Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Topbar } from "@river-apps/ui";
import { PageBack } from "@/components/shell/PageBack";
import { api, refreshCloud, useCloud } from "@/lib/cloud";
import { PLANS, normalizePlan, type PlanId } from "@/lib/plans";
import { useTier } from "@/lib/tier";

/** Plans come from the shop record. Paid plans go through PayMongo checkout; the plan changes only after payment. */
export function BillingScreen() {
  const { plan: rawPlan } = useTier();
  const plan = normalizePlan(rawPlan);
  const cloud = useCloud();
  const params = useSearchParams();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState<PlanId | null>(null);
  const status = params.get("status");
  const [note, setNote] = useState(status === "success" ? "Payment received. Your plan updates as soon as PayMongo confirms it." : status === "cancel" ? "Checkout was cancelled. Nothing was charged." : "");

  useEffect(() => {
    fetch("/api/billing/status").then((r) => r.json()).then((d) => setConfigured(Boolean(d.paymongo))).catch(() => setConfigured(false));
  }, []);
  useEffect(() => { if (status === "success") void refreshCloud(); }, [status]);

  async function checkout(id: PlanId) {
    setBusy(id);
    setNote("");
    try {
      const d = await api("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: id }) });
      window.location.assign(d.checkoutUrl);
    } catch (e) {
      setNote((e as Error).message);
      setBusy(null);
    }
  }

  const renews = plan === "pro_499" && cloud.shop?.planRenewsAt
    ? new Date(cloud.shop.planRenewsAt).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[960px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" leading={<PageBack fallback="/settings" />} title="Plan & billing" subtitle="Partner is where every shop starts. Pro and Lifetime add every feature." />
      {toast ? <p role="status" className="fixed inset-x-0 bottom-24 z-[90] mx-auto w-fit rounded-pill bg-ink px-4 py-2 text-[13px] font-bold text-on-ink shadow-card">{toast}</p> : null}
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {PLANS.map((p) => {
          const on = plan === p.id;
          return (
            <Card key={p.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <b className="text-[16px]">{p.title}</b>
                  <p className="mt-1 text-[14px] font-medium text-ink-2">{p.detail}</p>
                </div>
                <span className="flex flex-col items-end whitespace-nowrap">{p.wasPrice ? <s className="text-[13px] font-semibold text-muted" aria-label={`Was ${p.wasPrice}`}>{p.wasPrice}</s> : null}<b className="text-[15px]">{p.id === "partner" ? "" : p.price}</b></span>
              </div>
              {on ? (
                <Button className="mt-3" size="sm" variant="secondary" leadingIcon={<Check size={16} />} disabled>
                  {p.id === "pro_499" && renews ? `Current · renews ${renews}` : "Current plan"}
                </Button>
              ) : p.amountCentavos > 0 ? (
                <Button data-auth="action" className="mt-3" size="sm" disabled={busy !== null} onClick={() => { if (!configured) { setToast("Coming soon"); window.setTimeout(() => setToast(""), 1800); return; } void checkout(p.id); }}>
                  {busy === p.id ? "Opening checkout…" : `Get ${p.title}`}
                </Button>
              ) : null}
            </Card>
          );
        })}
      </div>
      {note ? <p className="mt-4 rounded-[18px] bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">{note}</p> : null}
    </div>
  );
}
