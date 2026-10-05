/**
 * Outbound SMS via Brevo transactional SMS when credentials exist.
 * Without keys, messages are queued to Firestore (status failed + error) so the
 * product path still works end-to-end; configure BREVO_SMS_API_KEY + BREVO_SMS_SENDER.
 */

export type SmsResult = {
  ok: boolean;
  provider: "brevo" | "queued";
  error?: string;
  messageId?: string;
};

function normalizePh(to: string): string {
  const digits = to.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+63${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `+63${digits}`;
  if (to.startsWith("+")) return to;
  return `+${digits}`;
}

export async function sendSms(input: { to: string; body: string }): Promise<SmsResult> {
  const apiKey = process.env.BREVO_SMS_API_KEY || process.env.BREVO_API_KEY || "";
  const sender = process.env.BREVO_SMS_SENDER || "BarbersPH";
  const enabled = (process.env.BARBERS_SMS_ENABLED || "").toLowerCase() === "true" || Boolean(apiKey);
  const to = normalizePh(input.to);

  if (!apiKey || !enabled) {
    return {
      ok: false,
      provider: "queued",
      error: "SMS not configured. Set BREVO_SMS_API_KEY and BARBERS_SMS_ENABLED=true (optional BREVO_SMS_SENDER).",
    };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender,
        recipient: to,
        content: input.body,
        type: "transactional",
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, provider: "brevo", error: `Brevo ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => ({}))) as { messageId?: string; reference?: string };
    return { ok: true, provider: "brevo", messageId: json.messageId || json.reference };
  } catch (e) {
    return { ok: false, provider: "brevo", error: e instanceof Error ? e.message : "SMS send failed" };
  }
}
