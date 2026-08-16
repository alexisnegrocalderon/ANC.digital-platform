export function validateRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  const databaseConfigured = Boolean(env.DATABASE_URL?.trim());
  const demoContextEnabled = env.DEV_BUSINESS_CONTEXT_ENABLED === "true";

  if (production && !databaseConfigured) {
    throw new Error("DATABASE_URL is required in production.");
  }

  if (production && demoContextEnabled) {
    throw new Error("DEV_BUSINESS_CONTEXT_ENABLED must be disabled in production.");
  }

  if (production && !env.PUBLIC_APP_URL?.startsWith("https://")) {
    throw new Error("PUBLIC_APP_URL must be an HTTPS URL in production.");
  }

  if (production && !env.PAYMENTS_ENCRYPTION_KEY?.trim()) {
    throw new Error("PAYMENTS_ENCRYPTION_KEY is required in production.");
  }

  if (production && !env.CRON_SECRET?.trim()) {
    throw new Error("CRON_SECRET is required in production for notification jobs.");
  }

  if (production && !env.JWT_SECRET?.trim()) {
    throw new Error("JWT_SECRET is required in production for authenticated sessions.");
  }
  if (production && !env.VITE_APP_ID?.trim()) {
    throw new Error("VITE_APP_ID is required in production for Manus OAuth.");
  }
  if (production && !env.OAUTH_SERVER_URL?.startsWith("https://")) {
    throw new Error("OAUTH_SERVER_URL must be an HTTPS URL in production.");
  }
  if (production && !env.VITE_OAUTH_PORTAL_URL?.startsWith("https://")) {
    throw new Error("VITE_OAUTH_PORTAL_URL must be an HTTPS URL in production.");
  }
  if (production && !env.CONTROL_PLANE_PUBLIC_KEY?.includes("PUBLIC KEY")) {
    throw new Error("CONTROL_PLANE_PUBLIC_KEY is required in production for control-plane JWT verification.");
  }
  if (production && !env.CONTROL_PLANE_ISSUER?.trim()) {
    throw new Error("CONTROL_PLANE_ISSUER is required in production.");
  }
  if (production && !env.CONTROL_PLANE_AUDIENCE?.trim()) {
    throw new Error("CONTROL_PLANE_AUDIENCE is required in production.");
  }

  if (production && env.PAYMENTS_ENCRYPTION_KEY) {
    const encryptionKey = Buffer.from(env.PAYMENTS_ENCRYPTION_KEY, "base64");
    if (encryptionKey.length !== 32) {
      throw new Error("PAYMENTS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
    }
  }

  return {
    production,
    databaseConfigured,
    demoContextEnabled,
  } as const;
}
