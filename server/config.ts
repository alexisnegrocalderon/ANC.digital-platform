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

  return {
    production,
    databaseConfigured,
    demoContextEnabled,
  } as const;
}
