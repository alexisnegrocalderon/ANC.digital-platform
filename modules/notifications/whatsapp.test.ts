import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractWhatsAppStatuses,
  sendWhatsAppTemplate,
  verifyWhatsAppChallenge,
  verifyWhatsAppWebhookSignature,
} from "./whatsapp";

const credentials = {
  wabaId: "waba-test",
  phoneNumberId: "phone-test",
  accessToken: "token-test",
  appSecret: "app-secret-test",
  verifyToken: "verify-test",
  defaultLanguage: "es_CL",
  templates: { "appointment.confirmed": "appointment_confirmed" },
};

afterEach(() => vi.unstubAllGlobals());

describe("WhatsApp adapter", () => {
  it("verifies Meta HMAC over the raw body", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const signature = createHmac("sha256", credentials.appSecret).update(body).digest("hex");
    expect(verifyWhatsAppWebhookSignature(body, `sha256=${signature}`, credentials.appSecret)).toBe(true);
    expect(verifyWhatsAppWebhookSignature(`${body} `, `sha256=${signature}`, credentials.appSecret)).toBe(false);
  });

  it("verifies the subscription challenge", () => {
    expect(verifyWhatsAppChallenge({ mode: "subscribe", token: "verify-test", challenge: "123", expectedToken: "verify-test" })).toBe(true);
    expect(verifyWhatsAppChallenge({ mode: "subscribe", token: "wrong", challenge: "123", expectedToken: "verify-test" })).toBe(false);
  });

  it("sends a utility template with named parameters", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.template.name).toBe("appointment_confirmed");
      expect(body.template.language.code).toBe("es_CL");
      expect(body.template.components[0].parameters[0].parameter_name).toBe("customer_name");
      return new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendWhatsAppTemplate(credentials, {
      to: "+56912345678",
      templateName: "appointment_confirmed",
      language: "es_CL",
      params: { customer_name: "Cliente" },
    });
    expect(result.providerMessageId).toBe("wamid.test");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("extracts delivery status events", () => {
    const statuses = extractWhatsAppStatuses({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.test", status: "delivered" }] } }] }],
    });
    expect(statuses).toEqual([{ providerMessageId: "wamid.test", status: "delivered", recipient: undefined, timestamp: undefined, errors: undefined }]);
  });
});
