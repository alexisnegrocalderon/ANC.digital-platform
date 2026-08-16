import { afterEach, describe, expect, it } from "vitest";
import { createContext } from "./context";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function requestWithBusinessHeader(value: string) {
  return {
    header: (name: string) => (name.toLowerCase() === "x-business-id" ? value : undefined),
    headers: { "x-business-id": value },
    protocol: "http",
  } as never;
}

describe("request business context", () => {
  it("fails closed in production when only a forged business header is present", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "";
    process.env.DEV_BUSINESS_CONTEXT_ENABLED = "false";

    const context = await createContext({ req: requestWithBusinessHeader("1"), res: {} as never, info: {} as never });
    expect(context.user).toBeNull();
    expect(context.businessId).toBeNull();
    expect(context.businessRole).toBeNull();
  });

  it("allows the explicit demo context only outside production", async () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "";
    process.env.DEV_BUSINESS_CONTEXT_ENABLED = "true";

    const context = await createContext({ req: requestWithBusinessHeader("1"), res: {} as never, info: {} as never });
    expect(context.businessId).toBe(1);
    expect(context.businessRole).toBe("owner");
    expect(context.user).toBeNull();
  });
});
