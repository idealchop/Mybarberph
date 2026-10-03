"use client";
import { useState } from "react";
import { Camera, Pencil, Plus, Star as StarIcon } from "lucide-react";
import { Badge, Button, cn, IconTile, Input } from "@river-apps/ui";
import { BarberIcon, HaircutArt, Portrait } from "@/components/art";
import { Dialog, SelectField, Toggle } from "@/components/common/Dialog";
import { Panel, PanelHeader, Pill } from "@/components/common/ui";
import { PageHeader } from "@/components/shell/PageHeader";
import type { Barber, Chair, HaircutStyle, Service } from "@/data";
import { peso } from "@/lib/format";

export interface BarbersData { barbers: Barber[]; chairs: Chair[]; services: Service[]; styles: HaircutStyle[]; stats: Record<string, { cuts: number; sales: number; tips: number }> }
const CATEGORY: Record<Service["category"], string> = { haircut: "Haircut", beard: "Beard", addon: "Add-on", kids: "Kids", senior: "Senior" };
const STATUS: Record<Barber["status"], string> = { in_chair: "With a customer", available: "Available", off: "Day off" };

export function BarbersSetup({ data }: { data: BarbersData }) {
  const [barbers, setBarbers] = useState(data.barbers);
  const [chairs, setChairs] = useState(data.chairs);
  const [services, setServices] = useState(data.services);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [svcEdit, setSvcEdit] = useState<Service | null>(null);
  const svc = (id: string) => services.find((s) => s.id === id);
  const patchService = (id: string, patch: Partial<Service>) => setServices((all) => all.map((s) => s.id === id ? { ...s, ...patch } : s));
  const menu = services.filter((s) => s.category !== "addon");
  const addons = services.filter((s) => s.category === "addon");

  function assignChair(chairId: string, barberId: string) {
    setChairs((all) => all.map((c) => c.id === chairId ? { ...c, barberId: barberId || undefined } : c.barberId === barberId ? { ...c, barberId: undefined } : c));
    setBarbers((all) => all.map((b) => b.id === barberId ? { ...b, defaultChairId: chairId } : b.defaultChairId === chairId ? { ...b, defaultChairId: undefined } : b));
  }

  return (
    <>
      <PageHeader title="Barbers & chairs" subtitle={`${barbers.length} barbers · ${chairs.length} chairs · ${menu.length} services · ${addons.length} add-ons`}
        actions={<Button variant="secondary" leadingIcon={<Plus size={18} strokeWidth={1.75} />} onClick={() => setEditing({ id: `b-new-${Date.now()}`, name: "", nickname: "", avatar: "peach", specialty: "", serviceIds: menu.map((s) => s.id), recommendedServiceIds: [], rating: { avg: 0, count: 0 }, cutsLabel: "New", status: "available", active: true })}>Add barber</Button>} />

      {/* barbers */}
      <section aria-label="Barbers" className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {barbers.map((b) => {
          const chair = chairs.find((c) => c.id === b.defaultChairId);
          const st = data.stats[b.id];
          return (
            <article key={b.id} className="flex flex-col overflow-hidden rounded-card bg-surface shadow-card">
              <div className="relative">
                <div className="aspect-[4/3] w-full overflow-hidden [&>svg]:size-full"><Portrait preset={b.avatar} size={400} /></div>
                <span className="absolute left-3 top-3"><Pill tone={b.status === "in_chair" ? "solid" : "outline"}>{b.status === "in_chair" ? <i aria-hidden className="block size-[6px] rounded-full bg-on-ink" /> : null}{STATUS[b.status]}</Pill></span>
                <Button size="xs" variant="white" className="absolute bottom-3 right-3" leadingIcon={<Camera size={14} strokeWidth={1.75} />}>Photo</Button>
              </div>
              <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col leading-tight"><b className="truncate text-[16px] tracking-[-0.01em]">{b.name}</b><span className="mt-0.5 truncate text-[12.5px] font-semibold text-muted">{b.specialty}</span></div>
                  <span className="inline-flex items-center gap-1 text-[13px] font-extrabold"><StarIcon size={13} fill="currentColor" strokeWidth={0} />{b.rating.avg.toFixed(1)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[["Today", `${st?.cuts ?? 0} cuts`], ["Sales", peso(st?.sales ?? 0)], ["All-time", b.cutsLabel]].map(([k, v]) => (
                    <div key={k} className="rounded-tile bg-grey-100 px-1 py-2 leading-tight"><small className="block text-[11px] font-semibold text-muted">{k}</small><b className="text-[13px]">{v}</b></div>
                  ))}
                </div>
                <p className="mb-1.5 mt-3 text-[12px] font-semibold text-muted">Recommended on the kiosk</p>
                <div className="flex gap-1.5">
                  {b.recommendedServiceIds.slice(0, 5).map((id) => { const s = svc(id); return s ? <span key={id} title={s.name} className="overflow-hidden rounded-[10px]"><HaircutArt kind={s.kind} size={40} preset={b.avatar} /></span> : null; })}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-[12.5px] font-semibold text-muted">{chair ? <>Default <b className="text-ink">{chair.label}</b></> : "No default chair"} · {b.serviceIds.length} services</span>
                  <Button size="xs" variant="secondary" leadingIcon={<Pencil size={13} strokeWidth={1.75} />} onClick={() => setEditing(b)}>Edit</Button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <div className="mt-[18px] grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* services */}
        <Panel className="min-w-0 pb-2">
          <PanelHeader title="Services & prices" subtitle="What the kiosk, partner apps and staff can sell" action={<Button size="sm" variant="secondary" leadingIcon={<Plus size={16} strokeWidth={1.75} />}
            onClick={() => setSvcEdit({ id: `sv-new-${Date.now()}`, name: "", kind: "crew", category: "haircut", price: 20000, durationMins: 30, showInKiosk: true, showInPartnerApps: true, isDefault: false, active: true })}>Add service</Button>} />
          <div className="-mx-1 mt-3 overflow-x-auto px-1">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead><tr className="text-[12px] text-muted">
                <th className="pb-2 pl-1 pr-3 font-semibold">Service</th><th className="pb-2 pr-3 font-semibold">Type</th><th className="pb-2 pr-3 text-right font-semibold">Time</th><th className="pb-2 pr-3 text-right font-semibold">Price</th>
                <th className="pb-2 pr-3 text-center font-semibold">Kiosk</th><th className="pb-2 pr-3 text-center font-semibold">River Mobile</th><th className="pb-2 pr-1 text-right font-semibold" />
              </tr></thead>
              <tbody>
                {[...menu, ...addons].map((s) => (
                  <tr key={s.id} className={cn("border-t border-line", !s.active && "opacity-50")}>
                    <td className="py-[7px] pl-1 pr-3"><span className="flex items-center gap-2.5"><span className="overflow-hidden rounded-[10px]"><HaircutArt kind={s.kind} size={34} /></span>
                      <span className="flex flex-col leading-tight"><b className="text-[14px]">{s.name}</b>{s.badge ? <span className="text-[11.5px] font-semibold text-muted">{s.badge}</span> : s.isDefault ? <span className="text-[11.5px] font-semibold text-muted">From default catalog</span> : null}</span></span></td>
                    <td className="whitespace-nowrap py-[7px] pr-3"><Pill tone={s.category === "addon" ? "outline" : "soft"}>{CATEGORY[s.category]}</Pill></td>
                    <td className="whitespace-nowrap py-[7px] pr-3 text-right text-[13px] font-semibold text-ink-2">{s.durationMins} min</td>
                    <td className="whitespace-nowrap py-[7px] pr-3 text-right text-[14px] font-extrabold">{peso(s.price)}</td>
                    <td className="py-[7px] pr-3 text-center"><Toggle label={`${s.name} on kiosk`} checked={s.showInKiosk} onChange={(v) => patchService(s.id, { showInKiosk: v })} /></td>
                    <td className="py-[7px] pr-3 text-center"><Toggle label={`${s.name} on River Mobile`} checked={s.showInPartnerApps} onChange={(v) => patchService(s.id, { showInPartnerApps: v })} /></td>
                    <td className="py-[7px] pr-1 text-right"><Button size="xs" variant="ghost" onClick={() => setSvcEdit(s)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="flex flex-col gap-[18px]">
          {/* chairs */}
          <Panel className="pb-4">
            <PanelHeader className="mb-3" title="Chairs" subtitle="Default barber per chair · tap to mark out of service" />
            <ul className="flex flex-col gap-2">
              {chairs.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-[18px] bg-grey-100 p-2.5 pr-3">
                  <IconTile size={44} style={{ borderRadius: 14 }} className="bg-surface"><BarberIcon name={c.art} size={30} /></IconTile>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight"><b className="text-[14px]">{c.label}</b>
                    <span className="text-[12px] font-semibold text-muted">{c.status === "out_of_service" ? "Out of service" : c.status === "occupied" ? "In use" : "Free"}</span></div>
                  <label className="sr-only" htmlFor={`chair-${c.id}`}>Barber for {c.label}</label>
                  <select id={`chair-${c.id}`} value={c.barberId ?? ""} onChange={(e) => assignChair(c.id, e.target.value)} className="h-[34px] rounded-pill bg-surface px-3 text-[13px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-ink">
                    <option value="">No barber</option>{barbers.map((b) => <option key={b.id} value={b.id}>{b.nickname}</option>)}
                  </select>
                  <Toggle label={`${c.label} in service`} checked={c.status !== "out_of_service"} onChange={(v) => setChairs((all) => all.map((x) => x.id === c.id ? { ...x, status: v ? "free" : "out_of_service" } : x))} />
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" className="mt-2" leadingIcon={<Plus size={15} strokeWidth={1.75} />}
              onClick={() => setChairs((all) => [...all, { id: `c-${all.length + 1}`, label: `Chair ${all.length + 1}`, number: all.length + 1, art: "scissors", status: "free", active: true }])}>Add chair</Button>
          </Panel>

          {/* catalog */}
          <Panel className="pb-4">
            <PanelHeader className="mb-3" title="Default haircut catalog" subtitle="Barbers.ph styles with ready-made art. Add one to your menu in a tap." />
            <ul className="grid grid-cols-2 gap-2">
              {data.styles.map((st) => {
                const used = services.some((s) => s.styleId === st.id);
                return (
                  <li key={st.id} className="flex items-center gap-2.5 rounded-tile bg-grey-100 p-2">
                    <span className="overflow-hidden rounded-[10px]"><HaircutArt kind={st.kind} size={36} /></span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight"><b className="truncate text-[13px]">{st.name}</b><span className="truncate text-[11px] font-semibold text-muted">{st.tags.join(" · ")}</span></span>
                    {used ? <Badge variant="soft" size="sm" className="bg-surface">On menu</Badge> : (
                      <button type="button" aria-label={`Add ${st.name} to the menu`} className="inline-flex size-7 items-center justify-center rounded-full bg-ink text-on-ink"
                        onClick={() => setServices((all) => [...all, { id: `sv-${st.id}`, styleId: st.id, name: st.name, kind: st.kind, category: st.tags.includes("kids") ? "kids" : "haircut", price: 20000, durationMins: 30, showInKiosk: true, showInPartnerApps: true, isDefault: true, active: true }])}>
                        <Plus size={15} strokeWidth={2} /></button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      {editing ? <BarberDialog barber={editing} services={menu} chairs={chairs} onClose={() => setEditing(null)}
        onSave={(b) => { setBarbers((all) => all.some((x) => x.id === b.id) ? all.map((x) => x.id === b.id ? b : x) : [...all, b]); if (b.defaultChairId) assignChair(b.defaultChairId, b.id); setEditing(null); }} /> : null}
      {svcEdit ? <ServiceDialog service={svcEdit} onClose={() => setSvcEdit(null)}
        onSave={(s) => { setServices((all) => all.some((x) => x.id === s.id) ? all.map((x) => x.id === s.id ? s : x) : [...all, s]); setSvcEdit(null); }} /> : null}
    </>
  );
}

function BarberDialog({ barber, services, chairs, onClose, onSave }: { barber: Barber; services: Service[]; chairs: Chair[]; onClose: () => void; onSave: (b: Barber) => void }) {
  const [b, setB] = useState(barber);
  const toggleRec = (id: string) => setB((x) => ({ ...x, recommendedServiceIds: x.recommendedServiceIds.includes(id) ? x.recommendedServiceIds.filter((r) => r !== id) : x.recommendedServiceIds.length >= 5 ? x.recommendedServiceIds : [...x.recommendedServiceIds, id] }));
  const toggleSvc = (id: string) => setB((x) => ({ ...x, serviceIds: x.serviceIds.includes(id) ? x.serviceIds.filter((r) => r !== id) : [...x.serviceIds, id] }));
  return (
    <Dialog open onClose={onClose} title={barber.name ? `Edit ${barber.nickname}` : "Add barber"} subtitle="Pick up to 5 recommended haircuts. They show first on the kiosk." className="sm:max-w-[560px]"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!b.name.trim()} onClick={() => onSave({ ...b, nickname: b.nickname || b.name.split(" ")[0]! })}>Save barber</Button></>}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="overflow-hidden rounded-card"><Portrait preset={b.avatar} size={88} /></span>
          <div className="flex flex-col gap-2"><Button size="sm" variant="secondary" leadingIcon={<Camera size={15} strokeWidth={1.75} />}>Upload photo</Button><span className="text-[12px] font-medium text-muted">Square photo, at least 400 px. Shown on the kiosk.</span></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input size="md" label="Full name" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
          <Input size="md" label="Nickname" value={b.nickname} onChange={(e) => setB({ ...b, nickname: e.target.value })} />
          <Input size="md" label="Specialty" value={b.specialty} onChange={(e) => setB({ ...b, specialty: e.target.value })} />
          <SelectField label="Default chair" value={b.defaultChairId ?? ""} onChange={(v) => setB({ ...b, defaultChairId: v || undefined })} options={[{ value: "", label: "None" }, ...chairs.map((c) => ({ value: c.id, label: c.label }))]} />
        </div>
        <div>
          <p className="mb-2 text-[14px] font-bold">Haircuts they do <span className="font-semibold text-muted">· ★ = recommended ({b.recommendedServiceIds.length}/5)</span></p>
          <ul className="grid grid-cols-2 gap-2">
            {services.map((s) => {
              const on = b.serviceIds.includes(s.id); const rec = b.recommendedServiceIds.includes(s.id);
              return (
                <li key={s.id} className={cn("flex items-center gap-2 rounded-tile p-2", on ? "bg-grey-100" : "bg-surface ring-1 ring-inset ring-grey-200")}>
                  <input type="checkbox" checked={on} onChange={() => toggleSvc(s.id)} aria-label={`${b.nickname || "Barber"} does ${s.name}`} className="size-4 accent-[#0A0A0A]" />
                  <HaircutArt kind={s.kind} size={30} preset={b.avatar} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{s.name}</span>
                  <button type="button" disabled={!on} aria-pressed={rec} aria-label={`Recommend ${s.name}`} onClick={() => toggleRec(s.id)}
                    className={cn("inline-flex size-7 items-center justify-center rounded-full disabled:opacity-30", rec ? "bg-ink text-on-ink" : "bg-surface text-subtle")}><StarIcon size={13} fill={rec ? "currentColor" : "none"} strokeWidth={1.75} /></button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}

function ServiceDialog({ service, onClose, onSave }: { service: Service; onClose: () => void; onSave: (s: Service) => void }) {
  const [s, setS] = useState(service);
  return (
    <Dialog open onClose={onClose} title={service.name ? `Edit ${service.name}` : "Add service"} subtitle="Prices are in pesos. Changes apply to new tickets."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!s.name.trim() || s.price <= 0} onClick={() => onSave(s)}>Save service</Button></>}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3"><span className="overflow-hidden rounded-tile"><HaircutArt kind={s.kind} size={56} /></span>
          <SelectField className="flex-1" label="Art" value={s.kind} onChange={(v) => setS({ ...s, kind: v })} options={(["fade", "crew", "pompadour", "twoblock", "buzz", "beard"] as const).map((k) => ({ value: k, label: k === "twoblock" ? "Two-block" : k[0]!.toUpperCase() + k.slice(1) }))} /></div>
        <Input size="md" label="Name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Input size="md" label="Price (₱)" inputMode="numeric" value={String(s.price / 100)} onChange={(e) => setS({ ...s, price: Math.max(0, Math.round(Number(e.target.value.replace(/[^\d.]/g, "")) * 100) || 0) })} />
          <Input size="md" label="Minutes" inputMode="numeric" value={String(s.durationMins)} onChange={(e) => setS({ ...s, durationMins: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
        </div>
        <SelectField label="Type" value={s.category} onChange={(v) => setS({ ...s, category: v })} options={(Object.keys(CATEGORY) as Service["category"][]).map((k) => ({ value: k, label: CATEGORY[k] }))} />
        <div className="flex items-center justify-between rounded-tile bg-grey-100 px-4 py-3"><span className="text-[13.5px] font-bold">Active</span><Toggle label="Active" checked={s.active} onChange={(v) => setS({ ...s, active: v })} /></div>
      </div>
    </Dialog>
  );
}
