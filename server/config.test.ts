import { describe, expect, it } from "vitest";
import { validateRuntimeConfig } from "./config";

describe("runtime config", () => {
  it("allows local development without Neon or mailing credentials", () => {
    expect(
      validateRuntimeConfig({ NODE_ENV: "development", DEV_BUSINESS_CONTEXT_ENABLED: "true" }),
    ).toEqual({
      production: false,
      databaseConfigured: false,
      demoContextEnabled: true,
      mailingEnabled: false,
    });
  });

  it("requires Neon in production", () => {
    expect(() => validateRuntimeConfig({ NODE_ENV: "production" })).toThrow(
      "DATABASE_URL is required in production.",
    );
  });

  it("rejects the demo context in production", () => {
    expect(() =>
      validateRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_URL: "configured",
        DEV_BUSINESS_CONTEXT_ENABLED: "true",
      }),
    ).toThrow("DEV_BUSINESS_CONTEXT_ENABLED must be disabled in production.");
  });

  it("requires Resend credentials when mailing is enabled in production", () => {
    expect(() =>
      validateRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_URL: "configured",
        PUBLIC_APP_URL: "https://staging.example.com",
        PAYMENTS_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
        CRON_SECRET: "cron-secret",
        JWT_SECRET: "jwt-secret",
        VITE_APP_ID: "anc-platform",
        OAUTH_SERVER_URL: "https://oauth.example.com",
        VITE_OAUTH_PORTAL_URL: "https://oauth.example.com",
        CONTROL_PLANE_PUBLIC_KEY: "-----BEGIN PUBLIC KEY----- test -----END PUBLIC KEY-----",
        CONTROL_PLANE_ISSUER: "anc-official-admin",
        CONTROL_PLANE_AUDIENCE: "anc-platform-core",
        MAILING_ENABLED: "true",
      }),
    ).toThrow("RESEND_API_KEY is required in production when mailing is enabled.");
  });

  it("rejects the Resend test sender in production", () => {
    expect(() =>
      validateRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_URL: "configured",
        PUBLIC_APP_URL: "https://staging.example.com",
        PAYMENTS_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
        CRON_SECRET: "cron-secret",
        JWT_SECRET: "jwt-secret",
        VITE_APP_ID: "anc-platform",
        OAUTH_SERVER_URL: "https://oauth.example.com",
        VITE_OAUTH_PORTAL_URL: "https://oauth.example.com",
        CONTROL_PLANE_PUBLIC_KEY: "-----BEGIN PUBLIC KEY----- test -----END PUBLIC KEY-----",
        CONTROL_PLANE_ISSUER: "anc-official-admin",
        CONTROL_PLANE_AUDIENCE: "anc-platform-core",
        MAILING_ENABLED: "true",
        RESEND_API_KEY: "re_test_key",
        RESEND_FROM_EMAIL: "ANC <onboarding@resend.dev>",
      }),
    ).toThrow("RESEND_FROM_EMAIL must use a verified client domain in production.");
  });
});
