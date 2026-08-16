import { describe, expect, it } from "vitest";
import { requireModuleEnabled } from "./trpc";

function fakeDb(enabled: boolean) {
  const query = {
    select: () => query,
    from: () => query,
    where: () => query,
    limit: async () => (enabled ? [{ enabled: true }] : []),
  };
  return query;
}

describe("module feature flag guard", () => {
  it("allows an enabled module", async () => {
    await expect(requireModuleEnabled(fakeDb(true), 1, "payments")).resolves.toBeUndefined();
  });

  it("rejects an absent or disabled module", async () => {
    await expect(requireModuleEnabled(fakeDb(false), 1, "payments")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});
