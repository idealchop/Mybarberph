"use client";
import { completeCut } from "@/components/transactions/CompleteFlow";

import { Input, Topbar } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { useSearchParams } from "next/navigation";
import { PageBack } from "@/components/shell/PageBack";
import { useState } from "react";
import { peso } from "@/lib/format";
import { api, refreshCloud } from "@/lib/cloud";
import { QrScanner } from "@/components/scan/QrScanner";
import { parseTicketCode } from "@/lib/ticket-code";
import { markInChair, setRequestStatus, statusLabel, useChairRequests } from "@/lib/chair-bookings";

/** Partner Scan: find a ticket by its code (BK-…) and mark the visit verified on the server. */
export function FindTicket() {
  const initial = useSearchParams().get("code") ?? "";
  const [code, setCode] = useState(initial);
  const [query, setQuery] = useState(initial.trim().toLowerCase());
  const [note, setNote] = useState("");
  const { rows } = useChairRequests();
  const match = query
    ? rows.find((row) => row.ref.toLowerCase() === query || row.ref.toLowerCase().includes(query) || row.customerLabel.toLowerCase().includes(query))
    : undefined;

  function find(raw: string) {
    const value = raw.trim();
    setCode(value);
    setQuery(value.toLowerCase());
    setNote("");
    if (/^BK-[A-Z0-9]{6}$/i.test(value)) {
      void api("/api/shop/verify", { method: "POST", body: JSON.stringify({ code: value.toUpperCase() }) })
        .then((r) => { if (r.ok) void refreshCloud(); })
        .catch(() => undefined);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[440px] px-4 pb-10 pt-6">
      <Topbar className="px-0" leading={<PageBack fallback="/home" />} title="Scan QR" subtitle="Point the camera at the QR on the customer’s ticket." />
      <QrScanner className="mt-4" paused={Boolean(match)} onResult={(text) => find(parseTicketCode(text))} />
      {match ? <Button className="mt-2" size="sm" variant="secondary" fullWidth onClick={() => { setQuery(""); setCode(""); setNote(""); }}>Scan another</Button> : null}
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); find(code); }}>
        <p className="mb-2 px-1 text-[12.5px] font-semibold text-muted">Or type the code</p>
        <Input label="Ticket" placeholder="BK-7K2Q9M" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button data-auth="action" className="mt-3" type="submit" fullWidth>Find</Button>
      </form>
      {query && !match ? <p className="mt-4 text-[14px] font-semibold">No ticket matches {code.trim()}.</p> : null}
      {match ? (
        <article className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
          <b className="block text-[18px]">{match.customerLabel || match.contact}</b>
          <p className="mt-1 text-[14px] font-medium text-muted">{match.serviceName} · {match.ref}</p>
          <p className="mt-1 text-[14px] font-semibold">{peso(match.price)} · {statusLabel(match.status)}{match.chairLabel ? ` · ${match.chairLabel}` : ""}{match.verifiedAt ? " · Verified" : ""}</p>
          <div className="mt-4 flex gap-2">
            {match.status === "requested" || match.status === "accepted" ? (
              <>
                <Button size="sm" variant="secondary" className="flex-1" data-auth="action" onClick={() => setRequestStatus(match.id, "declined")}>Decline</Button>
                <Button size="sm" className="flex-1" data-auth="action" onClick={() => setNote(markInChair(match.id) ? "" : "Every chair is taken, or none have been added in Services yet.")}>Accept</Button>
              </>
            ) : null}
            {match.status === "in_chair" ? <Button size="sm" fullWidth data-auth="action" onClick={() => completeCut(match)}>Done</Button> : null}
          </div>
          {note ? <p className="mt-3 text-[13.5px] font-semibold">{note}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
