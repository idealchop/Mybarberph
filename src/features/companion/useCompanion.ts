"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/cloud";
import { useSession } from "@/lib/session";

export interface CompanionMessage { id: string; role: "user" | "assistant" | "tip" | "alert"; text: string; createdAt: number; locked?: boolean; pending?: boolean }
export interface CompanionQuota { unlimited: boolean; used: number; limit: number | null; remaining: number | null }
export interface CompanionGoal { id: string; text: string; kind: string; targetPhp?: number }

/** Companion chat for the signed-in owner. Guests get the intro only. */
export function useCompanion() {
  const { user } = useSession();
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [quota, setQuota] = useState<CompanionQuota | null>(null);
  const [goals, setGoals] = useState<CompanionGoal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState("");
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const d = await api("/api/companion/messages");
      setMessages(d.messages ?? []); setQuota(d.quota ?? null); setGoals(d.goals ?? []);
    } catch (e) { setError((e as Error).message); }
    setReady(true);
  }, [user]);

  useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

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
      if (/goal|target|50k|k\/month|kada buwan/i.test(t)) void load();
    } catch (e) {
      const err = e as Error & { status?: number; body?: { upgrade?: string; quota?: CompanionQuota } };
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      if (err.status === 402) { setUpgrade(err.body?.upgrade ?? "Upgrade for unlimited Companion."); if (err.body?.quota) setQuota(err.body.quota); }
      else setError(err.message);
    } finally { setBusy(false); }
  }, [busy, load]);

  return { signedIn: Boolean(user), ready: ready || !user, messages, quota, goals, busy, error, upgrade, send, reload: load };
}
