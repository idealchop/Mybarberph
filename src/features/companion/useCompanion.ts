"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/cloud";
import { useSession } from "@/lib/session";

export interface CompanionMessage { id: string; role: "user" | "assistant" | "tip" | "alert"; text: string; createdAt: number; locked?: boolean; pending?: boolean }
export interface CompanionQuota { unlimited: boolean; used: number; limit: number | null; remaining: number | null }
export interface CompanionGoal { id: string; text: string; kind: string; targetPhp?: number }
export interface CompanionConversation { id: string; title: string; createdAt: number; updatedAt: number; pinned?: boolean; preview?: string }

/**
 * Companion chats for the signed-in owner, saved per shop in Firestore.
 * On open the most recent chat is restored; older ones can be reopened and continued.
 * Guests see the intro only.
 */
export function useCompanion() {
  const { user } = useSession();
  const [conversations, setConversations] = useState<CompanionConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [quota, setQuota] = useState<CompanionQuota | null>(null);
  const [goals, setGoals] = useState<CompanionGoal[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState("");
  const [ready, setReady] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (c?: string) => {
    if (!user) return;
    const mine = ++seq.current;
    setLoading(true); setError("");
    try {
      const d = await api(`/api/companion/messages${c ? `?c=${encodeURIComponent(c)}` : ""}`);
      if (mine !== seq.current) return;
      setConversations(d.conversations ?? []); setConversationId(d.conversationId ?? null);
      setMessages(d.messages ?? []); setQuota(d.quota ?? null); setGoals(d.goals ?? []);
    } catch (e) { if (mine === seq.current) setError((e as Error).message); }
    if (mine === seq.current) { setLoading(false); setReady(true); }
  }, [user]);

  useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

  const open = useCallback((id: string) => { setUpgrade(""); void load(id); }, [load]);
  const newChat = useCallback(() => { seq.current++; setConversationId(null); setMessages([]); setUpgrade(""); setError(""); }, []);

  const send = useCallback(async (text: string, locationId?: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setError(""); setUpgrade("");
    const temp: CompanionMessage = { id: `tmp-${Date.now()}`, role: "user", text: t, createdAt: Date.now(), pending: true };
    setMessages((m) => [...m, temp]);
    try {
      const d = await api("/api/companion/chat", { method: "POST", body: JSON.stringify({ message: t, locationId, conversationId: conversationId ?? undefined }) });
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), d.user, d.message].filter(Boolean));
      setQuota(d.quota ?? null);
      if (d.conversation) {
        const conv = d.conversation as CompanionConversation;
        setConversationId(conv.id);
        setConversations((list) => [conv, ...list.filter((x) => x.id !== conv.id)].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt));
      }
      if (/goal|target|50k|k\/month|kada buwan/i.test(t)) {
        const g = await api(`/api/companion/messages?c=${encodeURIComponent(d.conversation?.id ?? "new")}`).catch(() => null);
        if (g) setGoals(g.goals ?? []);
      }
    } catch (e) {
      const err = e as Error & { status?: number; body?: { upgrade?: string; quota?: CompanionQuota } };
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      if (err.status === 402) { setUpgrade(err.body?.upgrade ?? "Upgrade for unlimited Companion."); if (err.body?.quota) setQuota(err.body.quota); }
      else setError(err.message);
    } finally { setBusy(false); }
  }, [busy, conversationId]);

  return { signedIn: Boolean(user), ready: ready || !user, loading, conversations, conversationId, messages, quota, goals, busy, error, upgrade, send, open, newChat };
}
