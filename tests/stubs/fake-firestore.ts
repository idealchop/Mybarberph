/** Tiny in-memory Firestore for API tests: doc/collection/where(==, >=, <)/orderBy/limit/get/getAll. No network. */
type Data = Record<string, unknown>;
export function fakeFirestore(store: Record<string, Data> = {}) {
  const docRef = (path: string) => ({
    id: path.split("/").pop()!,
    path,
    get: async () => ({ id: path.split("/").pop()!, exists: path in store, data: () => store[path] }),
    set: async (v: Data) => { store[path] = v; },
    collection: (n: string) => coll(`${path}/${n}`),
  });
  const coll = (path: string, filters: ((d: Data) => boolean)[] = [], order?: [string, "asc" | "desc"], lim?: number) => ({
    doc: (id: string) => docRef(`${path}/${id}`),
    where: (f: string, op: string, v: unknown) => coll(path, [...filters, (d) => {
      const x = d[f] as number;
      return op === "==" ? d[f] === v : op === ">=" ? x >= (v as number) : op === "<" ? x < (v as number) : false;
    }], order, lim),
    orderBy: (f: string, dir: "asc" | "desc" = "asc") => coll(path, filters, [f, dir], lim),
    limit: (n: number) => coll(path, filters, order, n),
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
  return {
    store,
    collection: (n: string) => coll(n),
    getAll: async (...refs: { get: () => Promise<unknown> }[]) => Promise.all(refs.map((r) => r.get())),
  };
}
