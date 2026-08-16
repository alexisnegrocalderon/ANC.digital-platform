import { describe, expect, it } from "vitest";
import { ModuleActivationError } from "../../modules/core/activation";
import { getAdminActivationPlan } from "./moduleAdmin";

describe("module admin", () => {
  it("resolves a complete activation plan from a requested payment module", () => {
    expect(getAdminActivationPlan(["payments"]).ordered).toEqual([
      "catalogue",
      "orders",
      "payments",
    ]);
  });

  it("deduplicates shared dependencies in a preset-like request", () => {
    const plan = getAdminActivationPlan(["payments", "reservations"]);
    expect(plan.ordered).toEqual([
      "catalogue",
      "orders",
      "payments",
      "crm",
      "notifications",
      "reservations",
    ]);
  });

  it("rejects an unknown module key", () => {
    expect(() => getAdminActivationPlan(["not-a-module" as never])).toThrow(ModuleActivationError);
  });
});
