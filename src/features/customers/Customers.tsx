"use client";
import { useMemo, useState } from "react";
import { ChevronRight, QrCode as QrIcon, UserPlus } from "lucide-react";
import { Avatar, Badge, Button, cn, IconTile, Input, SegmentedControl } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";
import { Dialog, SelectField, Toggle } from "@/components/common/Dialog";
import { FilterSelect, Panel, PanelHeader, Pill } from "@/components/common/ui";
import { PageHeader } from "@/components/shell/PageHeader";
import { getRepository, type Barber, type Customer, CustomerType, Membership, MembershipPlan } from "@/data";
import { peso } from "@/lib/format";
import { QueueQrDialog } from "./QueueQrDialog";

export interface CustomersData { customers: Customer[]; barbers: Barber[]; plans: MembershipPlan[]; memberships: Membership[] }
export const TYPE_LABEL: Record<CustomerType, string> = { walk_in: "Walk-in", regular: "Regular", member: "Member", vip: "VIP" };
export const SOURCE_LABEL: Record<Customer["source"], string> = { kiosk: "Kiosk", staff: "Added by staff", web: "Web", "partner:river-mobile": "River Mobile" };
const NOW = Date.now();

export function lastVisitLabel(iso?: string) {
  if (!iso) return "—";
  const days = Math.floor((NOW - Date.parse(iso)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
export function TypePill({ type }: { type: CustomerType }) {
  return <Pill tone={type === "vip" ? "solid" : type === "walk_in" ? "outline" : "soft"}>{TYPE_LABEL[type]}</Pill>;
}
export function maskPhone(p?: string) { return p ? p.replace(/(\+63 9)\d{2} \d{3}/, "$1•• •••") : "No number"; }

export function Customers({ data }: { data: CustomersData }) {
  const [customers, setCustomers] = useState(data.customers);
  const [kind, setKind] = useState<"all" | "personal" | "walk_in">("all");
  const [type, setType] = useState<"all" | CustomerType>("all");
  const [q, setQ] = useState("");
  const [qr, setQr] = useState(false);
  const [adding, setAdding] = useState(false);
  const barber = (id?: string) => data.barbers.find((b) => b.id === id);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return customers.filter((c) => (kind === "all" || c.kind === kind) && (type === "all" || c.type === type) &&
      (!s || c.name.toLowerCase().includes(s) || (c.phone ?? "").replace(/\s/g, "").includes(s.replace(/\s/g, ""))))
      .sort((a, b) => (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? ""));
  }, [customers, kind, type, q]);
  const personal = customers.filter((c) => c.kind === "personal").length;
  const members = customers.filter((c) => c.membershipId).length;
  const comeback = customers.filter((c) => c.lastVisitAt && NOW - Date.parse(c.lastVisitAt) > 30 * 86400000);
  const returning = Math.round((customers.filter((c) => c.visitCount > 1).length / customers.length) * 100);

  return (
    <>
      <PageHeader title="Customers" subtitle={`${customers.length} customers · ${personal} personal · ${customers.length - personal} walk-in records`}
        search="Search name or number" onSearch={setQ}
        actions={<Button variant="secondary" leadingIcon={<UserPlus size={18} strokeWidth={1.75} />} onClick={() => setAdding(true)}>Add customer</Button>} />

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-card bg-ink px-5 py-[18px] text-on-ink shadow-raised">
          <i aria-hidden className="pointer-events-none absolute -right-20 -top-[120px] size-[260px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0)_65%)]" />
          <div className="relative flex flex-col leading-tight"><span className="text-[12px] font-semibold text-on-ink-muted">Returning customers</span><span className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">{returning}%</span><span className="mt-1 text-[12px] font-semibold text-on-ink-muted">came back at least once</span></div>
        </div>
        <Stat label="Personal records" value={String(personal)} caption="Name + number, SMS consent tracked" icon="ticket" />
        <Stat label="Members" value={String(members)} caption={data.plans.map((p) => `${p.members} ${p.name.split(" ")[0]}`).join(" · ")} icon="gift" />
        <Stat label="Due for a comeback" value={String(comeback.length)} caption="No visit in 30+ days" icon="scissors" />
      </section>

      <div className="mt-[18px] grid gap-5 xl:grid-cols-[1fr_340px]">
        <Panel className="min-w-0 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PanelHeader title="All customers" subtitle="Personal = known contact details · Walk-in = anonymous kiosk record" />
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl label="Record kind" value={kind} onChange={setKind} options={[{ value: "all", label: "All" }, { value: "personal", label: "Personal" }, { value: "walk_in", label: "Walk-in" }]} />
              <FilterSelect<"all" | CustomerType> label="Type" value={type} onChange={setType} options={[{ value: "all", label: "All types" }, ...(["regular", "member", "vip", "walk_in"] as const).map((t) => ({ value: t, label: TYPE_LABEL[t] }))]} />
            </div>
          </div>
          <div className="-mx-1 mt-3 overflow-x-auto px-1">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead><tr className="text-[12px] text-muted">
                <th className="pb-2 pl-1 pr-3 font-semibold">Customer</th>
                {["Type", "Source", "Visits", "Spent", "Last visit", "Barber", "Perks"].map((h) => <th key={h} className={cn("whitespace-nowrap pb-2 pr-3 font-semibold", (h === "Visits" || h === "Spent") && "text-right")}>{h}</th>)}
                <th className="w-6 pb-2" />
              </tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="group border-t border-line hover:bg-grey-50">
                    <td className="py-[8px] pl-1 pr-3"><a href={`/customers/${c.id}`} className="flex items-center gap-2.5 focus-visible:outline-none">
                      <Avatar name={c.name} preset={c.avatar} size={32} />
                      <span className="flex min-w-0 flex-col leading-[1.25]"><b className="truncate text-[14px] tracking-[-0.01em] group-hover:underline">{c.name}</b><span className="whitespace-nowrap font-mono text-[11.5px] font-medium text-muted">{maskPhone(c.phone)}</span></span>
                    </a></td>
                    <td className="whitespace-nowrap py-[8px] pr-3"><TypePill type={c.type} /></td>
                    <td className="whitespace-nowrap py-[8px] pr-3 text-[12.5px] font-semibold text-ink-2">{SOURCE_LABEL[c.source]}</td>
                    <td className="whitespace-nowrap py-[8px] pr-3 text-right text-[13.5px] font-bold">{c.visitCount}</td>
                    <td className="whitespace-nowrap py-[8px] pr-3 text-right text-[14px] font-extrabold">{peso(c.totalSpent)}</td>
                    <td className="whitespace-nowrap py-[8px] pr-3 text-[13px] font-semibold text-ink-2">{lastVisitLabel(c.lastVisitAt)}</td>
                    <td className="whitespace-nowrap py-[8px] pr-3 text-[13.5px] font-bold">{barber(c.favoriteBarberId)?.nickname ?? <span className="font-semibold text-subtle">—</span>}</td>
                    <td className="whitespace-nowrap py-[8px] pr-3"><span className="flex gap-1.5">
                      {c.membershipId ? <Pill tone="solid">{data.plans.find((p) => p.id === data.memberships.find((m) => m.id === c.membershipId)?.planId)?.name.split(" ")[0]}</Pill> : null}
                      {c.discount ? <Pill>{c.discount.label}</Pill> : null}
                      {!c.membershipId && !c.discount ? <span className="text-[12.5px] font-semibold text-subtle">—</span> : null}
                    </span></td>
                    <td className="py-[8px] pr-1"><a href={`/customers/${c.id}`} aria-label={`Open ${c.name}`} className="text-subtle group-hover:text-ink"><ChevronRight size={18} strokeWidth={1.75} /></a></td>
                  </tr>
                ))}
                {!rows.length ? <tr><td colSpan={9} className="border-t border-line py-8 text-center text-[13.5px] font-semibold text-muted">No customers match.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className="flex flex-col gap-[18px]">
          <Panel className="pb-4">
            <div className="flex items-start gap-3">
              <IconTile size={48}><BarberIcon name="qr" size={34} /></IconTile>
              <PanelHeader title="Queue QR" subtitle="Customers scan to join the queue from their phone" />
            </div>
            <Button className="mt-3" fullWidth leadingIcon={<QrIcon size={18} strokeWidth={1.75} />} onClick={() => setQr(true)}>Generate queue QR</Button>
            <p className="mt-2 text-[12px] font-medium text-muted">Open a customer to make a personal QR with their details filled in.</p>
          </Panel>
          <Panel className="pb-3">
            <PanelHeader className="mb-2" title="Membership plans" subtitle="Billed at the counter" />
            <ul className="flex flex-col gap-2.5">
              {data.plans.map((p, i) => (
                <li key={p.id} className={cn("rounded-[18px] p-3.5", i === 0 ? "bg-ink text-on-ink" : "bg-grey-100")}>
                  <div className="flex items-baseline justify-between"><b className="text-[15px]">{p.name}</b><span className="text-[13px] font-bold">{peso(p.price)}<span className={cn("font-semibold", i === 0 ? "text-on-ink-muted" : "text-muted")}>/{p.period === "monthly" ? "mo" : "yr"}</span></span></div>
                  <p className={cn("mt-1 text-[12.5px] font-medium", i === 0 ? "text-on-ink-muted" : "text-muted")}>{p.benefits.join(" · ")}</p>
                  <Badge variant={i === 0 ? "on-ink" : "solid"} className="mt-2">{p.members} members</Badge>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="pb-3">
            <PanelHeader className="mb-1" title="Due for a comeback" subtitle="Send the BALIK50 voucher" />
            <ul>{comeback.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-[7px]"><Avatar name={c.name} preset={c.avatar} size={34} />
                <a href={`/customers/${c.id}`} className="flex min-w-0 flex-1 flex-col leading-[1.3]"><b className="truncate text-[14px]">{c.name}</b><span className="text-[12.5px] font-medium text-muted">{lastVisitLabel(c.lastVisitAt)} · {c.visitCount} visits</span></a>
                <Button size="xs" variant="secondary" href="/messages">Text</Button></li>
            ))}</ul>
          </Panel>
        </aside>
      </div>

      <QueueQrDialog open={qr} onClose={() => setQr(false)} />
      <AddCustomerDialog open={adding} onClose={() => setAdding(false)} barbers={data.barbers}
        onAdd={(c) => { setCustomers((all) => [c, ...all]); setAdding(false); void getRepository().saveCustomer(c).catch(() => undefined); }} />
    </>
  );
}

function Stat({ label, value, caption, icon }: { label: string; value: string; caption: string; icon: "ticket" | "gift" | "scissors" }) {
  return (
    <div className="flex items-start justify-between rounded-card bg-surface px-5 py-[18px] shadow-card">
      <div className="flex min-w-0 flex-col leading-tight"><span className="text-[12px] font-semibold text-muted">{label}</span><span className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">{value}</span><span className="mt-1 truncate text-[12px] font-semibold text-muted">{caption}</span></div>
      <IconTile size={40} style={{ borderRadius: 12 }}><BarberIcon name={icon} size={28} /></IconTile>
    </div>
  );
}

function AddCustomerDialog({ open, onClose, onAdd, barbers }: { open: boolean; onClose: () => void; onAdd: (c: Customer) => void; barbers: Barber[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fav, setFav] = useState("none");
  const [sms, setSms] = useState(true);
  return (
    <Dialog open={open} onClose={onClose} title="Add customer" subtitle="Creates a personal record. Walk-ins from the kiosk are added automatically."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!name.trim()} onClick={() => {
        onAdd({ id: `cu-new-${Date.now()}`, name: name.trim(), avatar: "peach", phone: phone.trim() || undefined, type: "regular", kind: "personal", source: "staff",
          consent: { sms: sms && !!phone.trim(), marketing: false }, visitCount: 0, totalSpent: 0, favoriteBarberId: fav === "none" ? undefined : fav });
        setName(""); setPhone("");
      }}>Save customer</Button></>}>
      <div className="flex flex-col gap-4">
        <Input size="md" label="Full name" placeholder="Juan dela Cruz" value={name} onChange={(e) => setName(e.target.value)} />
        <Input size="md" label="Mobile number" placeholder="+63 917 555 0100" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <SelectField label="Favourite barber" value={fav} onChange={setFav} options={[{ value: "none", label: "No preference" }, ...barbers.map((b) => ({ value: b.id, label: b.name }))]} />
        <div className="flex items-center justify-between rounded-tile bg-grey-100 px-4 py-3"><span className="text-[13.5px] font-bold">OK to receive queue texts (SMS)</span><Toggle label="SMS consent" checked={sms} onChange={setSms} /></div>
      </div>
    </Dialog>
  );
}
