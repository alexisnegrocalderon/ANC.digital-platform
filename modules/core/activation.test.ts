import { describe, expect, it } from "vitest";
import { ModuleActivationError, resolveActivationPlan } from "./activation";

describe("module activation", () => {
  it("orders dependencies before requested modules", () => {
    const plan = resolveActivationPlan(["ticketing"]);

    expect(plan.ordered.indexOf("catalogue")).toBeLessThan(plan.ordered.indexOf("orders"));
    expect(plan.ordered.indexOf("orders")).toBeLessThan(plan.ordered.indexOf("access"));
    expect(plan.ordered.at(-1)).toBe("ticketing");
  });

  it("deduplicates shared dependencies", () => {
    const plan = resolveActivationPlan(["orders", "ticketing", "catalogue"]);
    expect(plan.ordered.filter((key) => key === "catalogue")).toHaveLength(1);
  });

  it("rejects unknown modules", () => {
    expect(() => resolveActivationPlan(["not-a-module" as never])).toThrow(ModuleActivationError);
  });
});
