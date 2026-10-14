import "server-only";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { normalizePlan } from "@/lib/plans";
import { effectivePlan, ensureShop, shopRef, type ShopDoc } from "@/lib/server/shops";
import { addUsage, generate, MODEL, USD_TO_PHP, zeroUsage, type Content, type Part, type Usage } from "./gemini";
import * as T from "./data";
import { SYSTEM_PROMPT, TIPS_PROMPT } from "./prompt";

/**
 * Storage (all under the owner's shop; Firestore rules: owner-only read, server-only write):
 *   shops/{uid}/companion/memory              goals + facts the owner asked the Companion to remember
 *   shops/{uid}/companion/thread                the one continuous chat per shop (updatedAt)
 *   shops/{uid}/companion/thread/messages/{id}  every message: user, assistant, tip, alert
 *   shops/{uid}/companion/usage-{weekId}      Gemini tokens + cost for that ISO week
 *   shops/{uid}/companion/quota-{YYYY-MM}     Partner question count for that month
 *   shops/{uid}/insights/{weekId}             Monday tips (+ alerts) for that week
 */
export const PARTNER_MONTHLY_QUESTIONS = 10;
export const PARTNER_WEEKLY_TIPS = 1;

export interface Message { id: string; role: "user" | "assistant" | "tip" | "alert"; text: string; createdAt: number; weekId?: string; locked?: boolean }

const companion = (uid: string) => shopRef(uid).collection("companion");
const memoryRef = (uid: string) => companion(uid).doc("memory");
const threadRef = (uid: string) => companion(uid).doc("thread");
const messagesRef = (uid: string) => threadRef(uid).collection("messages");
const id = () => `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
/** Gemini sees only the most recent messages (plus goals in the system context). */
const CONTEXT_MESSAGES = 12;

export function isPaid(plan: string) { return normalizePlan(plan) !== "partner"; }

/** ISO week in Manila, e.g. 2026-W42. */
export function weekId(ms = Date.now()) {
  const d = new Date(T.manilaDay(ms) + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear();
  const wk = Math.ceil(((d.getTime() - Date.UTC(y, 0, 1)) / 86_400_000 + 1) / 7);
  return `${y}-W${String(wk).padStart(2, "0")}`;
}
const monthId = (ms = Date.now()) => T.manilaDay(ms).slice(0, 7);

export async function loadMemory(uid: string): Promise<{ goals: T.Goal[]; facts: string[] }> {
  const d = (await memoryRef(uid).get()).data() ?? {};
  return { goals: Array.isArray(d.goals) ? d.goals : [], facts: Array.isArray(d.facts) ? d.facts : [] };
}

/** Newest page of the thread, or the page before `before` (createdAt ms). Returned oldest first. */
export async function listMessages(uid: string, opts: { limit?: number; before?: number } = {}) {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 30));
  let q = messagesRef(uid).orderBy("createdAt", "desc");
  if (opts.before) q = q.where("createdAt", "<", opts.before);
  const snap = await q.limit(limit + 1).get();
  const rows = snap.docs.slice(0, limit).map((d) => d.data() as Message).reverse();
  return { messages: rows, hasMore: snap.docs.length > limit };
}

async function addMessage(uid: string, m: Omit<Message, "id" | "createdAt"> & { createdAt?: number }) {
  const row: Message = { id: id(), createdAt: Date.now(), ...m };
  await messagesRef(uid).doc(row.id).set(row);
  await threadRef(uid).set({ updatedAt: row.createdAt }, { merge: true });
  return row;
}

export async function quota(uid: string, plan: string) {
  if (isPaid(plan)) return { unlimited: true as const, used: 0, limit: null, remaining: null };
  const used = ((await companion(uid).doc(`quota-${monthId()}`).get()).data()?.questions as number) ?? 0;
  return { unlimited: false as const, used, limit: PARTNER_MONTHLY_QUESTIONS, remaining: Math.max(0, PARTNER_MONTHLY_QUESTIONS - used) };
}

export async function logUsage(uid: string, u: Usage, kind: "chat" | "tips") {
  if (!u.calls) return;
  const w = weekId();
  await companion(uid).doc(`usage-${w}`).set({
    weekId: w, model: MODEL, updatedAt: Date.now(),
    calls: FieldValue.increment(u.calls), inputTokens: FieldValue.increment(u.inputTokens), outputTokens: FieldValue.increment(u.outputTokens),
    costUsd: FieldValue.increment(u.costUsd), costPhp: FieldValue.increment(u.costUsd * USD_TO_PHP),
    [`${kind}Calls`]: FieldValue.increment(u.calls),
  }, { merge: true });
}

const num = { type: "NUMBER" }, str = { type: "STRING" };
const ranged = (desc: string, extra: Record<string, unknown> = {}) => ({
  type: "OBJECT", description: desc,
  properties: { days: { ...num, description: "Look-back window in days (1-120)." }, locationId: { ...str, description: "Branch id from the shop context, or 'all' for combined." }, ...extra },
});
const DECLS = [
  { name: "getSales", description: "Sales (PHP), cuts, average ticket, unpaid amount and day-by-day totals vs the previous equal period.", parameters: ranged("Sales window") },
  { name: "getBookings", description: "Booking counts by status, walk-in vs online, source, hour of day and weekday.", parameters: ranged("Bookings window") },
  { name: "topServices", description: "Best-selling services by revenue and count.", parameters: ranged("Services window", { limit: num }) },
  { name: "staffPerformance", description: "Per-barber revenue, cuts, average ticket, chair use % and rebooking rate %.", parameters: ranged("Staff window") },
  { name: "branchComparison", description: "Sales per branch side by side.", parameters: { type: "OBJECT", properties: { days: num } } },
  { name: "inactiveCustomers", description: "Customers who haven't come back in N days. Set includeContacts=true ONLY when the owner explicitly asks for names or numbers.", parameters: ranged("Inactive window", { includeContacts: { type: "BOOLEAN" } }) },
  { name: "goalProgress", description: "The owner's saved goals and progress this month (sales so far, projection, needed per day).", parameters: { type: "OBJECT", properties: {} } },
  { name: "rememberGoal", description: "Save a goal the owner states (e.g. PHP 50k/month). Only Companion memory; never business data.", parameters: { type: "OBJECT", properties: { kind: { type: "STRING", enum: ["monthly_sales", "weekly_cuts", "custom"] }, targetPhp: num, targetCount: num, text: str }, required: ["kind", "text"] } },
];
const PRO_ONLY = new Set(["branchComparison", "rememberGoal"]);
const CONTACT_ASK = /\b(name|names|number|numbers|contact|contacts|phone|list|sino|sinu|pangalan|numero|text them|i-text|itext)\b/i;

async function runTool(uid: string, data: T.ShopData, name: string, args: Record<string, unknown>, paid: boolean, lastUserText: string) {
  if (!paid && PRO_ONLY.has(name)) return { error: "This needs Pro or Lifetime. Tell the owner they can upgrade in Settings > Billing." };
  const a = args as never;
  switch (name) {
    case "getSales": return T.getSales(data, a);
    case "getBookings": return T.getBookings(data, a);
    case "topServices": return T.topServices(data, a);
    case "staffPerformance": return T.staffPerformance(data, a);
    case "branchComparison": return T.branchComparison(data, a);
    case "inactiveCustomers": return T.inactiveCustomers(data, a, CONTACT_ASK.test(lastUserText));
    case "goalProgress": return T.goalProgress(data, (await loadMemory(uid)).goals);
    case "rememberGoal": {
      const g: T.Goal = { id: id(), kind: (["monthly_sales", "weekly_cuts", "custom"].includes(String(args.kind)) ? args.kind : "custom") as T.Goal["kind"], targetPhp: Number(args.targetPhp) || undefined, targetCount: Number(args.targetCount) || undefined, text: String(args.text ?? "").slice(0, 200), createdAt: Date.now() };
      if (g.kind === "monthly_sales" && g.targetPhp) g.text = `₱${g.targetPhp.toLocaleString("en-PH")}/month sales`;
      if (g.kind === "weekly_cuts" && g.targetCount) g.text = `${g.targetCount} cuts/week`;
      const mem = await loadMemory(uid);
      const goals = [...mem.goals.filter((x) => x.kind !== g.kind || g.kind === "custom"), g].slice(-5);
      await memoryRef(uid).set({ goals, updatedAt: Date.now() }, { merge: true });
      return { saved: g };
    }
    default: return { error: `Unknown tool ${name}` };
  }
}

function context(shop: ShopDoc, data: T.ShopData, plan: string, goals: T.Goal[]) {
  const today = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return `\n\n## This shop\nName: ${data.shopName}\nArea: ${shop.area || shop.address || "Philippines"}\nPlan: ${plan}${isPaid(plan) ? "" : " (Partner: limited Companion)"}\nToday (Manila): ${today}\nBranches: ${data.branches.map((b) => `${b.name} (id ${b.id})`).join(", ")}\nBarbers: ${data.chairs.map((c) => c.barberName).join(", ") || "none added"}\nMenu: ${(shop.menu || []).map((m) => `${m.name} ₱${m.price / 100}`).join(", ") || "not set"}\nSaved goals: ${goals.map((g) => g.text).join("; ") || "none yet"}`;
}

/** One owner question → tool calls → answer. Returns the saved assistant message. */
export async function chat(uid: string, text: string, locationId?: string) {
  const shop = await ensureShop(uid);
  const plan = effectivePlan(shop);
  const paid = isPaid(plan);
  const q = await quota(uid, plan);
  if (!q.unlimited && q.remaining <= 0) {
    return { limited: true, quota: q, message: null };
  }
  const userMsg = await addMessage(uid, { role: "user", text: text.slice(0, 2000) });
  if (!q.unlimited) await companion(uid).doc(`quota-${monthId()}`).set({ questions: FieldValue.increment(1), month: monthId() }, { merge: true });

  const [data, mem, history] = await Promise.all([T.loadShopData(uid, shop.name, plan), loadMemory(uid), listMessages(uid, { limit: CONTEXT_MESSAGES + 1 })]);
  const contents: Content[] = history.messages.filter((m) => m.id !== userMsg.id).slice(-CONTEXT_MESSAGES).map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.role === "user" ? m.text : `${m.role === "tip" ? "[Weekly tip] " : m.role === "alert" ? "[Alert] " : ""}${m.text}` }] }));
  contents.push({ role: "user", parts: [{ text: (locationId && locationId !== "all" ? `[Viewing branch id ${locationId}] ` : "") + text }] });
  const system = SYSTEM_PROMPT + context(shop, data, plan, mem.goals);
  let usage = zeroUsage();
  let answer = "";
  for (let step = 0; step < 5; step++) {
    const r = await generate({ system, contents, tools: [{ functionDeclarations: DECLS }] });
    usage = addUsage(usage, r.usage);
    const calls = r.parts.filter((p) => p.functionCall);
    if (!calls.length) { answer = r.parts.map((p) => p.text ?? "").join("").trim(); break; }
    contents.push({ role: "model", parts: r.parts });
    const responses: Part[] = [];
    for (const c of calls) {
      const fc = c.functionCall as NonNullable<Part["functionCall"]>;
      let out: unknown;
      try { out = await runTool(uid, data, fc.name, fc.args ?? {}, paid, text); } catch (e) { out = { error: (e as Error).message }; }
      responses.push({ functionResponse: { name: fc.name, response: { result: out } } });
    }
    contents.push({ role: "user", parts: responses });
  }
  await logUsage(uid, usage, "chat");
  const message = await addMessage(uid, { role: "assistant", text: answer || "Pasensya, I couldn't finish that one. Try asking again?" });
  return { limited: false, quota: await quota(uid, plan), message, user: userMsg };
}

/** Monday tips (3-5) and alerts for one shop. Idempotent per week unless force. */
export async function weeklyTips(uid: string, opts: { force?: boolean } = {}) {
  const w = weekId();
  const ref = shopRef(uid).collection("insights").doc(w);
  if (!opts.force && (await ref.get()).exists) return { skipped: "already sent", weekId: w };
  const shop = await ensureShop(uid);
  const plan = effectivePlan(shop);
  const paid = isPaid(plan);
  const data = await T.loadShopData(uid, shop.name, plan);
  const mem = await loadMemory(uid);
  const facts = {
    last7: T.getSales(data, { days: 7 }), last30: T.getSales(data, { days: 30 }), bookings7: T.getBookings(data, { days: 7 }),
    services: T.topServices(data, { days: 30, limit: 5 }), staff: T.staffPerformance(data, { days: 30 }),
    branches: data.branches.length > 1 ? T.branchComparison(data, { days: 7 }) : undefined,
    inactive: T.inactiveCustomers(data, { days: 30 }, false), goals: paid ? T.goalProgress(data, mem.goals) : undefined,
  };
  const r = await generate({ system: SYSTEM_PROMPT + context(shop, data, plan, paid ? mem.goals : []) + "\n\n" + TIPS_PROMPT, contents: [{ role: "user", parts: [{ text: `Shop numbers (JSON):\n${JSON.stringify(facts)}` }] }], json: true });
  await logUsage(uid, r.usage, "tips");
  let parsed: { tips?: string[]; alerts?: string[] } = {};
  try { parsed = JSON.parse(r.parts.map((p) => p.text ?? "").join("")); } catch { parsed = { tips: [] }; }
  const tips = (parsed.tips ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 5);
  const alerts = paid ? (parsed.alerts ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 3) : [];
  const shown = paid ? tips : tips.slice(0, PARTNER_WEEKLY_TIPS);
  const text = `Magandang umaga! Your Monday tips for this week:\n\n${shown.map((t, i) => `${i + 1}. ${t}`).join("\n")}${!paid && tips.length > shown.length ? `\n\n${tips.length - shown.length} more tips are waiting for you on Pro or Lifetime.` : ""}`;
  const msg = await addMessage(uid, { role: "tip", text, weekId: w, locked: !paid && tips.length > shown.length });
  for (const a of alerts) await addMessage(uid, { role: "alert", text: a, weekId: w });
  await ref.set({ weekId: w, createdAt: Date.now(), plan, tips: shown, hiddenTips: paid ? 0 : tips.length - shown.length, alerts, messageId: msg.id, usage: r.usage });
  return { weekId: w, tips: shown.length, alerts: alerts.length, messageId: msg.id };
}

/** Every shop that has an owner profile. Used by the Monday scheduler. */
export async function allShopIds() {
  const q = await shopRef("x").parent.select("name").get();
  return q.docs.filter((d) => (d.data().name as string | undefined)?.trim()).map((d) => d.id);
}
