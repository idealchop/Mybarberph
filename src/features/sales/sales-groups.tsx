"use client";
import { Check, ChevronDown, Pencil, Plus, Users } from "lucide-react";
import { BarberIcon } from "@/components/art";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { Button } from "@/components/common/button";
import { cloudStorage, useCloud } from "@/lib/cloud";
import { peso } from "@/lib/format";
import { shareLabel, sharePct } from "@/lib/income-split";
import type { ChairRequest } from "@/lib/booking-types";
import { chairBarberName, type ShopChair } from "@/lib/shop-chairs";
import { groupLocationRows, groupReport, normalizeGroups, SALES_GROUPS_KEY, toggleMember, type GroupReport, type SalesGroup } from "@/lib/sales-groups";

function useGroups() {
  const cloud = useCloud();
  const raw = cloud.values[SALES_GROUPS_KEY];
  const saved = useMemo(() => { try { return normalizeGroups(JSON.parse(raw || "null")); } catch { return normalizeGroups(null); } }, [raw]);
  // Optimistic: taps show at once; the saved copy wins again when it changes.
  const [local, setLocal] = useState<{ raw: string | undefined; groups: SalesGroup[] } | null>(null);
  const groups = local && local.raw === raw ? local.groups : saved;
  const save = (g: SalesGroup) => {
    const next = groups.map((x) => (x.id === g.id ? g : x));
    setLocal({ raw, groups: next });
    cloudStorage.setItem(SALES_GROUPS_KEY, JSON.stringify(next));
  };
  return { groups, save };
}

/** Sales group tab v2 (Jimboy, 2026-10-21): one card per group, a single Gross / Net toggle, tap a card for its locations. */
export function SalesGroups({ rows, chairs, branches }: { rows: ChairRequest[]; chairs: ShopChair[]; branches: { id: string; name: string }[] }) {
  const { groups, save } = useGroups();
  const [mode, setMode] = useState<"gross" | "net">("gross");
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const locName = (id: string) => branches.find((b) => b.id === id)?.name || "Main";
  const reports = useMemo(() => groups.map((g) => ({ g, rep: groupReport(rows, g, chairs, { loc: locName }) })), [rows, groups, chairs]); // eslint-disable-line react-hooks/exhaustive-deps
  const noSplit = chairs.some((c) => sharePct(c) == null);
  const eg = groups.find((x) => x.id === editing) ?? null;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[12.5px] font-semibold text-muted">{mode === "gross" ? "Total sales" : `After barbers’ share${noSplit ? " · no split: nothing taken off" : ""}`}</p>
        <div role="radiogroup" aria-label="Total shown" className="flex flex-none rounded-pill bg-grey-100 p-0.5">
          {([["gross", "Gross"], ["net", "Net"]] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
              className={`h-8 rounded-pill px-4 text-[13px] font-bold ${mode === v ? "bg-surface text-ink shadow-card" : "text-muted"}`}>{l}</button>
          ))}
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {reports.map(({ g, rep }) => (
          <GroupCard key={g.id} g={g} rep={rep} mode={mode} chairs={chairs} locName={locName} open={open === g.id}
            onToggle={() => setOpen(open === g.id ? null : g.id)} onEdit={() => setEditing(g.id)} onRename={(name) => save({ ...g, name })} />
        ))}
      </ul>

      {eg ? (
        <BottomSheet title={`Edit ${eg.name}`} subtitle="Tap to add or remove" onClose={() => setEditing(null)} tall
          footer={<Button fullWidth onClick={() => setEditing(null)}>Done</Button>}>
          <p className="px-1 pt-1 text-[13px] font-bold text-muted">Locations</p>
          <ul className="mt-1 flex flex-col">
            {branches.map((b) => <Pick key={b.id} on={eg.locationIds.includes(b.id)} title={b.name} sub="All barbers here" onTap={() => save(toggleMember(eg, "loc", b.id))} />)}
          </ul>
          <p className="mt-3 px-1 text-[13px] font-bold text-muted">Barbers</p>
          <ul className="mt-1 flex flex-col">
            {chairs.map((c) => { const id = c.barberId || c.id; return <Pick key={c.id} on={eg.barberIds.includes(id)} title={chairBarberName(c)} sub={`${locName(c.locationId || "home")} · ${shareLabel(sharePct(c))}`} onTap={() => save(toggleMember(eg, "barber", id))} />; })}
          </ul>
        </BottomSheet>
      ) : null}
    </div>
  );
}

function GroupCard({ g, rep, mode, chairs, locName, open, onToggle, onEdit, onRename }: {
  g: SalesGroup; rep: GroupReport; mode: "gross" | "net"; chairs: ShopChair[]; locName: (id: string) => string;
  open: boolean; onToggle: () => void; onEdit: () => void; onRename: (name: string) => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const members = g.locationIds.length + g.barberIds.length;
  const locRows = groupLocationRows(g, rep, chairs, { loc: locName }, mode);
  const barberCount = new Set(locRows.flatMap((l) => l.barbers.map((b) => b.id)).concat(g.barberIds)).size;
  const total = mode === "gross" ? rep.gross : rep.net;
  const meta = [`${g.locationIds.length} location${g.locationIds.length === 1 ? "" : "s"}`, `${barberCount} barber${barberCount === 1 ? "" : "s"}`, `${rep.cuts} cut${rep.cuts === 1 ? "" : "s"}`].join(" · ");
  return (
    <li className="overflow-hidden rounded-card bg-surface shadow-card">
      <button type="button" aria-expanded={open} aria-label={`${g.name}, ${peso(total)}`} onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-4 text-left">
        <BarberIcon name="shop" size={44} />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px]">{g.name}</b>
          <b className="mt-0.5 block text-[26px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(total)}</b>
          <small className="mt-1 block truncate text-[12.5px] font-semibold text-muted">{members ? meta : "No members yet"}</small>
          {members && (mode === "net" || rep.tips) ? <small className="block truncate text-[12px] font-semibold text-muted">{[mode === "net" ? `barbers’ share ${peso(rep.share)}` : "", rep.tips ? `tips ${peso(rep.tips)}` : ""].filter(Boolean).join(" · ")}</small> : null}
        </span>
        <ChevronDown size={20} className={`flex-none text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div className="border-t border-line px-4 pb-4 pt-3">
          {members === 0 ? (
            <p className="rounded-[14px] bg-grey-100 px-3 py-4 text-center text-[13px] font-semibold text-muted">Add locations to see their sales together.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line" aria-label={`${g.name} locations`}>
              {locRows.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <Faces barbers={l.barbers} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[14.5px]">{l.name}</b>
                    <small className="block truncate text-[12px] font-semibold text-muted">{[l.barbers.map((b) => b.name).join(", ") || "No barber", `${l.cuts} cut${l.cuts === 1 ? "" : "s"}`].join(" · ")}</small>
                  </span>
                  <b className={`flex-none tabular-nums ${l[mode] ? "" : "text-muted"}`}>{peso(l[mode])}</b>
                </li>
              ))}
              {rep.barbers.filter((b) => g.barberIds.includes(b.id) && !locRows.some((l) => l.barbers.some((x) => x.id === b.id))).map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <Faces barbers={[{ id: b.id, name: b.name }]} />
                  <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{b.name}</b><small className="block truncate text-[12px] font-semibold text-muted">{b.sub} · {b.cuts} cut{b.cuts === 1 ? "" : "s"}</small></span>
                  <b className="flex-none tabular-nums">{peso(b[mode])}</b>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            {renaming != null ? (
              <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); onRename(renaming.trim().slice(0, 40) || g.name); setRenaming(null); }}>
                <input autoFocus aria-label="Group name" value={renaming} maxLength={40} onChange={(e) => setRenaming(e.target.value)} className="h-10 min-w-0 flex-1 rounded-pill bg-grey-100 px-4 text-[14.5px] font-bold outline-none" />
                <Button type="submit" size="sm" data-auth="action">Save</Button>
              </form>
            ) : (
              <>
                <Button size="sm" variant="secondary" className="flex-1" data-auth="action" leadingIcon={<Pencil size={14} strokeWidth={2.2} />} onClick={() => setRenaming(g.name)}>Rename</Button>
                <Button size="sm" className="flex-1" data-auth="action" leadingIcon={members ? <Users size={15} strokeWidth={2.2} /> : <Plus size={14} strokeWidth={2.2} />} onClick={onEdit}>{members ? "Edit members" : "Add locations"}</Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Barber photo or initial (up to 2, stacked). */
function Faces({ barbers }: { barbers: { id: string; name: string; photoUrl?: string }[] }) {
  const shown = barbers.slice(0, 2);
  if (!shown.length) return <span aria-hidden className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-grey-100 text-[13px] font-bold text-muted">–</span>;
  return (
    <span aria-hidden className="flex flex-none -space-x-3">
      {shown.map((b) => b.photoUrl
        // eslint-disable-next-line @next/next/no-img-element -- small data-URL barber photo
        ? <img key={b.id} src={b.photoUrl} alt="" className="size-9 rounded-full object-cover ring-2 ring-surface" />
        : <span key={b.id} className="inline-flex size-9 items-center justify-center rounded-full bg-[#E8F0FF] text-[14px] font-extrabold text-[#1D4ED8] ring-2 ring-surface">{(b.name.trim()[0] || "?").toUpperCase()}</span>)}
    </span>
  );
}

function Pick({ on, title, sub, onTap }: { on: boolean; title: string; sub?: string; onTap: () => void }) {
  return (
    <li>
      <button type="button" aria-pressed={on} data-auth="action" onClick={onTap} className={`flex w-full items-center gap-3 rounded-[16px] px-2.5 py-2.5 text-left ${on ? "bg-grey-100" : ""}`}>
        <span aria-hidden className={`inline-flex size-6 flex-none items-center justify-center rounded-full ${on ? "bg-ink text-on-ink" : "ring-2 ring-grey-300"}`}>{on ? <Check size={14} strokeWidth={3} /> : null}</span>
        <span className="min-w-0 flex-1"><b className="block truncate text-[15px]">{title}</b>{sub ? <small className="block truncate text-[12.5px] font-semibold text-muted">{sub}</small> : null}</span>
      </button>
    </li>
  );
}
