/** READ-ONLY cross-check of the profit split on a DEV shop (barbersdb-dev only). Writes nothing. */
process.env.FIRESTORE_DATABASE_ID = "barbersdb-dev"; process.env.BARBERS_ENV = "dev";
const { adminDb, firestoreDatabaseId } = await import("@/lib/firebase/admin");
if (firestoreDatabaseId() !== "barbersdb-dev") throw new Error("REFUSING: not barbersdb-dev");
const UID = process.argv[process.argv.indexOf("--uid") + 1]!;
const { profitWeek, weekBounds } = await import("@/lib/profit-report");
const { asOwnerSplit, asBarberSplit } = await import("@/lib/split-view");
const { barberStats } = await import("@/lib/sales-stats");
const { dayClaim } = await import("@/lib/profit-claim");
const { dayOf } = await import("@/lib/barber-history");
const { barberPerformance, barberDayCuts } = await import("@/lib/server/barber-sales");
const { remitSummary } = await import("@/lib/server/remit");
const { loadShopData } = await import("@/lib/server/companion/data");
const db = adminDb(); const shop = db.collection("shops").doc(UID);
const rows = (await shop.collection("bookings").get()).docs.map((d) => ({ ...d.data(), id: d.id })) as never as import("@/lib/booking-types").ChairRequest[];
const chairs = JSON.parse(((await shop.collection("private").doc("chairs").get()).data()?.json as string) || "[]") as { id: string; label: string; barberId?: string; barberName?: string; locationId?: string; sharePct?: number; shareSet?: boolean }[];
const claims = (await shop.collection("remitClaims").get()).docs.map((d) => d.data() as { bookingIds: string[] });
const claimed = new Set(claims.flatMap((c) => c.bookingIds || []));
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
// v1.0.25 claim rule, independently: any paid method is claimable; claims without rule 2 listed cash only, so their
// GCash visits follow the day's claim (same barber + location, day inside the claim's range, made before the claim).
{ const raw = (await shop.collection("remitClaims").get()).docs.map((d) => d.data() as { barberId: string; locationId?: string; from: number; to: number; claimedAt: number; rule?: number });
  for (const r of rows) {
    if (claimed.has(r.id) || (r.payMethod ?? "cash") === "cash" || r.status !== "done" || !r.completedAt) continue;
    const d = ymd(r.completedAt), made = Math.max(r.completedAt, r.createdAt || 0);
    if (raw.some((c) => c.rule !== 2 && c.barberId === r.barberId && (c.locationId || "home") === (r.locationId || "home") && Number.isFinite(c.from) && Number.isFinite(c.to) && d >= ymd(c.from) && d <= ymd(c.to) && made <= c.claimedAt)) claimed.add(r.id);
  } }
// Independent rule (no app code): pct = visit's stamped splitPct, else the barber chair's set %, else none.
const chairPct = (r: { barberId?: string; locationId?: string }) => {
  if (!r.barberId) return null;
  const m = (c: (typeof chairs)[number]) => c.barberId === r.barberId || c.id === r.barberId;
  const c = chairs.find((x) => m(x) && (x.locationId || "home") === (r.locationId || "home")) ?? chairs.find(m);
  if (!c || c.sharePct == null) return null; const n = Math.round(Number(c.sharePct)); return c.shareSet === true || n !== 50 ? n : null;
};
const pctOf = (r: { splitPct?: number | null; barberId?: string; locationId?: string }) => (r.splitPct !== undefined ? r.splitPct : chairPct(r));
const ind = new Map<string, { owner: number; barber: number; tips: number; cash: number; cashClaimed: number; n: number }>();
const W0 = weekBounds(-1).from, W1 = weekBounds(0).to;
for (const r of rows) {
  if (r.status !== "done" || !r.completedAt || r.completedAt < W0 || r.completedAt >= W1) continue;
  const p = r.price || 0, pct = pctOf(r); const b = pct == null ? 0 : Math.round(p * pct / 100);
  const k = `${r.barberId || "unassigned"}@${r.locationId || "home"}|${ymd(r.completedAt)}`;
  const v = ind.get(k) ?? { owner: 0, barber: 0, tips: 0, cash: 0, cashClaimed: 0, n: 0 };
  v.owner += p - b; v.barber += pct == null ? p : b; v.tips += Math.max(0, Math.round(Number(r.tip) || 0)); v.n++;
  if (r.paid && p > 0) { if (claimed.has(r.id)) v.cashClaimed += p - b; else v.cash += p - b; }
  ind.set(k, v);
}
const branches = [{ id: "home", name: "Main" }];
const res: { path: string; checked: number; mismatches: number; sample?: string }[] = [];
const check = (path: string, pairs: [string, number, number][]) => { const bad = pairs.filter(([, a, b]) => a !== b); res.push({ path, checked: pairs.length, mismatches: bad.length, sample: bad.slice(0, 3).map(([k, a, b]) => `${k}: app ${a} vs ind ${b}`).join("; ") || undefined }); };
// 1) Profit grid (and Home weekly card = same profitWeek, daily = column sums)
for (const off of [-1, 0]) {
  const w = profitWeek(rows, chairs as never, "all", off, Date.now(), branches);
  const pairs: [string, number, number][] = [];
  for (const row of w.rows) row.days.forEach((amt, i) => { const day = w.days[i]!.key; const k = `${row.id}@${row.locationId}|${day}`; pairs.push([k, amt, ind.get(k)?.owner ?? 0]); });
  check(`Profit grid week ${off}`, pairs);
  const daily: [string, number, number][] = w.days.map((d, i) => [d.key, w.daily[i] ?? 0, [...ind.entries()].filter(([k]) => k.endsWith(`|${d.key}`)).reduce((s, [, v]) => s + v.owner, 0)]);
  check(`Home weekly card week ${off}`, daily);
}
// 2) Sales Performance / My Barbers: owner split rows summed per barber/day
const split = asOwnerSplit(rows, chairs);
const perf = new Map<string, number>();
for (const r of split) if (r.status === "done" && r.completedAt && r.completedAt >= W0 && r.completedAt < W1) { const k = `${r.barberId || "unassigned"}@${r.locationId || "home"}|${ymd(r.completedAt)}`; perf.set(k, (perf.get(k) ?? 0) + r.price); }
check("Sales Performance (owner split rows)", [...ind.entries()].map(([k, v]) => [k, perf.get(k) ?? 0, v.owner]));
const stats = barberStats(split, "week", "all", branches, chairs);
const last7 = (() => { const t0 = Date.parse(`${ymd(Date.now())}T00:00:00+08:00`) - 6 * 86_400_000; return [...ind.entries()].filter(([k]) => Date.parse(`${k.split("|")[1]}T00:00:00+08:00`) >= t0); })();
check("My Barbers ranking (7 days)", stats.map((s) => [s.id, s.sales, last7.filter(([k]) => k.startsWith(`${s.id}@`)).reduce((a, [, v]) => a + v.owner, 0)]));
// 3) Claim sheet per barber/day
check("Claim sheet (open + claimed owner share, barbers only)", [...ind.entries()].filter(([k]) => !k.startsWith("unassigned") && !k.startsWith("owner@")).map(([k, v]) => { const [bl, day] = k.split("|"); const [bid, loc] = bl!.split("@"); const c = dayClaim(rows, chairs, bid!, loc!, day!, (v: { id: string }) => claimed.has(v.id)); return [k, c.open * 1e6 + c.claimed, v.cash * 1e6 + v.cashClaimed]; }));
// 4) Barber side (server): My sales weekly + History per day
const barb = asBarberSplit(rows, chairs);
const pairsMy: [string, number, number][] = []; const pairsHist: [string, number, number][] = []; const pairsUnc: [string, number, number][] = [];
for (const c of chairs) {
  const bid = c.barberId || c.id, loc = c.locationId || "home";
  for (const off of [-1, 0]) {
    const w = weekBounds(off); const from = ymd(w.from), to = ymd(w.to - 1);
    const p = await barberPerformance(UID, { range: "custom", from, to, barberId: bid, chairId: c.id, locationId: loc });
    for (const d of p.byDate ?? []) { const v = ind.get(`${bid}@${loc}|${d.date}`); pairsMy.push([`${c.label} ${d.date}`, d.earnings, v ? v.barber : 0]); }
  }
  for (const [k, v] of ind) { if (!k.startsWith(`${bid}@${loc}|`)) continue; const day = k.split("|")[1]!; const h = await barberDayCuts(UID, { date: day, barberId: bid, locationId: loc, chairId: c.id }); pairsHist.push([`${c.label} ${day}`, dayOf(day, h.rows, h.sharePct).earnings, v.barber]); }
  void barb;
}
check("Barber My sales weekly (server)", pairsMy);
check("Barber History per day (server + dayOf)", pairsHist);
// 5) Remit unclaimed owner share (all time) vs independent
const rs = await remitSummary(UID, "all");
const indUnc = new Map<string, number>();
for (const r of rows) { if (r.status !== "done" || !r.paid || !(r.price > 0) || claimed.has(r.id) || !r.barberId || r.barberId === "owner") continue; const pct = pctOf(r); const k = `${r.barberId}@${r.locationId || "home"}`; indUnc.set(k, (indUnc.get(k) ?? 0) + r.price - (pct == null ? 0 : Math.round(r.price * pct / 100))); }
for (const u of rs.unclaimed) pairsUnc.push([`${u.barberId}@${u.locationId}`, u.ownerShare, indUnc.get(`${u.barberId}@${u.locationId}`) ?? 0]);
check("My Barbers unclaimed remit (server)", pairsUnc);
// 6) AI data
const ai = await loadShopData(UID, "Bossing", "partner");
const aiMap = new Map<string, number>();
for (const r of ai.bookings) if (r.status === "done" && r.completedAt && r.completedAt >= W0 && r.completedAt < W1) { const k = `${r.barberId || "unassigned"}@${r.locationId || "home"}|${ymd(r.completedAt)}`; aiMap.set(k, (aiMap.get(k) ?? 0) + r.price); }
check("AI data (owner split)", [...ind.entries()].map(([k, v]) => [k, aiMap.get(k) ?? 0, v.owner]));
// invariant: owner + barber = price for split visits
let inv = 0, invBad = 0; for (const r of rows) { if (r.status !== "done") continue; const pct = pctOf(r); if (pct == null) continue; inv++; const b = Math.round(r.price * pct / 100); if (b + (r.price - b) !== r.price) invBad++; }
res.push({ path: "Invariant owner+barber = price (split visits)", checked: inv, mismatches: invBad });
console.table(res);
process.exit(0);
