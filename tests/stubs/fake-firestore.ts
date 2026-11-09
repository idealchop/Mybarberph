/** Tiny in-memory Firestore for API tests: doc/collection/where(==, >=, <)/orderBy/limit/get/getAll/batch/runTransaction. No network. */
let autoId = 0;
type Data = Record<string, unknown>;
export function fakeFirestore(store: Record<string, Data> = {}) {
  const docRef = (path: string) => ({
    id: path.split("/").pop()!,
    path,
    get: async () => ({ id: path.split("/").pop()!, exists: path in store, data: () => store[path] }),
    set: async (v: Data, opts?: { merge?: boolean }) => { store[path] = opts?.merge ? { ...(store[path] ?? {}), ...v } : v; },
    delete: async () => { delete store[path]; },
    get firestore() { return db; },
    collection: (n: string) => coll(`${path}/${n}`),
  });
  const coll = (path: string, filters: ((d: Data) => boolean)[] = [], order?: [string, "asc" | "desc"], lim?: number) => ({
    doc: (id?: string) => docRef(`${path}/${id ?? `auto${++autoId}`}`),
    where: (f: string, op: string, v: unknown) => coll(path, [...filters, (d) => {
      const x = d[f] as number;
      if (op === "==") return d[f] === v;
      if (op === ">=") return x >= (v as number);
      if (op === ">") return x > (v as number);
      if (op === "<=") return x <= (v as number);
      if (op === "<") return x < (v as number);
      if (op === "in") return Array.isArray(v) && (v as unknown[]).includes(d[f]);
      return false;
    }], order, lim),
    orderBy: (f: string, dir: "asc" | "desc" = "asc") => coll(path, filters, [f, dir], lim),
    limit: (n: number) => coll(path, filters, order, n),
    select: () => coll(path, filters, order, lim),
    get: async () => {
      let docs = Object.entries(store)
        .filter(([k]) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes("/"))
        .map(([k, data]) => ({ id: k.split("/").pop()!, data: () => data, ref: docRef(k) }))
        .filter((d) => filters.every((f) => f(d.data())));
      if (order) docs = docs.sort((a, b) => ((a.data()[order[0]] as number) - (b.data()[order[0]] as number)) * (order[1] === "desc" ? -1 : 1));
      if (lim) docs = docs.slice(0, lim);
      return { docs, empty: docs.length === 0 };
    },
  });
  const db = {
    store,
    collection: (n: string) => coll(n),
    getAll: async (...refs: { get: () => Promise<unknown> }[]) => Promise.all(refs.map((r) => r.get())),
    batch() {
      const ops: Array<() => void> = [];
      return {
        set(ref: { path: string }, v: Data, opts?: { merge?: boolean }) {
          ops.push(() => { store[ref.path] = opts?.merge ? { ...(store[ref.path] ?? {}), ...v } : { ...v }; });
        },
        update(ref: { path: string }, v: Data) {
          ops.push(() => {
            if (!(ref.path in store)) throw new Error(`No document to update: ${ref.path}`);
            store[ref.path] = { ...store[ref.path], ...v };
          });
        },
        delete(ref: { path: string }) {
          ops.push(() => { delete store[ref.path]; });
        },
        async commit() { for (const op of ops) op(); },
      };
    },
    runTransaction: async <T>(fn: (tx: { get: (r: { get: () => Promise<unknown> }) => Promise<unknown>; set: (r: { set: (v: Data, opts?: { merge?: boolean }) => Promise<void> }, v: Data, opts?: { merge?: boolean }) => void }) => Promise<T>) =>
      fn({ get: (r) => r.get(), set: (r, v, opts) => { void r.set(v, opts); }, delete: (r: { delete: () => Promise<void> }) => { void r.delete(); } } as never),
  };
  return db;
}
