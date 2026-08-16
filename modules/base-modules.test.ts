import { describe, expect, it } from "vitest";
import { cleanSlug } from "./catalogue/service";
import { cleanPhone } from "./crm/service";

describe("base modules contracts", () => {
  it("normalizes catalogue slugs deterministically", () => {
    expect(cleanSlug("  Corte de Pelo Premium  ")).toBe("corte-de-pelo-premium");
    expect(cleanSlug("Servicio / VIP #1")).toBe("servicio-vip-1");
  });

  it("accepts only E.164-like CRM phones", () => {
    expect(cleanPhone("+56 (9) 1234-5678")).toBe("+56912345678");
    expect(cleanPhone("56912345678")).toBeUndefined();
    expect(cleanPhone("not-a-phone")).toBeUndefined();
  });

  it("keeps tenant-facing contracts independent from provider credentials", () => {
    const catalogueInput = {
      businessId: 1,
      name: "Servicio demo",
      slug: cleanSlug("Servicio demo"),
      status: "draft",
    };
    expect(catalogueInput).not.toHaveProperty("accessToken");
    expect(catalogueInput).not.toHaveProperty("clientSecret");
  });
});
