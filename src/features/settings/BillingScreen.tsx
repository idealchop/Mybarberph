"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button, Card, Topbar } from "@river-apps/ui";
import { PageBack } from "@/components/shell/PageBack";
import { useTier } from "@/lib/tier";

const PLANS = [
  { id: "partner" as const, title: "Partner", price: "FREE", detail: "Online bookings, the queue and community.", tier: "partner" as const },
  { id: "paid" as const, title: "Paid", price: "₱499/mo", detail: "Everything in Partner, plus walk-ins and the shop QR.", tier: "paid" as const },
  { id: "lifetime" as const, title: "Lifetime unlock", price: "₱10,000", detail: "Pay once. Same features as Paid.", tier: "paid" as const },
];

/** Plan choices. Choosing one updates the shop on this device. */
export function BillingScreen() {
  const { tier, setTier } = useTier();
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState(tier === "paid" ? "paid" : "partner");

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[960px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" leading={<PageBack fallback="/settings" />} title="Plan & billing" subtitle="Partner is free. Paid adds walk-ins and the shop QR." />
      <div className="mt-5 grid gap-3">
        {PLANS.map((plan) => {
          const on = picked === plan.id;
          return (
            <Card key={plan.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <b className="text-[16px]">{plan.title}</b>
                  <p className="mt-1 text-[14px] font-medium text-ink-2">{plan.detail}</p>
                </div>
                <b className="text-[15px]">{plan.price}</b>
              </div>
              <Button
                className="mt-3"
                size="sm"
                variant={on ? "secondary" : "primary"}
                leadingIcon={on ? <Check size={16} /> : undefined}
                onClick={() => {
                  setPicked(plan.id);
                  setTier(plan.tier);
                  setNote(plan.tier === "paid" ? `${plan.title} is on for this shop.` : "Switched to Partner. Walk-ins and the shop QR are locked.");
                }}
              >
                {on ? "Current plan" : "Choose"}
              </Button>
            </Card>
          );
        })}
      </div>
      {note ? <p className="mt-4 rounded-[18px] bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">{note}</p> : null}
    </div>
  );
}
