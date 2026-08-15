import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./context";
import { validateRuntimeConfig } from "./config";
import { handlePaymentWebhook } from "./webhooks/payments";
import { handleWhatsAppVerification, handleWhatsAppWebhook } from "./webhooks/whatsapp";
import { processDueAppointmentNotifications } from "../modules/notifications/service";
import { requireDb } from "./db";

validateRuntimeConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT ?? 3000);

app.post(
  "/api/payments/webhooks/stripe/:businessSlug",
  express.raw({ type: "application/json", limit: "1mb" }),
  (request, response) => handlePaymentWebhook("stripe", request.params.businessSlug, request, response),
);
app.post(
  "/api/payments/webhooks/mercadopago/:businessSlug",
  express.raw({ type: "application/json", limit: "1mb" }),
  (request, response) => handlePaymentWebhook("mercadopago", request.params.businessSlug, request, response),
);
app.get(
  "/api/whatsapp/webhooks/:businessSlug",
  (request, response) => handleWhatsAppVerification(request.params.businessSlug, request, response),
);
app.post(
  "/api/whatsapp/webhooks/:businessSlug",
  express.raw({ type: "application/json", limit: "3mb" }),
  (request, response) => handleWhatsAppWebhook(request.params.businessSlug, request, response),
);

app.use(express.json({ limit: "1mb" }));
app.post("/api/internal/jobs/notifications", async (request, response) => {
  const expectedSecret = process.env.CRON_SECRET?.trim();
  const providedSecret = request.header("x-cron-secret");
  if (process.env.NODE_ENV === "production" && (!expectedSecret || providedSecret !== expectedSecret)) {
    return response.status(401).json({ error: "Unauthorized job request." });
  }
  try {
    const result = await processDueAppointmentNotifications(requireDb(), Number(request.body?.limit ?? 20));
    return response.status(200).json({ ok: true, processed: result });
  } catch (error) {
    return response.status(500).json({ error: error instanceof Error ? error.message : "Notification job failed." });
  }
});
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "anc-platform" });
});

const publicPath =
  process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "public")
    : path.resolve(__dirname, "../dist/public");
app.use(express.static(publicPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.listen(port, () => {
  console.log(`[ANC Platform] listening on http://localhost:${port}`);
});
