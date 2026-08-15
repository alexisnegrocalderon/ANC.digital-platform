import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { whatsappAccounts } from "../../drizzle/schema";
import type { DatabaseLike } from "../bookings/service";
import { decryptPaymentSecret, encryptPaymentSecret } from "../../server/services/paymentSecrets";

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";

export type WhatsAppCredentials = {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  defaultLanguage: string;
  templates: Record<string, string>;
};

export type WhatsAppTemplateMessage = {
  to: string;
  templateName: string;
  language: string;
  params: Record<string, string>;
};

function constantTimeHexEqual(actual: string, expected: string) {
  if (!/^[0-9a-f]+$/i.test(actual) || actual.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < actual.length; index += 1) {
    diff |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return diff === 0;
}

async function readGraphResponse(response: Response) {
  const raw = await response.text();
  let payload: any = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { raw };
  }
  if (!response.ok) {
    const message = payload?.error?.message ?? `WhatsApp Graph API returned HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return payload;
}

export function verifyWhatsAppWebhookSignature(rawBody: string, signatureHeader: string | undefined, appSecret: string) {
  if (!signatureHeader || !appSecret) return false;
  const received = signatureHeader.replace(/^sha256=/, "");
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return constantTimeHexEqual(received, expected);
}

export function verifyWhatsAppChallenge(input: {
  mode?: string;
  token?: string;
  challenge?: string;
  expectedToken: string;
}) {
  return input.mode === "subscribe" && input.token === input.expectedToken && Boolean(input.challenge);
}

export async function sendWhatsAppTemplate(credentials: WhatsAppCredentials, message: WhatsAppTemplateMessage) {
  const parameters = Object.entries(message.params).map(([parameterName, text]) => ({
    type: "text",
    parameter_name: parameterName,
    text,
  }));
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${credentials.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.to,
      type: "template",
      template: {
        name: message.templateName,
        language: { code: message.language },
        components: [{ type: "body", parameters }],
      },
    }),
  });
  const payload = await readGraphResponse(response);
  const providerMessageId = payload.messages?.[0]?.id;
  if (!providerMessageId) throw new Error("WhatsApp API did not return a message ID.");
  return { providerMessageId: String(providerMessageId), payload };
}

export async function upsertWhatsAppAccount(
  db: DatabaseLike,
  businessId: number,
  input: {
    wabaId: string;
    phoneNumberId: string;
    displayPhoneNumber?: string;
    accessToken: string;
    appSecret: string;
    verifyToken: string;
    defaultLanguage?: string;
    templates: Record<string, string>;
  },
) {
  const values = {
    businessId,
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    displayPhoneNumber: input.displayPhoneNumber,
    encryptedAccessToken: encryptPaymentSecret(input.accessToken),
    encryptedAppSecret: encryptPaymentSecret(input.appSecret),
    encryptedVerifyToken: encryptPaymentSecret(input.verifyToken),
    defaultLanguage: input.defaultLanguage ?? "es_CL",
    templates: input.templates,
    status: "active",
    updatedAt: new Date(),
  };
  const rows = await db
    .insert(whatsappAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: [whatsappAccounts.businessId, whatsappAccounts.phoneNumberId],
      set: values,
    })
    .returning({ id: whatsappAccounts.id, phoneNumberId: whatsappAccounts.phoneNumberId });
  return rows[0];
}

export async function resolveWhatsAppCredentials(db: DatabaseLike, businessId: number): Promise<WhatsAppCredentials> {
  const rows = await db
    .select()
    .from(whatsappAccounts)
    .where(and(eq(whatsappAccounts.businessId, businessId), eq(whatsappAccounts.status, "active")))
    .limit(1);
  const account = rows[0];
  if (!account) throw new Error(`No active WhatsApp account configured for business ${businessId}.`);
  return {
    wabaId: account.wabaId,
    phoneNumberId: account.phoneNumberId,
    accessToken: decryptPaymentSecret(account.encryptedAccessToken),
    appSecret: decryptPaymentSecret(account.encryptedAppSecret),
    verifyToken: decryptPaymentSecret(account.encryptedVerifyToken),
    defaultLanguage: account.defaultLanguage,
    templates: account.templates,
  };
}

export function extractWhatsAppStatuses(payload: Record<string, any>) {
  const statuses: Array<{
    providerMessageId: string;
    status: string;
    recipient?: string;
    timestamp?: string;
    errors?: unknown;
  }> = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (status.id && status.status) {
          statuses.push({
            providerMessageId: String(status.id),
            status: String(status.status),
            recipient: status.recipient_id ? String(status.recipient_id) : undefined,
            timestamp: status.timestamp ? String(status.timestamp) : undefined,
            errors: status.errors,
          });
        }
      }
    }
  }
  return statuses;
}
