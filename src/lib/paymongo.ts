/** PayMongo secret for server-side checkout. Empty = demo plan selection only. */
export function paymongoSecret(): string {
  return (process.env.PAYMONGO_SECRET_KEY || process.env.PAYMONGO_SECRET || "").trim();
}

export function hasPaymongo(): boolean {
  return Boolean(paymongoSecret());
}

export async function createPaymongoCheckout(input: {
  amountCentavos: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const secret = paymongoSecret();
  if (!secret) throw new Error("PayMongo is not configured");

  const auth = Buffer.from(`${secret}:`).toString("base64");
  const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          description: input.description,
          line_items: [
            {
              currency: "PHP",
              amount: input.amountCentavos,
              name: input.description,
              quantity: 1,
            },
          ],
          payment_method_types: ["card", "gcash", "paymaya", "grab_pay"],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: input.metadata,
        },
      },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string; attributes?: { checkout_url?: string } };
    errors?: { detail?: string }[];
  };
  if (!res.ok) {
    throw new Error(json.errors?.[0]?.detail || `PayMongo ${res.status}`);
  }
  const checkoutUrl = json.data?.attributes?.checkout_url;
  const sessionId = json.data?.id;
  if (!checkoutUrl || !sessionId) throw new Error("PayMongo returned no checkout URL");
  return { checkoutUrl, sessionId };
}
