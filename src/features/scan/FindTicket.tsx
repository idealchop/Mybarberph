"use client";

import { Button, Input, Topbar } from "@river-apps/ui";
import { useSearchParams } from "next/navigation";
import { PageBack } from "@/components/shell/PageBack";
import { useState } from "react";
import { peso } from "@/lib/format";
import { markDone, markInChair, setRequestStatus, statusLabel, useChairRequests } from "@/lib/chair-bookings";

/** Looks up a ticket by its reference, the same job as Scan QR on home. */
export function FindTicket() {
  const initial = useSearchParams().get("code") ?? "";
  const [code, setCode] = useState(initial);
  const [query, setQuery] = useState(initial.trim().toLowerCase());
  const [note, setNote] = useState("");
  const { rows } = useChairRequests();
  const match = query
    ? rows.find((row) => row.ref.toLowerCase() === query || row.ref.toLowerCase().includes(query) || row.customerLabel.toLowerCase().includes(query))
    : undefined;

  return (
    <div className="mx-auto w-full max-w-[440px] px-4 pb-10 pt-6">
      <Topbar className="px-0" leading={<PageBack fallback="/home" />} title="Scan QR" subtitle="Type a ticket reference from the queue." />
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); setQuery(code.trim().toLowerCase()); setNote(""); }}>
        <Input label="Ticket" placeholder="A-031" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button className="mt-3" type="submit" fullWidth>Find</Button>
      </form>
      {query && !match ? <p className="mt-4 text-[14px] font-semibold">No ticket matches {code.trim()}.</p> : null}
      {match ? (
        <article className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
          <b className="block text-[18px]">{match.customerLabel || match.contact}</b>
          <p className="mt-1 text-[14px] font-medium text-muted">{match.serviceName} · {match.ref}</p>
          <p className="mt-1 text-[14px] font-semibold">{peso(match.price)} · {statusLabel(match.status)}{match.chairLabel ? ` · ${match.chairLabel}` : ""}</p>
          <div className="mt-4 flex gap-2">
            {match.status === "requested" || match.status === "accepted" ? (
              <>
                <Button size="sm" variant="secondary" className="flex-1" data-auth="action" onClick={() => setRequestStatus(match.id, "declined")}>Decline</Button>
                <Button size="sm" className="flex-1" data-auth="action" onClick={() => setNote(markInChair(match.id) ? "" : "Every chair is taken, or none have been added in Services yet.")}>Accept</Button>
              </>
            ) : null}
            {match.status === "in_chair" ? <Button size="sm" fullWidth data-auth="action" onClick={() => markDone(match.id)}>Done</Button> : null}
          </div>
          {note ? <p className="mt-3 text-[13.5px] font-semibold">{note}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
