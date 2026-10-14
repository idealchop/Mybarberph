import "server-only";
import { applicationDefault } from "firebase-admin/app";
import { firebaseProjectId } from "@/lib/firebase/admin";

/** Gemini on Vertex AI, called with the App Hosting runtime service account (roles/aiplatform.user). */
export const MODEL = process.env.COMPANION_MODEL || "gemini-2.5-flash";
const LOCATION = process.env.COMPANION_LOCATION || "asia-southeast1";
/** USD per 1M tokens (gemini-2.5-flash list price; thinking billed as output). */
const PRICE = { input: 0.3, output: 2.5 };
export const USD_TO_PHP = 58;

export type Part = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: { name: string; response: Record<string, unknown> } };
export interface Content { role: "user" | "model"; parts: Part[] }
export interface Usage { inputTokens: number; outputTokens: number; costUsd: number; calls: number }

let cred: ReturnType<typeof applicationDefault> | undefined;

export async function generate(body: { system: string; contents: Content[]; tools?: unknown[]; json?: boolean }) {
  cred ??= applicationDefault();
  const { access_token } = await cred.getAccessToken();
  const host = LOCATION === "global" ? "aiplatform.googleapis.com" : `${LOCATION}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${firebaseProjectId}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: body.system }] },
      contents: body.contents,
      tools: body.tools,
      generationConfig: { temperature: 0.6, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 512 }, ...(body.json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${d?.error?.message ?? "request failed"}`);
  const um = d.usageMetadata ?? {};
  const inputTokens = um.promptTokenCount ?? 0;
  const outputTokens = (um.candidatesTokenCount ?? 0) + (um.thoughtsTokenCount ?? 0);
  const usage: Usage = { inputTokens, outputTokens, calls: 1, costUsd: (inputTokens * PRICE.input + outputTokens * PRICE.output) / 1e6 };
  const parts: Part[] = d.candidates?.[0]?.content?.parts ?? [];
  return { parts, usage };
}

export const addUsage = (a: Usage, b: Usage): Usage => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, calls: a.calls + b.calls, costUsd: a.costUsd + b.costUsd });
export const zeroUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, calls: 0, costUsd: 0 });
