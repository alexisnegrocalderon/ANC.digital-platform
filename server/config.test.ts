import { describe, expect, it } from "vitest";
import { validateRuntimeConfig } from "./config";

describe("runtime config", () => {
  it("allows local development without Neon", () => {
    expect(
      validateRuntimeConfig({ NODE_ENV: "development", DEV_BUSINESS_CONTEXT_ENABLED: "true" }),
    ).toEqual({
      production: false,
      databaseConfigured: false,
      demoContextEnabled: true,
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
});
