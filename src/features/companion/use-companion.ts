"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/cloud";
import { useSession } from "@/lib/session";

export interface CompanionMessage { id: string; role: "user" | "assistant" | "tip" | "alert"; text: string; createdAt: number; locked?: boolean; pending?: boolean }
export interface CompanionQuota { unlimited: boolean; used: number; limit: number | null; remaining: number | null }
export interface CompanionGoal { id: string; text: string; kind: string; targetPhp?: number }

const PAGE = 30;

/**
 * The shop's one continuous Companion thread (chat, Monday tips and alerts together).
 * Loads the newest page; older pages load on demand (scroll up). Guests see the intro only.
 */
export function useCompanion() {
  const { user } = useSession();
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [quota, setQuota] = useState<CompanionQuota | null>(null);
  const [goals, setGoals] = useState<CompanionGoal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState("");
  const [ready, setReady] = useState(false);
  const older = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const d = await api(`/api/companion/messages?limit=${PAGE}`);
      setMessages(d.messages ?? []); setHasMore(Boolean(d.hasMore)); setQuota(d.quota ?? null); setGoals(d.goals ?? []);
    } catch (e) { setError((e as Error).message); }
    setReady(true);
  }, [user]);

  useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

  /** Prepends the page before the oldest loaded message. Resolves true when rows were added. */
  const loadOlder = useCallback(async () => {
    const first = messages.find((m) => !m.pending);
    if (!user || !hasMore || older.current || !first) return false;
    older.current = true; setLoadingOlder(true);
    try {
      const d = await api(`/api/companion/messages?limit=${PAGE}&before=${first.createdAt}`);
      const rows: CompanionMessage[] = d.messages ?? [];
      setMessages((m) => [...rows.filter((r) => !m.some((x) => x.id === r.id)), ...m]);
      setHasMore(Boolean(d.hasMore));
      return rows.length > 0;
    } catch (e) { setError((e as Error).message); return false; }
    finally { older.current = false; setLoadingOlder(false); }
  }, [user, hasMore, messages]);

  const send = useCallback(async (text: string, locationId?: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setError(""); setUpgrade("");
    const temp: CompanionMessage = { id: `tmp-${Date.now()}`, role: "user", text: t, createdAt: Date.now(), pending: true };
    setMessages((m) => [...m, temp]);
    try {
      const d = await api("/api/companion/chat", { method: "POST", body: JSON.stringify({ message: t, locationId }) });
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), d.user, d.message].filter(Boolean));
      setQuota(d.quota ?? null);
      if (/goal|target|50k|k\/month|kada buwan/i.test(t)) {
        const g = await api("/api/companion/messages?limit=1").catch(() => null);
        if (g) setGoals(g.goals ?? []);
      }
    } catch (e) {
      const err = e as Error & { status?: number; body?: { upgrade?: string; quota?: CompanionQuota } };
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      if (err.status === 402) { setUpgrade(err.body?.upgrade ?? "Upgrade for unlimited Companion."); if (err.body?.quota) setQuota(err.body.quota); }
      else setError(err.message);
    } finally { setBusy(false); }
  }, [busy]);

  return { signedIn: Boolean(user), ready: ready || !user, messages, hasMore, loadingOlder, loadOlder, quota, goals, busy, error, upgrade, send };
}
