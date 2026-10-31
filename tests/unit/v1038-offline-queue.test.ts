import { describe, expect, it } from "vitest";
import { clientId, createQueue, drainQueue, isNetworkError, offlineLabel } from "@/lib/offline-queue";

const memStore = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
type Row = { id: string; status: string };
const netErr = () => Object.assign(new TypeError("Failed to fetch"));

describe("v1.0.38 offline queue", () => {
  it("makes a unique id on the phone", () => {
    const ids = new Set(Array.from({ length: 200 }, () => clientId("wk-", 1000)));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^wk-1000-\w{10}$/);
  });

  it("keeps the queue across reloads (same storage key)", () => {
    const s = memStore();
    createQueue<Row>(s, "q").put({ id: "a", status: "in_chair" }, 1);
    const again = createQueue<Row>(s, "q");
    expect(again.list().map((q) => q.row)).toEqual([{ id: "a", status: "in_chair" }]);
  });

  it("one entry per visit: a newer save replaces the older one in its place", () => {
    const q = createQueue<Row>(memStore(), "q");
    q.put({ id: "a", status: "in_chair" }); q.put({ id: "b", status: "in_chair" }); q.put({ id: "a", status: "done" });
    expect(q.list().map((x) => [x.id, x.row.status])).toEqual([["a", "done"], ["b", "in_chair"]]);
  });

  it("sends in order, stops at a network error, keeps the rest", async () => {
    const q = createQueue<Row>(memStore(), "q");
    q.put({ id: "a", status: "done" }); q.put({ id: "b", status: "done" }); q.put({ id: "c", status: "done" });
    const sent: string[] = [];
    const r = await drainQueue(q, async (row) => { if (row.id === "b") throw netErr(); sent.push(row.id); });
    expect(sent).toEqual(["a"]);
    expect(r).toEqual({ sent: 1, left: 2 });
    expect(q.ids()).toEqual(["b", "c"]);
    expect(q.list()[0]!.tries).toBe(1);
    const r2 = await drainQueue(q, async (row) => { sent.push(row.id); });
    expect(sent).toEqual(["a", "b", "c"]);
    expect(r2.left).toBe(0);
  });

  it("drops a save the server refuses (not network) and goes on", async () => {
    const q = createQueue<Row>(memStore(), "q");
    q.put({ id: "a", status: "done" }); q.put({ id: "b", status: "done" });
    const refused: string[] = [];
    await drainQueue(q, async (row) => { if (row.id === "a") throw Object.assign(new Error("locked"), { status: 409 }); }, { onRefused: (row) => refused.push(row.id) });
    expect(refused).toEqual(["a"]);
    expect(q.size()).toBe(0);
  });

  it("a visit changed while its save was in flight is sent again (latest copy)", async () => {
    const q = createQueue<Row>(memStore(), "q");
    q.put({ id: "a", status: "in_chair" });
    const sent: string[] = [];
    await drainQueue(q, async (row) => { sent.push(row.status); if (row.status === "in_chair") q.put({ id: "a", status: "done" }); });
    expect(sent).toEqual(["in_chair", "done"]);
    expect(q.size()).toBe(0);
  });

  it("tells network failures from refusals", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(Object.assign(new Error("t"), { name: "TimeoutError" }))).toBe(true);
    expect(isNetworkError(Object.assign(new Error("x"), { status: 503 }))).toBe(true);
    expect(isNetworkError(Object.assign(new Error("x"), { status: 402 }))).toBe(false);
    expect(isNetworkError(Object.assign(new Error("x"), { status: 404 }))).toBe(false);
  });

  it("banner wording: haircut / haircuts", () => {
    expect(offlineLabel(1, false)).toBe("Offline, 1 haircut waiting to sync");
    expect(offlineLabel(2, false)).toBe("Offline, 2 haircuts waiting to sync");
  });
});
