import { describe, expect, it } from "vitest";
import {
  appointmentIdempotencyKey,
  assertAppointmentTransition,
  canTransitionAppointment,
  normalizePhoneE164,
} from "./booking";

describe("booking contracts", () => {
  it("allows confirmed appointments to be rescheduled", () => {
    expect(canTransitionAppointment("confirmed", "rescheduled")).toBe(true);
  });

  it("rejects transitions from terminal states", () => {
    expect(() => assertAppointmentTransition("cancelled", "confirmed")).toThrow(
      "Invalid appointment state transition",
    );
  });

  it("normalizes valid E.164 numbers and rejects local formats", () => {
    expect(normalizePhoneE164("+56 9 1234 5678")).toBe("+56912345678");
    expect(() => normalizePhoneE164("912345678")).toThrow("E.164");
  });

  it("namespaces idempotency by business", () => {
    expect(appointmentIdempotencyKey(12, "checkout-1")).toBe("booking-12-checkout-1");
  });
});
