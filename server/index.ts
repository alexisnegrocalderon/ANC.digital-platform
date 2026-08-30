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
import { processDueEmailNotifications } from "../modules/mailing/service";
import { processDueInstallmentReminders } from "../modules/agency-billing/service";
import { handleAgencySubscriptionWebhook } from "../modules/agency-billing/webhook";
import { requireDb } from "./db";
import { registerAuthRoutes } from "./auth";
import { registerWebauthnRoutes } from "./webauthn";
import { registerPasswordAuthRoutes } from "./passwordAuth";
import { registerControlPlaneRoutes } from "./controlPlaneRouter";

validateRuntimeConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT ?? 3000);

registerAuthRoutes(app);
registerWebauthnRoutes(app);
registerPasswordAuthRoutes(app);

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
app.post(
  "/api/payments/webhooks/mercadopago-subscription/:businessSlug",
  express.raw({ type: "application/json", limit: "1mb" }),
  (request, response) => handleAgencySubscriptionWebhook(request.params.businessSlug, request, response),
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
registerControlPlaneRoutes(app);
app.post("/api/internal/jobs/notifications", async (request, response) => {
  const expectedSecret = process.env.CRON_SECRET?.trim();
  const providedSecret = request.header("x-cron-secret");
  if (process.env.NODE_ENV === "production" && (!expectedSecret || providedSecret !== expectedSecret)) {
    return response.status(401).json({ error: "Unauthorized job request." });
  }
  try {
    const limit = Number(request.body?.limit ?? 20);
    const db = requireDb();
    const [appointmentNotifications, emailNotifications, installmentReminders] = await Promise.all([
      processDueAppointmentNotifications(db, limit),
      processDueEmailNotifications(db, limit),
      processDueInstallmentReminders(db, limit),
    ]);
    return response.status(200).json({
      ok: true,
      processed: {
        appointmentNotifications,
        emailNotifications,
        installmentReminders,
      },
    });
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

const publicPath = process.env.VERCEL
  ? // Under @vercel/node, `includeFiles` are placed relative to the project root and the
    // function executes with `process.cwd()` set to that root — not to the bundled file's
    // own directory, so the __dirname-based logic below doesn't resolve correctly here.
    path.resolve(process.cwd(), "dist/public")
  : // Both dev (`server/index.ts` via tsx) and the built server (`server-dist/index.js`)
    // sit one directory above the repo root's `dist/public`, so the same relative path works
    // for both — the server bundle output is intentionally kept out of `dist/` so it can never
    // collide with (or be served as) a static asset alongside the Vite build.
    path.resolve(__dirname, "../dist/public");
app.use(express.static(publicPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`[ANC Platform] listening on http://localhost:${port}`);
  });
}

export default app;
