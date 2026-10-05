"use client";
import { useMemo, useState } from "react";
import { ArrowRight, Check, MessageSquare, Plus, ScanLine, Smartphone, X } from "lucide-react";
import { Avatar, Badge, Button, cn, EmptyState, IconTile, Input, ResourceCard, SegmentedControl } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";
import { Dialog, SelectField } from "@/components/common/Dialog";
import { CodeChip, Panel, PanelHeader, Ref, StatusPill, TextLink } from "@/components/common/ui";
import { PageHeader } from "@/components/shell/PageHeader";
import { getRepository, type Barber, type Chair, type IncomingBooking, type Service, type Ticket, type WaitlistEntry } from "@/data";
import { ScanVerify } from "@/features/scan/ScanVerify";
import { avgWaitMins, clock, clockShort, firstName, peso, shortName, shortService } from "@/lib/format";

export interface QueueData { tickets: Ticket[]; chairs: Chair[]; barbers: Barber[]; services: Service[]; incoming: IncomingBooking[]; waitlist: WaitlistEntry[] }
type Filter = "all" | "waiting" | "in_chair" | "done";

const isDone = (t: Ticket) => t.status === "completed" || t.status === "paid" || t.status === "awaiting_confirmation";
const NOW = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
  .format(new Date())
  .replace(" ", "T") + "+08:00";


function manilaLabel() {
  const d = new Date();
  const day = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(d);
  return { day, time };
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function Queue({ data }: { data: QueueData }) {
  const [tickets, setTickets] = useState(data.tickets);
  const [chairs, setChairs] = useState(data.chairs);
  const [incoming, setIncoming] = useState(data.incoming);
  const [waitlist, setWaitlist] = useState(data.waitlist);
  const [queued, setQueued] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [walkIn, setWalkIn] = useState(false);
  const [scanFor, setScanFor] = useState<IncomingBooking | null>(null);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const barber = (id?: string) => data.barbers.find((b) => b.id === id);
  const chair = (id?: string) => chairs.find((c) => c.id === id);

  const inChair = tickets.filter((t) => t.status === "in_service");
  const waiting = tickets.filter((t) => t.status === "waiting")
    .sort((a, b) => Number(!!b.nextUp) - Number(!!a.nextUp) || (a.estimatedWaitMins ?? 0) - (b.estimatedWaitMins ?? 0));
  const done = tickets.filter(isDone).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const avgWait = avgWaitMins(waiting.map((t) => t.estimatedWaitMins ?? 0));
  const rows = useMemo(() => {
    const base = filter === "waiting" ? waiting : filter === "in_chair" ? inChair : filter === "done" ? done : [...inChair, ...waiting, ...done];
    const s = q.trim().toLowerCase();
    return s ? base.filter((t) => t.customerName.toLowerCase().includes(s) || t.referenceId.toLowerCase().includes(s)) : base;
  }, [filter, waiting, inChair, done, q]);

  /* ---- queue actions (optimistic UI + Firestore via repository) ---- */
  function startInChair(t: Ticket, c: Chair) {
    setTickets((all) => {
      const next = all.map((x) => x.id === t.id ? { ...x, status: "in_service" as const, chairId: c.id, barberId: x.barberId ?? c.barberId, startedAt: NOW, progressPct: 5, minsLeft: 30, nextUp: false } : x);
      const rest = next.filter((x) => x.status === "waiting").sort((a, b) => (a.estimatedWaitMins ?? 0) - (b.estimatedWaitMins ?? 0));
      return next.map((x) => ({ ...x, nextUp: x.status === "waiting" && x.id === rest[0]?.id }));
    });
    setChairs((all) => all.map((x) => x.id === c.id ? { ...x, status: "occupied", currentTicketId: t.id } : x));
    void getRepository().startTicket(t.id, c.id).catch(() => undefined);
    setSelected(null);
  }
  function markDone(t: Ticket) {
    setTickets((all) => all.map((x) => x.id === t.id ? { ...x, status: "awaiting_confirmation", completedAt: NOW, progressPct: 100 } : x));
    setChairs((all) => all.map((x) => x.currentTicketId === t.id ? { ...x, status: "free", currentTicketId: undefined } : x));
    void getRepository().finishTicket(t.id).catch(() => undefined);
    setSelected(null);
  }
  function cancel(t: Ticket) {
    setTickets((all) => all.map((x) => x.id === t.id ? { ...x, status: "cancelled", nextUp: false } : x));
    
    setSelected(null);
  }
  async function addWalkIn(input: { customerName: string; serviceId: string; barberId?: string }) {
    const t = await getRepository().addWalkIn(input);
    setTickets((all) => all.some((x) => x.id === t.id) ? all : [...all, t]);
    setWalkIn(false);
    setFilter("all");
  }
  function acceptBooking(b: IncomingBooking) {
    if (b.status === "verified") {
      const t: Ticket = {
        id: `t-${b.id}`, referenceId: b.referenceId.replace(/^RM-48/, "RM-4"), kind: "appointment", source: "partner", status: "waiting", queueNumber: 0,
        customerName: b.customerName, customerAvatar: b.avatar, barberId: b.barberId, requestedBarberId: b.barberId, serviceIds: [],
        serviceLabel: shortService(b.serviceLabel), createdAt: NOW, estimatedWaitMins: 12,
      };
      setTickets((all) => [...all, t]);
      setQueued((s) => new Set(s).add(b.id));
    } else {
      setIncoming((all) => all.map((x) => x.id === b.id ? { ...x, status: "accepted" } : x));
      void getRepository().acceptBooking(b.id).catch(() => undefined);
    }
  }
  function decline(b: IncomingBooking) {
    setIncoming((all) => all.map((x) => x.id === b.id ? { ...x, status: "declined" } : x));
    void getRepository().declineBooking(b.id).catch(() => undefined);
  }

  const featured = incoming.find((b) => (b.status === "here" || b.status === "verified") && !queued.has(b.id)) ?? incoming.find((b) => b.status === "pending");
  const schedule = incoming.filter((b) => b.status !== "declined" && b.arrivingAt.startsWith(todayKey()));
  const freeChairs = chairs.filter((c) => c.status === "free");
  const nextUp = waiting[0];

  return (
    <>
      <PageHeader title="Queue & schedule" subtitle={`${manilaLabel().day} · ${chairs.length} chairs · ${waiting.length} waiting · avg wait ${avgWait} min`}
        search="Search ticket or name" searchWidth={260} onSearch={setQ}
        actions={<Button variant="secondary" leadingIcon={<Plus size={18} strokeWidth={1.75} />} onClick={() => setWalkIn(true)}>Add walk-in</Button>} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_372px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          {/* chairs */}
          <section aria-label="Chairs" className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {chairs.map((c) => {
              const t = tickets.find((x) => x.id === c.currentTicketId && x.status === "in_service");
              const b = barber(c.barberId);
              if (!t) {
                return (
                  <ResourceCard key={c.id} density="comfortable" variant="inverse"
                    icon={<IconTile size={52} style={{ borderRadius: 16 }} className="bg-[#1C1C1F]"><BarberIcon name={c.art} size={38} /></IconTile>}
                    action={nextUp ? <Button variant="white" size="sm" className="h-[34px] px-3.5 text-[12.5px]" trailingIcon={<ArrowRight size={15} strokeWidth={2.2} />} onClick={() => startInChair(nextUp, c)}>Assign</Button> : undefined}
                    eyebrow={<>{c.label} · <b className="text-on-ink">Free</b></>}
                    title={nextUp ? `Next: ${nextUp.referenceId}` : "No one waiting"}
                    meta={nextUp ? `${shortName(nextUp.customerName)} · ${shortService(nextUp.serviceLabel).replace("Skin fade", "Fade")}` : b ? `${b.nickname} is free` : undefined} />
                );
              }
              return (
                <button key={c.id} type="button" className="rounded-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink" onClick={() => setSelected(t)} aria-label={`${c.label}: ${t.serviceLabel} for ${t.customerName}, ${t.minsLeft} minutes left`}>
                  <ResourceCard density="comfortable" className="h-full"
                    icon={<IconTile size={52} style={{ borderRadius: 16 }}><BarberIcon name={c.art} size={36} /></IconTile>}
                    progress={{ value: t.progressPct ?? 0, label: `${t.minsLeft ?? 0}m`, ariaLabel: `${t.progressPct}% done` }}
                    eyebrow={`${c.label} · ${b ? firstName(b.name) : "—"}`} title={t.serviceLabel}
                    meta={`${t.referenceId} · ${shortName(t.customerName)}`} />
                </button>
              );
            })}
          </section>

          {/* live queue */}
          <Panel className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <PanelHeader title="Live queue" subtitle="By ticket number · updated just now" />
              <SegmentedControl<Filter> label="Filter queue" value={filter} onChange={setFilter} options={[
                { value: "all", label: `All ${inChair.length + waiting.length + done.length}` }, { value: "waiting", label: `Waiting ${waiting.length}` },
                { value: "in_chair", label: `In chair ${inChair.length}` }, { value: "done", label: `Done ${done.length}` }]} />
            </div>
            <div className="-mx-1 mt-3 overflow-x-auto px-1">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead><tr className="text-[12px] font-semibold text-muted">
                  {["Ticket", "Customer", "Service", "Barber / Chair", "Source", "Wait / time"].map((h, i) => <th key={h} className={cn("whitespace-nowrap pb-2 pr-3 font-semibold", i === 0 && "pl-1")}>{h}</th>)}
                  <th className="whitespace-nowrap pb-2 pr-1 text-right font-semibold">Status</th>
                </tr></thead>
                <tbody>
                  {rows.map((t) => {
                    const b = barber(t.barberId);
                    return (
                      <tr key={t.id} onClick={() => setSelected(t)} className={cn("cursor-pointer border-t border-line hover:bg-grey-50", isDone(t) && "opacity-60")}>
                        <td className="whitespace-nowrap py-[9px] pl-1 pr-3"><Ref>{t.referenceId}</Ref></td>
                        <td className="whitespace-nowrap py-[9px] pr-3"><span className="flex items-center gap-2.5"><Avatar name={t.customerName} preset={t.customerAvatar} size={30} /><b className="truncate text-[14px] tracking-[-0.01em]">{t.customerName}</b></span></td>
                        <td className="whitespace-nowrap py-[9px] pr-3 text-[13.5px] font-semibold">{t.serviceLabel}</td>
                        <td className="whitespace-nowrap py-[9px] pr-3"><span className="flex flex-col leading-[1.25]"><b className="text-[13.5px]">{b ? b.nickname : "Any barber"}</b><span className="text-[12px] font-semibold text-muted">{chair(t.chairId)?.label ?? "—"}</span></span></td>
                        <td className="whitespace-nowrap py-[9px] pr-3">{t.source === "partner"
                          ? <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-2"><Smartphone size={14} strokeWidth={1.75} />River Mobile</span>
                          : <span className="text-[12.5px] font-semibold text-muted">Walk-in</span>}</td>
                        <td className="whitespace-nowrap py-[9px] pr-3 text-[13px] font-semibold text-ink-2">
                          {t.status === "in_service" ? `Since ${clockShort(t.startedAt ?? NOW)}` : isDone(t) ? `Done ${clockShort(t.completedAt ?? NOW)}` : `${t.estimatedWaitMins ?? 0} min`}
                        </td>
                        <td className="whitespace-nowrap py-[9px] pr-1 text-right"><StatusPill status={t.status} nextUp={t.nextUp} /></td>
                      </tr>
                    );
                  })}
                  {!rows.length ? <tr><td colSpan={7} className="border-t border-line py-8 text-center text-[13.5px] font-semibold text-muted">No tickets match.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <aside className="flex flex-col gap-[18px]">
          {/* River Mobile booking */}
          <Panel className="p-4">
            {featured ? (
              <BookingCard b={featured} barber={barber(featured.barberId)} chairLabel={chair(barber(featured.barberId)?.defaultChairId)?.label}
                onScan={() => setScanFor(featured)} onAccept={() => acceptBooking(featured)} onDecline={() => decline(featured)} />
            ) : (
              <EmptyState className="py-4" illustration={<BarberIcon name="qr" size={64} />} title="No new bookings" description="River Mobile bookings show up here as they arrive." />
            )}
          </Panel>

          {/* Waitlist */}
          <Panel className="pb-2">
            <PanelHeader className="mb-1" title="Waitlist" subtitle="We text them when a chair frees up" action={<Badge variant="soft">{waitlist.length}</Badge>} />
            <ul>
              {waitlist.map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-[7px]">
                  <Avatar name={w.name} preset={w.avatar} size={34} />
                  <div className="flex min-w-0 flex-1 flex-col leading-[1.3]"><b className="truncate text-[14px]">{w.name}</b><span className="truncate text-[12.5px] font-medium text-muted">{w.wants}</span></div>
                  {w.texted ? <Badge variant="soft">Texted</Badge> : (
                    <Button size="xs" variant="secondary" leadingIcon={<MessageSquare size={14} strokeWidth={1.75} />}
                      onClick={() => { setWaitlist((all) => all.map((x) => x.id === w.id ? { ...x, texted: true } : x)); void getRepository().textWaitlist(w.id).catch(() => undefined); }}>Text</Button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          {/* Online schedule */}
          <Panel>
            <PanelHeader className="mb-1.5" title="Online schedule" subtitle="River Mobile · rest of today" action={<TextLink href="/partner/incoming">Calendar</TextLink>} />
            <ul className="flex flex-col">
              {schedule.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-[5px]">
                  <span className="w-[66px] font-mono text-[12.5px] font-semibold">{clock(b.arrivingAt)}</span>
                  <span className="flex-1 truncate text-[13.5px] font-bold">{shortName(b.customerName)} · {shortService(b.serviceLabel)}</span>
                  <span className="text-[12px] font-semibold text-muted">{b.status === "here" ? "To verify" : b.status === "verified" ? "Checked in" : b.status === "pending" ? "New" : "Verified"}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>

      <WalkInDialog open={walkIn} onClose={() => setWalkIn(false)} barbers={data.barbers} services={data.services} onSubmit={addWalkIn} />

      <Dialog open={!!scanFor} onClose={() => setScanFor(null)} title="Scan to verify" subtitle={scanFor ? `${scanFor.customerName} · ${scanFor.referenceId}` : undefined}>
        <ScanVerify barberLabel={(id) => barber(id)?.nickname}
          onVerified={(b) => setIncoming((all) => all.map((x) => x.id === b.id ? { ...x, status: "verified" } : x))}
          onDone={() => setScanFor(null)} />
      </Dialog>

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.referenceId} · ${selected.customerName}` : ""}
        subtitle={selected ? `${selected.serviceLabel} · ${barber(selected.barberId)?.nickname ?? "Any barber"}${selected.source === "partner" ? " · River Mobile" : ""}` : undefined}>
        {selected ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2"><StatusPill status={selected.status} nextUp={selected.nextUp} />
              <span className="text-[13px] font-semibold text-muted">{selected.status === "in_service" ? `${chair(selected.chairId)?.label} · ${selected.minsLeft} min left` : selected.status === "waiting" ? `About ${selected.estimatedWaitMins} min wait` : selected.completedAt ? `Finished ${clock(selected.completedAt)}` : ""}</span></div>
            {selected.status === "waiting" ? (
              <>
                <p className="text-[13.5px] font-bold">Start in a free chair</p>
                {freeChairs.length ? <div className="flex flex-wrap gap-2">{freeChairs.map((c) => <Button key={c.id} onClick={() => startInChair(selected, c)} leadingIcon={<BarberIcon name={c.art} size={22} />}>{c.label} · {barber(c.barberId)?.nickname}</Button>)}</div>
                  : <p className="text-[13px] font-medium text-muted">All chairs are busy. They’ll get a “You’re next” text when one frees up.</p>}
                <div className="flex gap-2 border-t border-line pt-3">
                  <Button variant="secondary" size="sm" leadingIcon={<MessageSquare size={15} strokeWidth={1.75} />}>Text “You’re next”</Button>
                  <Button variant="ghost" size="sm" leadingIcon={<X size={15} strokeWidth={1.75} />} onClick={() => cancel(selected)}>Remove from queue</Button>
                </div>
              </>
            ) : selected.status === "in_service" ? (
              <Button fullWidth leadingIcon={<Check size={18} strokeWidth={1.75} />} onClick={() => markDone(selected)}>Mark haircut done</Button>
            ) : (
              <Button variant="secondary" fullWidth href="/sales">Open in sales record</Button>
            )}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

function BookingCard({ b, barber, chairLabel, onScan, onAccept, onDecline }: {
  b: IncomingBooking; barber?: Barber; chairLabel?: string; onScan: () => void; onAccept: () => void; onDecline: () => void;
}) {
  const verified = b.status === "verified";
  const future = b.status === "pending";
  const steps = future ? ["Accept to confirm the booking", "Scan their code when they arrive"] : ["Scan their River Mobile code to verify", "Accept to add them to the queue"];
  const active = future ? 0 : verified ? 1 : 0;
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"><i aria-hidden className="block size-[7px] rounded-full bg-ink" />{verified ? "Verified · River Mobile booking" : "New · River Mobile booking"}</span>
        <span className="text-[12px] font-semibold text-muted">{b.receivedAgo}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={b.customerName} preset={b.avatar} size={48} />
        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]"><b className="text-[16px] tracking-[-0.01em]">{b.customerName}</b><span className="truncate text-[13px] font-medium text-muted">{b.serviceLabel} · {peso(b.price)}</span></span>
        <CodeChip className="px-2.5 py-1.5 text-[12.5px]">{b.referenceId}</CodeChip>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-0.5 rounded-[18px] bg-grey-100 p-3"><small className="text-[12px] font-semibold text-muted">Arriving</small><b className="text-[14.5px] tracking-[-0.01em]">{b.arrivingLabel}</b></div>
        <div className="flex flex-col gap-0.5 rounded-[18px] bg-grey-100 p-3"><small className="text-[12px] font-semibold text-muted">Barber</small><b className="text-[14.5px] tracking-[-0.01em]">{barber ? `${barber.nickname} · ${chairLabel}` : "Any barber"}</b></div>
      </div>
      <ol className="mt-3 flex flex-col gap-1.5 text-[13px] font-semibold">
        {steps.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2", i > active && "text-muted")}>
            <span className={cn("inline-flex size-5 items-center justify-center rounded-full text-[11px] font-extrabold", i < active ? "bg-ink text-on-ink" : i === active ? "bg-ink text-on-ink" : "bg-grey-200 text-ink")}>
              {i < active ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>{s}
          </li>
        ))}
      </ol>
      {future ? (
        <Button className="mt-3.5" fullWidth leadingIcon={<Check size={18} strokeWidth={1.75} />} onClick={onAccept}>Accept booking</Button>
      ) : verified ? (
        <Button className="mt-3.5" fullWidth leadingIcon={<Plus size={18} strokeWidth={1.75} />} onClick={onAccept}>Accept & add to queue</Button>
      ) : (
        <Button className="mt-3.5" fullWidth leadingIcon={<ScanLine size={18} strokeWidth={1.75} />} onClick={onScan}>Scan to verify</Button>
      )}
      <div className="mt-2 flex gap-2">
        {future || verified ? null : <Button size="sm" variant="secondary" className="flex-1" disabled leadingIcon={<Check size={16} strokeWidth={1.75} />}>Accept</Button>}
        <Button size="sm" variant="ghost" className="flex-1" leadingIcon={<X size={16} strokeWidth={1.75} />} onClick={onDecline}>Decline</Button>
      </div>
    </>
  );
}

function WalkInDialog({ open, onClose, barbers, services, onSubmit }: {
  open: boolean; onClose: () => void; barbers: Barber[]; services: Service[]; onSubmit: (v: { customerName: string; serviceId: string; barberId?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("sv-skin-fade");
  const [barberId, setBarberId] = useState("any");
  const svc = services.filter((s) => s.active && s.category !== "addon");
  return (
    <Dialog open={open} onClose={onClose} title="Add walk-in" subtitle="Gets the next ticket number and an “On queue” text if they share a number."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => { onSubmit({ customerName: name.trim(), serviceId, barberId: barberId === "any" ? undefined : barberId }); setName(""); }}>Add to queue</Button></>}>
      <div className="flex flex-col gap-4">
        <Input size="md" label="Customer name (optional)" placeholder="Walk-in" value={name} onChange={(e) => setName(e.target.value)} />
        <SelectField label="Service" value={serviceId} onChange={setServiceId} options={svc.map((s) => ({ value: s.id, label: `${s.name} · ${peso(s.price)}` }))} />
        <SelectField label="Barber" value={barberId} onChange={setBarberId} options={[{ value: "any", label: "Any barber (first free chair)" }, ...barbers.map((b) => ({ value: b.id, label: b.name }))]} />
      </div>
    </Dialog>
  );
}
