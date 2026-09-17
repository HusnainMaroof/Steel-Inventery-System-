import { BadRequestException } from "@nestjs/common";
import { sanitizeUiSettings } from "./sanitize-settings";

describe("sanitizeUiSettings", () => {
  it("accepts a minimal valid payload", () => {
    expect(
      sanitizeUiSettings({
        invoiceName: "Husna Steel",
        showOptionalDetails: true,
      }),
    ).toMatchObject({
      invoiceName: "Husna Steel",
      showOptionalDetails: true,
      logoDataUrl: "",
    });
  });

  it("rejects script-like logo payloads", () => {
    expect(() =>
      sanitizeUiSettings({
        logoDataUrl: "javascript:alert(1)",
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects invalid invoice email", () => {
    expect(() =>
      sanitizeUiSettings({
        invoiceEmail: "not-an-email",
      }),
    ).toThrow(BadRequestException);
  });
});
