"use client";
import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { CoinIcon, SparkleIcon } from "@river-apps/icons";
import { Avatar, Badge, BarChart, Button, IconTile, ProgressRing, SegmentedControl } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";
import { CodeChip, Panel, PanelHeader, TextLink } from "@/components/common/ui";
import { PageColumn } from "@/components/shell/PageColumn";
import { PageHeader } from "@/components/shell/PageHeader";
import type { Barber, Chair, DailySales, Insight, ReferralStats, SalesSummary, Ticket, Voucher } from "@/data";
import { avgWaitMins, firstName, peso, shortService } from "@/lib/format";

export interface DashboardData {
  summary: SalesSummary;
  sales: Record<7 | 14 | 30, DailySales[]>;
  tickets: Ticket[]; chairs: Chair[]; barbers: Barber[];
  stats: Record<string, { cuts: number; sales: number; tips: number }>;
  insights: Insight[]; vouchers: Voucher[]; referral: ReferralStats; shop: import("@/data").Shop;
}

const glow = <i aria-hidden className="pointer-events-none absolute -right-20 -top-[120px] size-[260px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0)_65%)]" />;
const DOT = { high: "bg-ink", medium: "bg-grey-400", low: "bg-grey-300" } as const;

/** Laundry.ph StatCard density: px-4 pt-4 pb-3.5, single caption line. */
function Kpi({ label, value, caption, aside }: { label: React.ReactNode; value: string; caption?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-card bg-surface px-4 pb-3.5 pt-4 shadow-card">
      <div className="flex min-w-0 flex-col leading-[1.25]">
        <span className="text-[12px] font-semibold text-muted">{label}</span>
        <span className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">{value}</span>
        {caption ? <span className="mt-1 truncate text-[12px] font-semibold text-muted">{caption}</span> : null}
      </div>
      {aside}
    </div>
  );
}

function manilaClock() {
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date());
}

export function Dashboard({ data }: { data: DashboardData }) {
  const { summary: s, tickets, chairs, barbers } = data;
  const [range, setRange] = useState<"7" | "14" | "30">("14");
  const [insights, setInsights] = useState(data.insights);
  const [sent, setSent] = useState(false);
  const series = data.sales[Number(range) as 7 | 14 | 30];
  const total = series.reduce((a, d) => a + d.sales, 0);
  const waiting = tickets.filter((t) => t.status === "waiting").sort((a, b) => (b.nextUp ? 1 : 0) - (a.nextUp ? 1 : 0) || (a.estimatedWaitMins ?? 0) - (b.estimatedWaitMins ?? 0));
  const avgWait = avgWaitMins(waiting.map((t) => t.estimatedWaitMins ?? 0));
  const barberById = (id?: string) => barbers.find((b) => b.id === id);
  const ranked = [...barbers].sort((a, b) => (data.stats[b.id]?.sales ?? 0) - (data.stats[a.id]?.sales ?? 0));
  const target = 2500000;
  const pct = Math.round((s.sales / target) * 100);

  return (
    <PageColumn wide>
      <PageHeader
        title={`Hi ${data.shop.ownerName || "there"}, here’s today`}
        subtitle={`${s.dayLabel} · ${data.shop.name}${data.shop.city ? `, ${data.shop.city.split(",")[0]}` : ""} · ${manilaClock()}`}
        search="Search customer or ticket"
      />

      {/* KPI — laundry mt-5 / gap-4 */}
      <section className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="relative flex items-center justify-between overflow-hidden rounded-card bg-ink px-4 pb-3.5 pt-4 text-on-ink shadow-raised">
          {glow}
          <div className="relative flex min-w-0 flex-col leading-[1.25]">
            <span className="text-[12px] font-semibold text-on-ink-muted">Today’s sales</span>
            <span className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">{peso(s.sales)}</span>
            <span className="mt-1 truncate text-[12px] font-semibold text-on-ink-muted">{s.salesDeltaLabel}</span>
          </div>
          <ProgressRing value={pct} size={56} thickness={6} label={`${pct}%`} labelSize={13} tone="inverse" ariaLabel={`${pct}% of daily target`} />
        </div>
        <Kpi label="Customers" value={String(s.transactions)} caption={`${s.walkIns + s.online} today`}
          aside={<span className="flex -space-x-2 self-start">{(["mint", "lilac", "rose"] as const).map((p) => <Avatar key={p} name={p} preset={p} size={28} className="ring-2 ring-surface" />)}</span>} />
        <Kpi label="Avg ticket" value={peso(s.avgTicket)} caption={s.highestLabel !== "—" ? s.highestLabel : undefined} />
        <Kpi label="Tips" value={peso(s.tips)} caption={`${s.tippers} tippers`}
          aside={<IconTile size={44} className="self-start"><CoinIcon size={30} /></IconTile>} />
      </section>

      {/* Charts + queue — laundry mt-[18px] gap-5 */}
      <section className="mt-[18px] grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Panel className="xl:h-[318px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <PanelHeader title="Sales" subtitle={`Last ${range} days · ${peso(total)}`} />
            <SegmentedControl label="Sales range" value={range} onChange={setRange} options={[{ value: "7", label: "7D" }, { value: "14", label: "14D" }, { value: "30", label: "30D" }]} />
          </div>
          <BarChart className="mt-3.5 w-full overflow-visible" width={640} height={236} data={series.map((d) => ({ label: d.label, value: d.sales }))}
            highlightIndex={series.length - 1} tooltip={peso(series[series.length - 1]?.sales ?? 0)} formatValue={(v) => peso(v)}
            ariaLabel={`Daily sales for the last ${range} days`} />
        </Panel>

        <Panel className="xl:h-[318px]">
          <PanelHeader className="mb-1.5" title="Queue" subtitle={`${waiting.length} waiting · ${avgWait} min avg`} action={<TextLink href="/queue">Open queue</TextLink>} />
          <div className="grid grid-cols-4 gap-2">
            {chairs.map((c) => {
              const t = tickets.find((x) => x.id === c.currentTicketId && x.status === "in_service");
              const b = barberById(c.barberId);
              return t ? (
                <div key={c.id} className="flex flex-col rounded-tile bg-grey-100 p-2.5 leading-[1.2]">
                  <span className="text-[11px] font-semibold text-muted">{c.label}</span>
                  <b className="truncate text-[13px]">{b ? firstName(b.name) : "—"}</b>
                  <span className="mt-1.5 block h-1 rounded-pill bg-grey-200"><span className="block h-1 rounded-pill bg-ink" style={{ width: `${t.progressPct}%` }} /></span>
                </div>
              ) : (
                <a key={c.id} href="/queue" className="flex flex-col rounded-tile bg-ink p-2.5 leading-[1.2] text-on-ink">
                  <span className="text-[11px] font-semibold text-on-ink-muted">{c.label}</span>
                  <b className="text-[13px]">Free</b>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold">Assign <ArrowRight size={12} strokeWidth={1.75} /></span>
                </a>
              );
            })}
          </div>
          <ol aria-label="Waiting customers" className="mt-1.5 flex flex-col">
            {waiting.slice(0, 3).map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-b-0">
                <Avatar name={t.customerName} preset={t.customerAvatar} size={36} />
                <div className="flex min-w-0 flex-1 flex-col leading-[1.25]">
                  <b className="truncate text-[14px]">{t.customerName}</b>
                  <span className="truncate text-[12.5px] font-medium text-muted"><span className="font-mono">{t.referenceId}</span> · {shortService(t.serviceLabel)}</span>
                </div>
                <Badge variant="soft">{t.estimatedWaitMins}m</Badge>
              </li>
            ))}
          </ol>
        </Panel>
      </section>

      {/* Bottom row */}
      <section className="mt-[18px] grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel className="xl:h-[318px]">
          <PanelHeader className="mb-1.5" title="Top barbers" subtitle="Today" action={<TextLink href="/barbers">See all</TextLink>} />
          <ul>
            {ranked.map((b, i) => {
              const st = data.stats[b.id];
              return (
                <li key={b.id} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-b-0">
                  <span className="w-4 font-mono text-[12px] font-semibold text-muted">{i + 1}</span>
                  <Avatar name={b.name} preset={b.avatar} size={36} />
                  <div className="flex min-w-0 flex-1 flex-col leading-[1.25]">
                    <b className="truncate text-[14px]">{b.nickname || firstName(b.name)}</b>
                    <span className="truncate text-[12px] font-medium text-muted">★ {b.rating.avg.toFixed(1)}</span>
                  </div>
                  <b className="text-[14px] font-extrabold">{peso(st?.sales ?? 0)}</b>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel className="flex flex-col xl:h-[318px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconTile size={44}><SparkleIcon size={30} /></IconTile>
              <PanelHeader title="Insights" subtitle={`${insights.length} tips`} />
            </div>
            {insights.length ? <Badge variant="solid" size="sm">{insights.length}</Badge> : null}
          </div>
          {insights.length ? (
            <ul className="mt-3 flex flex-col gap-2.5 text-[13.5px] font-medium leading-[1.3] text-ink-2">
              {insights.slice(0, 3).map((it) => (
                <li key={it.id} className="flex gap-2.5">
                  <i aria-hidden className={`mt-1.5 block size-[7px] flex-none rounded-full ${DOT[it.emphasis]}`} />
                  <span className="min-w-0 line-clamp-2"><b className="text-ink">{it.title}.</b> {it.body}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-[13px] font-medium text-muted">All caught up for today.</p>}
          <div className="mt-auto flex gap-2 pt-3">
            <Button size="sm" variant="secondary" leadingIcon={<Send size={16} strokeWidth={1.75} />} onClick={() => setSent(true)} disabled={sent}>
              {sent ? "Sent" : "Send voucher"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setInsights([])} disabled={!insights.length}>Dismiss</Button>
          </div>
        </Panel>

        <Panel className="flex flex-col lg:col-span-2 xl:col-span-1 xl:h-[318px]">
          <PanelHeader className="mb-1.5" title="Vouchers" subtitle={data.referral.month} action={<TextLink href="/vouchers">Manage</TextLink>} />
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2.5 rounded-[18px] bg-grey-100 px-3 py-2.5">
              <BarberIcon name="ticket" size={28} />
              <span className="flex flex-col leading-[1.2]"><b className="text-[17px] font-extrabold">{data.referral.redeemedToday}</b><small className="text-[11.5px] font-semibold text-muted">redeemed</small></span>
            </div>
            <div className="flex items-center gap-2.5 rounded-[18px] bg-grey-100 px-3 py-2.5">
              <ProgressRing value={Math.round((data.referral.referrals / data.referral.referralGoal) * 100)} size={34} thickness={4} labelSize={10} label={data.referral.referrals} ariaLabel={`${data.referral.referrals} of ${data.referral.referralGoal} referrals`} />
              <span className="flex flex-col leading-[1.2]"><b className="text-[17px] font-extrabold">{data.referral.referrals}/{data.referral.referralGoal}</b><small className="text-[11.5px] font-semibold text-muted">referrals</small></span>
            </div>
          </div>
          <ul className="mt-1">
            {data.vouchers.filter((v) => v.active).slice(0, 3).map((v, i) => (
              <li key={v.id} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-b-0">
                <CodeChip tone={i === 0 ? "ink" : "grey"}>{v.code}</CodeChip>
                <span className="flex-1 truncate text-[12.5px] font-medium text-muted">{v.description}</span>
                <b className="text-[13px] font-extrabold">{v.usedThisMonth}</b>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </PageColumn>
  );
}
