import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { businesses } from "../../drizzle/schema";
import { requireDb } from "../db";
import { resolveWhatsAppCredentials, verifyWhatsAppChallenge, verifyWhatsAppWebhookSignature, extractWhatsAppStatuses } from "../../modules/notifications/whatsapp";
import { updateWhatsAppDeliveryStatuses } from "../../modules/notifications/service";

function headerValue(request: Request, name: string) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function getBusinessId(businessSlug: string) {
  const db = requireDb();
  const rows = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.slug, businessSlug), eq(businesses.status, "active")))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function handleWhatsAppVerification(businessSlug: string, request: Request, response: Response) {
  const businessId = await getBusinessId(businessSlug);
  if (!businessId) return response.status(404).send("Business not found.");
  const db = requireDb();
  let credentials;
  try {
    credentials = await resolveWhatsAppCredentials(db, businessId);
  } catch {
    return response.status(503).send("WhatsApp account is not configured.");
  }
  const mode = typeof request.query["hub.mode"] === "string" ? request.query["hub.mode"] : undefined;
  const token = typeof request.query["hub.verify_token"] === "string" ? request.query["hub.verify_token"] : undefined;
  const challenge = typeof request.query["hub.challenge"] === "string" ? request.query["hub.challenge"] : undefined;
  if (!verifyWhatsAppChallenge({ mode, token, challenge, expectedToken: credentials.verifyToken })) {
    return response.status(403).send("Forbidden.");
  }
  return response.status(200).send(challenge);
}

export async function handleWhatsAppWebhook(
  businessSlug: string,
  request: Request,
  response: Response,
) {
  const businessId = await getBusinessId(businessSlug);
  if (!businessId) return response.status(404).json({ error: "Business not found." });
  const db = requireDb();
  let credentials;
  try {
    credentials = await resolveWhatsAppCredentials(db, businessId);
  } catch {
    return response.status(503).json({ error: "WhatsApp account is not configured." });
  }
  const rawBody = Buffer.isBuffer(request.body)
    ? request.body.toString("utf8")
    : typeof request.body === "string"
      ? request.body
      : "";
  if (!rawBody) return response.status(400).json({ error: "Raw webhook body is required." });
  if (!verifyWhatsAppWebhookSignature(rawBody, headerValue(request, "x-hub-signature-256"), credentials.appSecret)) {
    return response.status(401).json({ error: "Invalid WhatsApp webhook signature." });
  }
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return response.status(400).json({ error: "Webhook payload must be valid JSON." });
  }
  const statuses = extractWhatsAppStatuses(payload);
  const updated = await updateWhatsAppDeliveryStatuses(db, statuses);
  return response.status(200).json({ received: true, statuses: statuses.length, updated: updated.length });
}
