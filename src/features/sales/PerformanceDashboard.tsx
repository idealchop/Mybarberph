"use client";
import { cn } from "@river-apps/ui";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ChairRequest } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { rangeWindow, type SalesRange } from "@/lib/sales-report";
import { barberKey, dayKey } from "@/lib/sales-stats";
import { HOME_LOCATION_ID } from "@/lib/shop-locations";
import { SalesChartCard } from "./SalesChart";

const DAY = 86_400_000;
const MEDAL = ["🥇", "🥈", "🥉"];
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type Chair = { id: string; label: string; barberId?: string; barberName?: string; locationId?: string };
const at = (r: ChairRequest) => r.completedAt ?? r.updatedAt ?? r.createdAt;
const hourOf = (ms: number) => new Date(ms + 8 * 3600_000).getUTCHours();
const wdOf = (ms: number) => (new Date(ms + 8 * 3600_000).getUTCDay() + 6) % 7;
const hLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
const mins = (v: number | null) => (v == null ? "–" : v < 60 ? `${v} min` : `${Math.floor(v / 60)}h ${v % 60}m`);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

function windowKeys(range: SalesRange, shift = 0) {
  const { end, span } = rangeWindow(range);
  const e = end - shift * span * DAY;
  return new Set(Array.from({ length: span }, (_, i) => dayKey(e - (span - 1 - i) * DAY)));
}

function stats(rows: ChairRequest[]) {
  const done = rows.filter((r) => r.status === "done");
  const sales = done.reduce((s, r) => s + (r.price || 0), 0);
  return { done, sales, cuts: done.length };
}

/** Shop performance for the chosen location + dates: trends, timing, mix, rankings. */
export function PerformanceDashboard({ all, range, where, branches, chairs, solo = false }: { all: ChairRequest[]; range: SalesRange; where: string; branches: { id: string; name: string }[]; chairs: Chair[]; solo?: boolean }) {
  const [fb, setFb] = useState(""), [fc, setFc] = useState(""), [fp, setFp] = useState(""), [fs, setFs] = useState("");
  const barberOpts = [...new Map(chairs.map((c) => [c.barberId || c.id, c.barberName?.trim() || c.label || "Barber"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const svcOpts = [...new Set(all.map((r) => (r.serviceName || "").trim()).filter(Boolean))].sort();
  const extraOk = (r: ChairRequest) =>
    (!fb || barberKey(r, chairs) === fb) &&
    (!fc || (fc === "online" ? r.channel === "online" : r.channel !== "online")) &&
    (!fp || (fp === "unpaid" ? !r.paid : r.paid && (r.payMethod ?? "cash") === fp)) &&
    (!fs || (r.serviceName || "").trim() === fs);
  const locOk = (r: ChairRequest) => (where === "all" || (r.locationId || HOME_LOCATION_ID) === where) && extraOk(r);
  const filtered = Boolean(fb || fc || fp || fs);
  const filters = (
    <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Filters">
      <Pick label="Barber" value={fb} onChange={setFb} opts={[["", "All barbers"], ...barberOpts]} />
      <Pick label="Channel" value={fc} onChange={setFc} opts={[["", "All channels"], ["walk-in", "Walk-in"], ["online", "Online"]]} />
      <Pick label="Payment" value={fp} onChange={setFp} opts={[["", "All payments"], ["cash", "Cash"], ["gcash", "GCash"], ["online", "Paid online"], ["unpaid", "Unpaid"]]} />
      <Pick label="Service" value={fs} onChange={setFs} opts={[["", "All services"], ...svcOpts.map((s) => [s, s] as [string, string])]} />
      {filtered ? <button type="button" onClick={() => { setFb(""); setFc(""); setFp(""); setFs(""); }} className="h-8 rounded-pill px-2.5 text-[12.5px] font-bold text-muted underline">Clear</button> : null}
    </div>
  );
  const cur = windowKeys(range), prev = windowKeys(range, 1);
  const rows = all.filter((r) => locOk(r) && cur.has(dayKey(at(r))));
  const before = all.filter((r) => locOk(r) && prev.has(dayKey(at(r))));
  const now = stats(rows), was = stats(before);
  const declined = rows.filter((r) => r.status === "declined").length;
  const pending = rows.filter((r) => r.status === "requested" || r.status === "accepted").length;
  const completion = now.cuts + declined ? Math.round((now.cuts / (now.cuts + declined)) * 100) : null;
  const service = avg(now.done.filter((r) => r.startedAt && r.completedAt && r.completedAt > r.startedAt).map((r) => Math.round((r.completedAt! - r.startedAt!) / 60_000)).filter((m) => m < 300));
  const wait = avg(rows.filter((r) => r.startedAt && r.startedAt > r.createdAt).map((r) => Math.round((r.startedAt! - r.createdAt) / 60_000)).filter((m) => m < 600));
  const walk = now.done.filter((r) => r.channel !== "online").length, online = now.cuts - walk;
  const cash = now.done.filter((r) => r.paid && (r.payMethod ?? "cash") === "cash").reduce((s, r) => s + r.price, 0);
  const gcash = now.done.filter((r) => r.paid && r.payMethod === "gcash").reduce((s, r) => s + r.price, 0);
  const onlinePay = now.done.filter((r) => r.paid && r.payMethod === "online").reduce((s, r) => s + r.price, 0);
  const unpaid = now.done.filter((r) => !r.paid).reduce((s, r) => s + r.price, 0);

  // Repeat vs new: a contact seen before this period (in what we loaded) or more than once in it.
  const contactOf = (r: ChairRequest) => (r.contact || "").replace(/\D/g, "").slice(-10);
  const seenBefore = new Set(all.filter((r) => r.status === "done" && !cur.has(dayKey(at(r))) && at(r) < Math.min(...now.done.map(at), Infinity)).map(contactOf).filter(Boolean));
  const counts = new Map<string, number>();
  for (const r of now.done) { const c = contactOf(r); if (c) counts.set(c, (counts.get(c) ?? 0) + 1); }
  const known = [...counts.keys()];
  const repeat = known.filter((c) => seenBefore.has(c) || (counts.get(c) ?? 0) > 1).length;

  // Hours + weekdays.
  const byHour = new Map<number, { orders: number; sales: number }>();
  const heat = Array.from({ length: 7 }, () => new Map<number, number>());
  const byDay = Array.from({ length: 7 }, () => ({ cuts: 0, sales: 0 }));
  for (const r of now.done) {
    const t = r.completedAt ?? at(r), h = hourOf(t), d = wdOf(t);
    const x = byHour.get(h) ?? { orders: 0, sales: 0 }; x.orders += 1; x.sales += r.price || 0; byHour.set(h, x);
    heat[d]!.set(h, (heat[d]!.get(h) ?? 0) + 1);
    byDay[d]!.cuts += 1; byDay[d]!.sales += r.price || 0;
  }
  const series = [...byHour.entries()].sort((a, b) => a[0] - b[0]).map(([h, v]) => ({ label: hLabel(h), orders: v.orders, salesCentavos: v.sales, detail: `${v.orders} cuts` }));
  const peak = [...byHour.entries()].sort((a, b) => b[1].orders - a[1].orders)[0];
  const heatMax = Math.max(1, ...heat.flatMap((m) => [...m.values()]));
  const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

  // Rankings.
  const nameOfLoc = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  const locRank = branches.map((b) => { const d = now.done.filter((r) => (r.locationId || HOME_LOCATION_ID) === b.id); return { id: b.id, name: b.name, sales: d.reduce((s, r) => s + r.price, 0), cuts: d.length }; }).sort((a, b) => b.sales - a.sales);
  const bMap = new Map<string, { id: string; loc: string; name: string; sales: number; cuts: number }>();
  for (const r of now.done) {
    const id = barberKey(r, chairs), loc = r.locationId || HOME_LOCATION_ID, k = `${id}@${loc}`;
    const chair = chairs.find((c) => (c.barberId || c.id) === id);
    if ((chair as { active?: boolean } | undefined)?.active === false) continue;
    const x = bMap.get(k) ?? { id, loc, name: r.barberName || chair?.barberName?.trim() || chair?.label || "Barber", sales: 0, cuts: 0 };
    x.sales += r.price || 0; x.cuts += 1; bMap.set(k, x);
  }
  const barberRank = [...bMap.values()].sort((a, b) => b.sales - a.sales);
  const svc = new Map<string, { cuts: number; sales: number }>();
  for (const r of now.done) { const k = (r.serviceName || "Service").trim(); const x = svc.get(k) ?? { cuts: 0, sales: 0 }; x.cuts += 1; x.sales += r.price || 0; svc.set(k, x); }
  const services = [...svc.entries()].map(([name, v]) => ({ name, ...v, avg: Math.round(v.sales / v.cuts) })).sort((a, b) => b.sales - a.sales);
  const svcMax = Math.max(1, ...services.map((s) => s.sales));
  const multiLoc = branches.length > 1 && where === "all";

  if (!rows.length && !before.length) {
    return (<>{solo ? null : filters}
      <div className="mt-3 rounded-card bg-surface px-6 py-10 text-center shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons3d/bar-chart.png" alt="" width={56} height={56} className="mx-auto size-14 object-contain" />
        <b className="mt-2 block text-[16px]">No visits in this range yet</b>
        <p className="mt-1 text-[13px] font-semibold text-muted">Finish a few cuts and your shop’s performance shows up here: peak hours, busiest days, service mix and top barbers.</p>
      </div></>
    );
  }

  return (<>{solo ? null : filters}
    <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 [&>*]:min-w-0 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0 lg:col-span-2 lg:grid-cols-4">
        <Kpi k="Sales" v={peso(now.sales)} d={delta(now.sales, was.sales)} />
        <Kpi k="Cuts" v={String(now.cuts)} d={delta(now.cuts, was.cuts)} />
        <Kpi k="Avg ticket" v={now.cuts ? peso(Math.round(now.sales / now.cuts)) : "–"} d={delta(now.cuts ? now.sales / now.cuts : 0, was.cuts ? was.sales / was.cuts : 0)} />
        <Kpi k="Peak hour" v={peak ? hLabel(peak[0]) : "–"} sub={peak ? `${peak[1].orders} cut${peak[1].orders === 1 ? "" : "s"}` : undefined} />
      </div>

      {solo ? null : <Rank title="Top barbers" rows={barberRank.map((b) => ({ key: `${b.id}@${b.loc}`, name: b.name, sub: [multiLoc ? nameOfLoc(b.loc) : "", `${b.cuts} cut${b.cuts === 1 ? "" : "s"}`].filter(Boolean).join(" · "), v: b.sales, href: `/sales/detail?kind=barber&id=${encodeURIComponent(b.id)}&r=${range}&loc=${encodeURIComponent(b.loc)}` }))} />}
      {multiLoc && !solo ? <Rank title="Top locations" rows={locRank.map((l) => ({ key: l.id, name: l.name, sub: `${l.cuts} cut${l.cuts === 1 ? "" : "s"}`, v: l.sales, href: `/sales/detail?kind=location&id=${encodeURIComponent(l.id)}&r=${range}` }))} /> : null}
      <SalesChartCard series={series} kind="hour" sales={now.sales} />

      <Panel title="Busiest days" sub={byDay.some((d) => d.cuts) ? `Most on ${WD[byDay.reduce((b, d, i) => (d.cuts > byDay[b]!.cuts ? i : b), 0)]}` : "By weekday and hour"}>
        <div className="mt-3 w-full max-w-full overflow-x-auto">
          <div className="grid min-w-0 gap-[2px]" style={{ gridTemplateColumns: `26px repeat(${HOURS.length}, minmax(0,1fr))` }} role="img" aria-label="Cuts by weekday and hour">
            {WD.map((w, d) => (
              <div key={w} className="contents">
                <span className="text-[10.5px] font-bold leading-[16px] text-muted">{w}</span>
                {HOURS.map((h) => { const c = heat[d]!.get(h) ?? 0; return <span key={h} title={`${w} ${hLabel(h)}: ${c}`} className="h-4 rounded-[3px]" style={{ background: c ? `rgba(10,10,10,${0.18 + 0.82 * (c / heatMax)})` : "var(--color-grey-100, #f1f1f3)" }} />; })}
              </div>
            ))}
            <span />
            {HOURS.map((h) => <span key={h} className="text-center text-[9px] font-bold text-muted">{h % 3 === 1 ? `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}` : ""}</span>)}
          </div>
        </div>
        <ul className="mt-3 grid grid-cols-7 gap-1">
          {byDay.map((d, i) => <li key={i} className="text-center"><b className="block text-[13px] tabular-nums">{d.cuts}</b><small className="text-[10.5px] font-bold text-muted">{WD[i]}</small></li>)}
        </ul>
      </Panel>

      <Panel title="Completion" sub={completion == null ? "No finished or declined visits" : `${completion}% of requests finished`}>
        <div className="mt-3 flex items-center gap-4">
          <Ring pct={completion ?? 0} />
          <ul className="grid flex-1 gap-1.5 text-[13px] font-semibold">
            <Li dot="bg-ink" k="Finished" v={String(now.cuts)} />
            <Li dot="bg-[#D92D20]" k="Declined" v={String(declined)} />
            <Li dot="bg-grey-300" k="Waiting / not started" v={String(pending)} />
          </ul>
        </div>
      </Panel>

      <Panel title="Time" sub="From timestamps on each visit">
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Box k="Avg per customer" v={mins(service)} sub="Start → done" />
          <Box k="Avg wait" v={mins(wait)} sub="Request → start" />
        </div>
      </Panel>

      <Panel title="Mix" sub="How customers came and paid">
        <Split className="mt-3" label="Channel" parts={[{ k: "Walk-in", v: walk, c: "bg-ink" }, { k: "Online", v: online, c: "bg-[#1b6b63]" }]} fmt={(n) => String(n)} />
        <Split className="mt-3" label="Payment" parts={[{ k: "Cash", v: cash, c: "bg-ink" }, { k: "GCash", v: gcash, c: "bg-[#0a6cff]" }, { k: "Online", v: onlinePay, c: "bg-[#1b6b63]" }, { k: "Unpaid", v: unpaid, c: "bg-grey-300" }]} fmt={peso} />
        {known.length ? <Split className="mt-3" label="Customers" parts={[{ k: "Repeat", v: repeat, c: "bg-ink" }, { k: "New", v: known.length - repeat, c: "bg-grey-300" }]} fmt={(n) => String(n)} /> : null}
      </Panel>

      <Panel title="Service mix" sub={services.length ? `${services.length} service${services.length === 1 ? "" : "s"}` : "No finished cuts"}>
        <ul className="mt-2 grid gap-2.5">
          {services.map((s) => (
            <li key={s.name}>
              <div className="flex min-w-0 items-baseline justify-between gap-3 text-[13.5px]"><b className="min-w-0 truncate">{s.name}</b><b className="tabular-nums">{peso(s.sales)}</b></div>
              <div className="mt-1 h-1.5 rounded-full bg-grey-100"><div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(3, (s.sales / svcMax) * 100)}%` }} /></div>
              <small className="text-[11.5px] font-semibold text-muted">{s.cuts} cut{s.cuts === 1 ? "" : "s"} · avg {peso(s.avg)}</small>
            </li>
          ))}
        </ul>
      </Panel>

    </div></>
  );
}

function Pick({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <label className={cn("relative inline-flex h-8 max-w-[48%] items-center rounded-pill px-3 text-[12.5px] font-bold", value ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>
      <span className="truncate">{opts.find((o) => o[0] === value)?.[1] ?? label}</span><span aria-hidden className="ml-1 text-[10px]">▾</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function delta(a: number, b: number) { if (!b) return a ? null : 0; return Math.round(((a - b) / b) * 100); }

function Kpi({ k, v, d, sub }: { k: string; v: string; d?: number | null; sub?: string }) {
  return (
    <div className="rounded-card bg-surface px-3.5 py-3 shadow-card">
      <p className="text-[12px] font-semibold text-muted">{k}</p>
      <b className="block text-[20px] tracking-[-0.02em] tabular-nums">{v}</b>
      {d === undefined ? (sub ? <small className="text-[11.5px] font-semibold text-muted">{sub}</small> : null)
        : d === null ? <small className="text-[11.5px] font-semibold text-muted">New vs last period</small>
        : <small className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-bold", d > 0 ? "text-[#067647]" : d < 0 ? "text-[#D92D20]" : "text-muted")}>{d > 0 ? <ArrowUpRight size={13} /> : d < 0 ? <ArrowDownRight size={13} /> : null}{d === 0 ? "Same as" : `${Math.abs(d)}%`} {d === 0 ? "last period" : "vs last period"}</small>}
    </div>
  );
}
function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="rounded-card bg-surface px-4 py-4 shadow-card"><h2 className="text-[16px] font-bold">{title}</h2>{sub ? <p className="mt-0.5 text-[12.5px] font-semibold text-muted">{sub}</p> : null}{children}</section>;
}
function Box({ k, v, sub }: { k: string; v: string; sub: string }) {
  return <div className="rounded-[14px] bg-grey-100 px-3 py-2.5"><p className="text-[12px] font-semibold text-muted">{k}</p><b className="text-[18px] tabular-nums">{v}</b><small className="block text-[11px] font-semibold text-muted">{sub}</small></div>;
}
function Li({ dot, k, v }: { dot: string; k: string; v: string }) {
  return <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", dot)} />{k}</span><b className="tabular-nums">{v}</b></li>;
}
function Ring({ pct }: { pct: number }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" role="img" aria-label={`${pct}% completion`} className="flex-none">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#EEEEF0" strokeWidth="9" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="#0A0A0A" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 40 40)" />
      <text x="40" y="45" textAnchor="middle" className="fill-ink text-[15px] font-extrabold">{pct}%</text>
    </svg>
  );
}
function Split({ label, parts, fmt, className }: { label: string; parts: { k: string; v: number; c: string }[]; fmt: (n: number) => string; className?: string }) {
  const total = parts.reduce((s, p) => s + p.v, 0);
  const shown = parts.filter((p) => p.v > 0);
  return (
    <div className={className}>
      <p className="text-[12px] font-bold text-muted">{label}</p>
      <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-grey-100">{total ? shown.map((p) => <span key={p.k} className={p.c} style={{ width: `${(p.v / total) * 100}%` }} />) : null}</div>
      <p className="mt-1 flex flex-wrap gap-x-3 text-[12px] font-semibold">{(total ? shown : parts.slice(0, 2)).map((p) => <span key={p.k} className="inline-flex items-center gap-1"><span className={cn("size-2 rounded-full", p.c)} />{p.k} {fmt(p.v)}{total ? ` · ${Math.round((p.v / total) * 100)}%` : ""}</span>)}</p>
    </div>
  );
}
function Rank({ title, rows: all }: { title: string; rows: { key: string; name: string; sub: string; v: number; href: string }[] }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(all.length / 10));
  const p = Math.min(page, pages - 1);
  const rows = all.slice(p * 10, p * 10 + 10);
  return (
    <section className="rounded-card bg-surface shadow-card">
      <h2 className="px-4 pt-4 text-[16px] font-bold">{title}</h2>
      {rows.length ? (
        <ol className="mt-1">
          {rows.map((r, j) => { const i = p * 10 + j; return (
            <li key={r.key} className="border-b border-line last:border-b-0">
              <Link href={r.href} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn("inline-flex size-8 flex-none items-center justify-center rounded-full font-extrabold", i < 3 ? "text-[20px]" : "bg-grey-100 text-[13px] text-muted")}>{i < 3 ? MEDAL[i] : i + 1}</span>
                <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{r.name}</b><small className="block truncate text-[12px] font-semibold text-muted">{r.sub}</small></span>
                <b className="flex-none tabular-nums">{peso(r.v)}</b><ChevronRight size={16} className="flex-none text-subtle" aria-hidden />
              </Link>
            </li>
          ); })}
        </ol>
      ) : <p className="px-4 pb-4 pt-2 text-[13px] font-semibold text-muted">No finished cuts in this range.</p>}
      {pages > 1 ? (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px] font-bold">
          <button type="button" disabled={p === 0} onClick={() => setPage(p - 1)} className="disabled:opacity-30">‹ Prev</button>
          <span className="text-[12px] text-muted">{p * 10 + 1}–{Math.min(all.length, p * 10 + 10)} of {all.length}</span>
          <button type="button" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} className="disabled:opacity-30">Next ›</button>
        </div>
      ) : null}
    </section>
  );
}
