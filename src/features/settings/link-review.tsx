"use client";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/common/button";
import { chairBarberName, confirmChairLink, LINK_REVIEW_MONTHS, linkReviewDue, useShopChairs } from "@/lib/shop-chairs";

/**
 * Six-monthly nudge: "Keep Keith’s link active?" with one Confirm tap. Barber links never expire, so ignoring this
 * changes nothing; Confirm only moves the next review 6 months on. Reset / deactivate stay on the barber page.
 */
export function LinkReviewList({ chairIds, heading = false, className }: { chairIds?: string[]; heading?: boolean; className?: string }) {
  const { chairs } = useShopChairs({ all: true });
  const [now] = useState(() => Date.now());
  const due = chairs.filter((c) => linkReviewDue(c, now) && (!chairIds || chairIds.includes(c.id)));
  if (!due.length) return null;
  return (
    <section className={className} aria-label="Barber links to review">
      {heading ? (
        <p className="flex items-center gap-1.5 px-1 text-[12.5px] font-extrabold text-muted">
          <Link2 size={14} strokeWidth={2.4} aria-hidden />Barber links to review · {due.length}
        </p>
      ) : null}
      <ul className={heading ? "mt-2 grid gap-2" : "grid gap-2"}>
        {due.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-card bg-surface px-3.5 py-3 shadow-card">
            <span className="min-w-0 flex-1">
              <b className="block text-[14.5px]">Keep {chairBarberName(c)}’s link active?</b>
              <small className="block text-[12.5px] font-semibold text-muted">It keeps working either way. We ask every {LINK_REVIEW_MONTHS} months.</small>
            </span>
            <Button data-auth="action" size="sm" onClick={() => confirmChairLink(c.id)} aria-label={`Confirm ${chairBarberName(c)}’s link`}>Confirm</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
