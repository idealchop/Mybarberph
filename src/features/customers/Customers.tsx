"use client";
import { useMemo, useState } from "react";
import { Plus, QrCode as QrIcon, X } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, ListItem, SearchInput, Topbar } from "@river-apps/ui";
import { Dialog, SelectField, Toggle } from "@/components/common/Dialog";
import { Input } from "@river-apps/ui";
import { Pill } from "@/components/common/ui";
import { PageColumn } from "@/components/shell/PageColumn";
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

function typeTag(c: Customer): string {
  if (c.type === "member" || c.membershipId) return "Member";
  if (c.type === "vip") return "VIP";
  if (c.type === "walk_in" || c.kind === "walk_in") return "New";
  return "Regular";
}

/** Laundry.ph CustomersScreen layout: centered column, search, one card list. */
export function Customers({ data }: { data: CustomersData }) {
  const [customers, setCustomers] = useState(data.customers);
  const [q, setQ] = useState("");
  const [qr, setQr] = useState(false);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    const filtered = s
      ? customers.filter((c) => c.name.toLowerCase().includes(s) || (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)))
      : customers;
    return [...filtered].sort((a, b) => (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? ""));
  }, [customers, q]);

  const personal = customers.filter((c) => c.kind === "personal").length;

  return (
    <PageColumn>
      <Topbar
        className="px-1"
        title="Customers"
        subtitle={`${customers.length} customers · ${personal} personal · walk-in and River Mobile`}
        actions={
          <Button size="md" onClick={() => setAdding((v) => !v)} leadingIcon={adding ? <X size={18} /> : <Plus size={18} strokeWidth={2} />}>
            {adding ? "Close" : "Add customer"}
          </Button>
        }
      />

      {adding ? (
        <AddCustomerCard
          barbers={data.barbers}
          onCancel={() => setAdding(false)}
          onAdd={(c) => {
            setCustomers((all) => [c, ...all]);
            setAdding(false);
            void getRepository().saveCustomer(c).catch(() => undefined);
          }}
        />
      ) : null}

      <SearchInput
        className="mt-4"
        placeholder="Search name or mobile"
        label="Search customers"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {!rows.length ? (
        <EmptyState
          className="mt-4"
          title={q ? "No matching customers" : "No customers yet"}
          description="Add a customer, or they’ll appear automatically from the kiosk and River Mobile."
        />
      ) : (
        <Card padding="none" className="mt-4 px-4 py-1.5">
          <ul aria-label="Customers">
            {rows.map((c) => {
              const tag = typeTag(c);
              return (
                <li key={c.id} className="border-b border-line last:border-b-0">
                  <a href={`/customers/${c.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-[12px]">
                    <ListItem
                      variant="row"
                      className="py-2.5"
                      leading={<Avatar name={c.name} preset={c.avatar} size={40} />}
                      title={
                        <>
                          {c.name}{" "}
                          <Badge variant={tag === "Member" || tag === "VIP" ? "solid" : "soft"} size="sm" className="ml-1 align-[1px]">
                            {tag}
                          </Badge>
                        </>
                      }
                      subtitle={`${maskPhone(c.phone)} · ${SOURCE_LABEL[c.source]} · ${c.visitCount === 1 ? "1 visit" : `${c.visitCount} visits`} · last ${lastVisitLabel(c.lastVisitAt)}`}
                      trailing={
                        <span className="flex flex-col items-end leading-[1.3]">
                          <b className="text-[14px] font-extrabold">{peso(c.totalSpent)}</b>
                          <small className="text-[12px] font-medium text-muted">all time</small>
                        </span>
                      }
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="mt-4 flex justify-end px-1">
        <Button size="sm" variant="secondary" leadingIcon={<QrIcon size={16} strokeWidth={1.75} />} onClick={() => setQr(true)}>
          Queue QR
        </Button>
      </div>

      <QueueQrDialog open={qr} onClose={() => setQr(false)} />
    </PageColumn>
  );
}

function AddCustomerCard({ barbers, onAdd, onCancel }: { barbers: Barber[]; onAdd: (c: Customer) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fav, setFav] = useState("none");
  const [sms, setSms] = useState(true);
  return (
    <Card className="mt-4 px-4 py-4">
      <div className="flex flex-col gap-3">
        <b className="text-[16px]">New customer</b>
        <Input size="md" label="Name" placeholder="Juan dela Cruz" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Input size="md" label="Mobile (optional)" placeholder="+63 917 555 0100" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <SelectField label="Favourite barber" value={fav} onChange={setFav} options={[{ value: "none", label: "No preference" }, ...barbers.map((b) => ({ value: b.id, label: b.name }))]} />
        <div className="flex items-center justify-between rounded-tile bg-grey-100 px-4 py-3">
          <span className="text-[13.5px] font-bold">OK to receive queue texts (SMS)</span>
          <Toggle label="SMS consent" checked={sms} onChange={setSms} />
        </div>
        <div className="flex gap-2">
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onAdd({
                id: `cu-new-${Date.now()}`,
                name: name.trim(),
                avatar: "peach",
                phone: phone.trim() || undefined,
                type: "regular",
                kind: "personal",
                source: "staff",
                consent: { sms: sms && !!phone.trim(), marketing: false },
                visitCount: 0,
                totalSpent: 0,
                favoriteBarberId: fav === "none" ? undefined : fav,
              });
            }}
          >
            Save customer
          </Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}

/** Kept for CustomerDetail / dialogs that still open a modal form. */
export function AddCustomerDialog({ open, onClose, onAdd, barbers }: { open: boolean; onClose: () => void; onAdd: (c: Customer) => void; barbers: Barber[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fav, setFav] = useState("none");
  const [sms, setSms] = useState(true);
  return (
    <Dialog open={open} onClose={onClose} title="Add customer" subtitle="Creates a personal record."
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
