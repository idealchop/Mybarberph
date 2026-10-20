"use client";
import { Check, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { Button } from "@/components/common/button";
import { cloudStorage, useCloud } from "@/lib/cloud";
import { peso } from "@/lib/format";
import { sharePct } from "@/lib/income-split";
import type { ChairRequest } from "@/lib/booking-types";
import { chairBarberName, type ShopChair } from "@/lib/shop-chairs";
import { groupReport, normalizeGroups, SALES_GROUPS_KEY, toggleMember, type GroupLine, type SalesGroup } from "@/lib/sales-groups";

function useGroups() {
  const cloud = useCloud();
  const raw = cloud.values[SALES_GROUPS_KEY];
  const groups = useMemo(() => { try { return normalizeGroups(JSON.parse(raw || "null")); } catch { return normalizeGroups(null); } }, [raw]);
  const save = (g: SalesGroup) => cloudStorage.setItem(SALES_GROUPS_KEY, JSON.stringify(groups.map((x) => (x.id === g.id ? g : x))));
  return { groups, save };
}

/** Sales group tab (Jimboy, 2026-10-21): Group 1–3, tap locations/barbers in or out, gross or net after barbers' share. */
export function SalesGroups({ rows, chairs, branches }: { rows: ChairRequest[]; chairs: ShopChair[]; branches: { id: string; name: string }[] }) {
  const { groups, save } = useGroups();
  const [gid, setGid] = useState("g1");
  const [mode, setMode] = useState<"gross" | "net">("gross");
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const g = groups.find((x) => x.id === gid) ?? groups[0]!;
  const locName = (id: string) => branches.find((b) => b.id === id)?.name || "Main";
  const rep = useMemo(() => groupReport(rows, g, chairs, { loc: locName }), [rows, g, chairs]); // eslint-disable-line react-hooks/exhaustive-deps
  const members = g.locationIds.length + g.barberIds.length;
  const val = (x: { gross: number; net: number }) => (mode === "gross" ? x.gross : x.net);
  return (
    <div className="mt-4">
      <div role="tablist" aria-label="Sales groups" className="flex gap-2 overflow-x-auto">
        {groups.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === g.id} onClick={() => { setGid(x.id); setRenaming(null); }}
            className={`h-9 flex-none rounded-pill px-3.5 text-[13.5px] font-bold ${x.id === g.id ? "bg-ink text-on-ink" : "bg-surface shadow-card"}`}>{x.name}</button>
        ))}
      </div>

      <section className="relative mt-3 overflow-hidden rounded-banner bg-ink px-4 py-4 text-on-ink" aria-label={`${g.name} total`}>
        <div className="flex items-center justify-between gap-2">
          {renaming != null ? (
            <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); save({ ...g, name: renaming.trim().slice(0, 40) || g.name }); setRenaming(null); }}>
              <input autoFocus aria-label="Group name" value={renaming} maxLength={40} onChange={(e) => setRenaming(e.target.value)} className="h-9 min-w-0 flex-1 rounded-pill bg-white/15 px-3 text-[15px] font-bold text-on-ink outline-none" />
              <button type="submit" data-auth="action" className="inline-flex h-9 flex-none items-center rounded-pill bg-white px-3 text-[13px] font-bold text-ink">Save</button>
            </form>
          ) : (
            <button type="button" data-auth="action" onClick={() => setRenaming(g.name)} className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold" aria-label={`Rename ${g.name}`}>
              <span className="truncate">{g.name}</span><Pencil size={14} strokeWidth={2.2} className="flex-none opacity-80" />
            </button>
          )}
          <div role="radiogroup" aria-label="Total shown" className="flex flex-none rounded-pill bg-white/15 p-0.5">
            {([["gross", "Gross"], ["net", "Net"]] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={`h-8 rounded-pill px-3 text-[12.5px] font-bold ${mode === v ? "bg-white text-ink" : "text-on-ink"}`}>{l}</button>
            ))}
          </div>
        </div>
        <b className="mt-2 block text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(val(rep))}</b>
        <p className="mt-1 text-[12.5px] font-semibold text-on-ink-muted">
          {mode === "gross" ? `Total sales · ${rep.cuts} cut${rep.cuts === 1 ? "" : "s"}` : `After barbers’ share of ${peso(rep.share)}`}{rep.tips ? ` · tips ${peso(rep.tips)} (barbers’)` : ""}
        </p>
        <Button size="sm" variant="white" className="mt-3" data-auth="action" leadingIcon={members ? <Pencil size={14} strokeWidth={2.2} /> : <Plus size={14} strokeWidth={2.2} />} onClick={() => setEditing(true)}>
          {members ? `Edit members · ${members}` : "Add locations or barbers"}
        </Button>
      </section>

      {members === 0 ? (
        <p className="mt-3 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">This group is empty. Add locations or barbers to see their sales together.</p>
      ) : (
        <>
          <Lines title="By location" lines={rep.locations} val={val} empty="No sales at these locations in this period." />
          <Lines title="By barber" lines={rep.barbers} val={val} empty="No sales by these barbers in this period." />
        </>
      )}

      {editing ? (
        <BottomSheet title={`Edit ${g.name}`} subtitle="Tap to add or remove" onClose={() => setEditing(false)} tall
          footer={<Button fullWidth onClick={() => setEditing(false)}>Done</Button>}>
          <p className="px-1 pt-1 text-[13px] font-bold text-muted">Locations</p>
          <ul className="mt-1 flex flex-col">
            {branches.map((b) => <Pick key={b.id} on={g.locationIds.includes(b.id)} title={b.name} sub="All barbers here" onTap={() => save(toggleMember(g, "loc", b.id))} />)}
          </ul>
          <p className="mt-3 px-1 text-[13px] font-bold text-muted">Barbers</p>
          <ul className="mt-1 flex flex-col">
            {chairs.map((c) => { const id = c.barberId || c.id; return <Pick key={c.id} on={g.barberIds.includes(id)} title={chairBarberName(c)} sub={`${branches.find((b) => b.id === (c.locationId || "home"))?.name ?? "Main"} · ${sharePct(c)}% share`} onTap={() => save(toggleMember(g, "barber", id))} />; })}
          </ul>
        </BottomSheet>
      ) : null}
    </div>
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

function Lines({ title, lines, val, empty }: { title: string; lines: GroupLine[]; val: (x: GroupLine) => number; empty: string }) {
  return (
    <section className="mt-4" aria-label={title}>
      <h2 className="px-1 text-[13px] font-bold text-muted">{title}</h2>
      {lines.length === 0 ? <p className="mt-2 rounded-card bg-surface px-4 py-4 text-[13px] font-semibold text-muted shadow-card">{empty}</p> : (
        <ul className="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="min-w-0"><b className="block truncate text-[14.5px]">{l.name}</b><small className="text-[12px] font-semibold text-muted">{[l.sub, `${l.cuts} cut${l.cuts === 1 ? "" : "s"}`, l.tips ? `tips ${peso(l.tips)}` : ""].filter(Boolean).join(" · ")}</small></span>
              <b className="flex-none tabular-nums">{peso(val(l))}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
