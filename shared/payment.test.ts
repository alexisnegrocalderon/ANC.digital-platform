import { describe, expect, it } from "vitest";
import { assertPaymentStateTransition, canTransitionPaymentState } from "./payment";

describe("payment state machine", () => {
  it("allows a pending payment to become approved", () => {
    expect(canTransitionPaymentState("pending", "approved")).toBe(true);
  });

  it("does not allow a failed payment to become approved directly", () => {
    expect(canTransitionPaymentState("failed", "approved")).toBe(false);
  });

  it("throws on invalid transitions", () => {
    expect(() => assertPaymentStateTransition("cancelled", "approved")).toThrow(
      "Invalid payment state transition",
    );
  });
});
