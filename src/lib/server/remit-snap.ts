import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { REMIT_SNAP_V, type RemitSnap, type SnapClaim, type SnapVisit } from "@/lib/remit-snap";
import { shopRef } from "./shops";

export { REMIT_SNAP_V, buildRemitSnap, mergeRemitSnap, poolOf } from "@/lib/remit-snap";
export type { RemitSnap, SnapClaim, SnapVisit } from "@/lib/remit-snap";

const MAX_DOC = 700_000;

type Stored = { v?: number; cursor?: number; claimCursor?: number; body?: string; poolParts?: number; claimParts?: number };

function parseSnap(meta: Stored, poolJson: string, claimsJson: string): RemitSnap | null {
  if (meta.v !== REMIT_SNAP_V || !(meta.cursor && meta.cursor > 0)) return null;
  try {
    const pool = JSON.parse(poolJson) as SnapVisit[];
    const claims = JSON.parse(claimsJson) as SnapClaim[];
    if (!Array.isArray(pool) || !Array.isArray(claims)) return null;
    return { v: REMIT_SNAP_V, cursor: meta.cursor, claimCursor: meta.claimCursor ?? meta.cursor, pool, claims };
  } catch {
    return null;
  }
}

const priv = (shopId: string, id: string) => shopRef(shopId).collection("private").doc(id);

/** The saved snap, or null when this shop still needs one full read. */
export async function readRemitSnap(shopId: string): Promise<RemitSnap | null> {
  const metaSnap = await priv(shopId, "remitSnap").get();
  if (!metaSnap.exists) return null;
  const meta = metaSnap.data() as Stored;
  if (typeof meta.body === "string") {
    try {
      const body = JSON.parse(meta.body) as { pool?: SnapVisit[]; claims?: SnapClaim[] };
      return parseSnap(meta, JSON.stringify(body.pool ?? []), JSON.stringify(body.claims ?? []));
    } catch {
      return null;
    }
  }
  const poolN = meta.poolParts ?? 0;
  const claimN = meta.claimParts ?? 0;
  const refs = [
    ...Array.from({ length: poolN }, (_, i) => priv(shopId, `remitSnapP${i}`)),
    ...Array.from({ length: claimN }, (_, i) => priv(shopId, `remitSnapC${i}`)),
  ];
  const snaps = refs.length ? await adminDb().getAll(...refs) : [];
  const json = (s: { data: () => unknown }) => (typeof (s.data() as { json?: string } | undefined)?.json === "string" ? (s.data() as { json: string }).json : "[]");
  const pool = snaps.slice(0, poolN).map((s) => json(s as never)).map((j) => JSON.parse(j) as SnapVisit[]).flat();
  const claims = snaps.slice(poolN).map((s) => json(s as never)).map((j) => JSON.parse(j) as SnapClaim[]).flat();
  return parseSnap(meta, JSON.stringify(pool), JSON.stringify(claims));
}

function chunk<T>(items: T[], max: number): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let size = 2;
  for (const item of items) {
    const n = JSON.stringify(item).length + 1;
    if (cur.length && size + n > max) { out.push(cur); cur = []; size = 2; }
    cur.push(item);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Replaces the snap. One doc when it fits; otherwise chunked private docs (still far smaller than every visit). */
export async function writeRemitSnap(shopId: string, snap: RemitSnap): Promise<void> {
  const metaRef = priv(shopId, "remitSnap");
  const prev = ((await metaRef.get()).data() as Stored | undefined) ?? {};
  const body = JSON.stringify({ pool: snap.pool, claims: snap.claims });
  const batch = adminDb().batch();
  const drop = (n: number | undefined, prefix: string) => {
    for (let i = 0; i < (n ?? 0); i++) batch.delete(priv(shopId, `${prefix}${i}`));
  };
  if (body.length <= MAX_DOC) {
    batch.set(metaRef, { v: snap.v, cursor: snap.cursor, claimCursor: snap.claimCursor, body, poolParts: 0, claimParts: 0 });
    drop(prev.poolParts, "remitSnapP");
    drop(prev.claimParts, "remitSnapC");
    await batch.commit();
    return;
  }
  const pools = chunk(snap.pool, MAX_DOC);
  const claims = chunk(snap.claims, MAX_DOC);
  batch.set(metaRef, { v: snap.v, cursor: snap.cursor, claimCursor: snap.claimCursor, poolParts: pools.length, claimParts: claims.length });
  pools.forEach((part, i) => batch.set(priv(shopId, `remitSnapP${i}`), { json: JSON.stringify(part) }));
  claims.forEach((part, i) => batch.set(priv(shopId, `remitSnapC${i}`), { json: JSON.stringify(part) }));
  for (let i = pools.length; i < (prev.poolParts ?? 0); i++) batch.delete(priv(shopId, `remitSnapP${i}`));
  for (let i = claims.length; i < (prev.claimParts ?? 0); i++) batch.delete(priv(shopId, `remitSnapC${i}`));
  await batch.commit();
}
