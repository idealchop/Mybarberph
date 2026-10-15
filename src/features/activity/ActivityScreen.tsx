"use client";
import { RowsSkeleton } from "@/components/common/Skeleton";
import { cn } from "@river-apps/ui";
import {
  Ban, Bell, CalendarCheck, CalendarPlus, CheckCircle2, CreditCard, HandCoins, MapPin, Package, Play, QrCode, Scissors, Star, Store, Trash2, UserCog, UserMinus, UserPlus, Wallet,
  type LucideIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageBack } from "@/components/shell/PageBack";
import { api } from "@/lib/cloud";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useSession } from "@/lib/session";

interface Entry { id: string; at: number; type: string; text: string; actor: { name: string; role: string }; locationId?: string; read?: boolean }

const ICON: Record<string, LucideIcon> = {
  walkin_added: UserPlus, booking_added: CalendarPlus, booking_requested: CalendarPlus, booking_accepted: CalendarCheck, booking_declined: Ban, booking_deleted: Trash2,
  cut_started: Play, cut_completed: CheckCircle2, payment_changed: Wallet, remit_claimed: HandCoins, remit_reminder: HandCoins,
  barber_added: UserPlus, barber_edited: UserCog, barber_activated: UserCog, barber_deactivated: UserMinus, barber_removed: UserMinus,
  service_added: Package, service_edited: Package, service_removed: Package, shop_edited: Store, location_added: MapPin, location_edited: MapPin, location_removed: MapPin,
  qr_scanned: QrCode, feedback: Star, plan_changed: CreditCard,
};
const TYPES: [string, string][] = [["all", "All types"], ["cut_", "Cuts"], ["booking_", "Bookings"], ["walkin_", "Walk-ins"], ["payment_", "Payments"], ["remit_", "Remit"], ["barber_", "Barbers"], ["service_", "Services"], ["location_", "Locations"], ["shop_", "Shop profile"], ["qr_", "QR scans"], ["feedback", "Feedback"], ["plan_", "Plan"]];
const ROLES: [string, string][] = [["all", "Everyone"], ["owner", "Owner"], ["barber", "Barbers"], ["customer", "Customers"], ["system", "System"]];
const when = (ms: number) => new Date(ms).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const ROLE_LABEL: Record<string, string> = { owner: "Owner", barber: "Barber", customer: "Customer", system: "System" };

/** Settings → bell: Activity (audit log of every action) and Notifications (owner alerts). */
export function ActivityScreen() {
  const [tab, setTab] = useState<"activity" | "notifications">(useSearchParams().get("tab") === "notifications" ? "notifications" : "activity");
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-10 pt-4 lg:max-w-[760px] lg:px-[30px] lg:pt-6">
      <div className="flex items-center gap-1">
        <PageBack fallback="/settings" />
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">{tab === "activity" ? "Activity" : "Notifications"}</h1>
      </div>
      <div role="tablist" aria-label="Activity view" className="mt-3 grid grid-cols-2 rounded-pill bg-grey-100 p-1">
        {(["activity", "notifications"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("h-9 rounded-pill text-[13.5px] font-bold", tab === t ? "bg-surface text-ink shadow-card" : "text-muted")}>{t === "activity" ? "Activity" : "Notifications"}</button>
        ))}
      </div>
      {tab === "activity" ? <ActivityLog /> : <Notifications />}
    </div>
  );
}

function Row({ e, place, unread, onClick }: { e: Entry; place?: string; unread?: boolean; onClick?: () => void }) {
  const Icon = ICON[e.type] ?? Scissors;
  return (
    <li onClick={onClick} className={cn("flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0", onClick && "cursor-pointer")}>
      <span className="mt-0.5 inline-flex size-9 flex-none items-center justify-center rounded-full bg-grey-100"><Icon size={17} strokeWidth={2} aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[14px] leading-snug", unread ? "font-bold" : "font-semibold")}>{e.text}</span>
        <small className="mt-0.5 block text-[12px] font-semibold text-muted">{[`${e.actor?.name ?? ""}${e.actor?.role && e.actor.role !== "system" && e.actor.name !== ROLE_LABEL[e.actor.role] ? ` · ${ROLE_LABEL[e.actor.role]}` : ""}`, place, when(e.at)].filter(Boolean).join(" · ")}</small>
      </span>
      {unread ? <span className="mt-2 size-2 flex-none rounded-full bg-[#D92D20]" aria-label="Unread" /> : null}
    </li>
  );
}

function ActivityLog() {
  const { user } = useSession();
  const shops = useShopLocations();
  const [loc, setLoc] = useState("all"), [role, setRole] = useState("all"), [type, setType] = useState("all"), [actor, setActor] = useState("");
  const [items, setItems] = useState<Entry[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(async (before?: number) => {
    setBusy(true); setErr("");
    try {
      const qs = new URLSearchParams({ loc, role, type, ...(actor ? { actor } : {}), ...(before ? { before: String(before) } : {}) });
      const d = (await api(`/api/shop/activity?${qs}`)) as { items: Entry[]; next: number | null };
      setItems((cur) => (before && cur ? [...cur, ...d.items] : d.items)); setNext(d.next);
    } catch (e) { setErr((e as Error).message || "Couldn’t load activity."); } finally { setBusy(false); }
  }, [loc, role, type, actor]);
  useEffect(() => { if (!user) return; const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [user, load]);
  const nameOf = (id?: string) => (shops.enabled ? shops.branches.find((b) => b.id === (id || HOME_LOCATION_ID))?.name : undefined);
  const actors = [...new Set((items ?? []).map((e) => e.actor?.name).filter(Boolean))];
  const sel = "h-8 min-w-0 rounded-pill bg-surface px-3 text-[12.5px] font-bold shadow-card outline-none";
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {shops.enabled && shops.branches.length > 1 ? (
          <select aria-label="Location" value={loc} onChange={(e) => setLoc(e.target.value)} className={sel}><option value="all">All locations</option>{shops.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        ) : null}
        <select aria-label="Who" value={role} onChange={(e) => setRole(e.target.value)} className={sel}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select aria-label="Person" value={actor} onChange={(e) => setActor(e.target.value)} className={sel}><option value="">Anyone</option>{[...new Set([actor, ...actors].filter(Boolean))].map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className={sel}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      {err ? <p className="mt-3 text-[13px] font-semibold">{err}</p> : null}
      {!items ? (user ? <RowsSkeleton /> : <p className="mt-4 text-[13.5px] font-semibold text-muted">Sign in to see activity.</p>) : items.length === 0 ? (
        <Empty title="No activity yet" text="Walk-ins, bookings, finished cuts, payments, claims and changes by you and your barbers show up here." />
      ) : (
        <ul className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">{items.map((e) => <Row key={e.id} e={e} place={nameOf(e.locationId)} />)}</ul>
      )}
      {next ? <button type="button" disabled={busy} onClick={() => void load(next)} className="mt-3 h-10 w-full rounded-pill bg-surface text-[13.5px] font-bold shadow-card ring-1 ring-line disabled:opacity-50">{busy ? "Loading…" : "Load more"}</button> : null}
    </>
  );
}

function Notifications() {
  const { user } = useSession();
  const shops = useShopLocations();
  const [data, setData] = useState<{ items: Entry[]; unread: number } | null>(null);
  const load = useCallback(() => api("/api/shop/notifications").then((d: { items: Entry[]; unread: number }) => setData(d)).catch(() => undefined), []);
  useEffect(() => { if (!user) return; const t = window.setTimeout(() => void load(), 0); const i = window.setInterval(() => void load(), 30_000); return () => { window.clearTimeout(t); window.clearInterval(i); }; }, [user, load]);
  const markAll = async () => { await api("/api/shop/notifications", { method: "POST", body: JSON.stringify({}) }).catch(() => undefined); window.dispatchEvent(new Event("barbers-notifications")); void load(); };
  const nameOf = (id?: string) => (shops.enabled ? shops.branches.find((b) => b.id === (id || HOME_LOCATION_ID))?.name : undefined);
  return (
    <>
      <div className="mt-3 flex items-center justify-between px-1">
        <span className="text-[13px] font-semibold text-muted">{data ? (data.unread ? `${data.unread} unread` : "All caught up") : ""}</span>
        {data?.unread ? <button type="button" onClick={() => void markAll()} className="text-[13px] font-bold underline decoration-grey-300 underline-offset-[3px]">Mark all read</button> : null}
      </div>
      {!data ? (user ? <RowsSkeleton /> : <p className="mt-4 text-[13.5px] font-semibold text-muted">Sign in to see notifications.</p>) : data.items.length === 0 ? (
        <Empty title="No notifications" text="New online bookings, customer feedback, finished cuts by barbers and unclaimed cash reminders land here." />
      ) : (
        <ul className="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
          {data.items.map((e) => (
            <Row key={e.id} e={e} place={nameOf(e.locationId)} unread={!e.read} onClick={e.read ? undefined : async () => { await api("/api/shop/notifications", { method: "POST", body: JSON.stringify({ ids: [e.id] }) }).catch(() => undefined); window.dispatchEvent(new Event("barbers-notifications")); void load(); }} />
          ))}
        </ul>
      )}
    </>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-3 flex flex-col items-center rounded-card bg-surface px-6 py-8 text-center shadow-card">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-grey-100"><Bell size={24} aria-hidden /></span>
      <b className="mt-2 text-[15px]">{title}</b>
      <p className="mt-1 text-[13px] font-semibold text-muted">{text}</p>
    </div>
  );
}

/** Settings header bell with unread badge. */
export function NotificationBell() {
  const { user } = useSession();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!user) return;
    const get = () => void api("/api/shop/notifications?count=1").then((d: { unread: number }) => setN(d.unread || 0)).catch(() => undefined);
    const t = window.setTimeout(get, 0);
    const i = window.setInterval(get, 60_000);
    window.addEventListener("barbers-notifications", get);
    return () => { window.clearTimeout(t); window.clearInterval(i); window.removeEventListener("barbers-notifications", get); };
  }, [user]);
  return (
    <a href="/settings/activity" aria-label={n ? `Activity and notifications, ${n} unread` : "Activity and notifications"} className="relative inline-flex size-11 flex-none items-center justify-center rounded-full bg-surface text-ink shadow-card">
      <Bell size={20} strokeWidth={2} />
      {n ? <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#D92D20] px-1 text-[10.5px] font-extrabold text-white">{n > 99 ? "99+" : n}</span> : null}
    </a>
  );
}
