import { Prisma } from "@prisma/client";
import { normalizeJson } from "./json-normalization.interceptor";

describe("JSON response normalization", () => {
  it("converts Decimal, dates, and client-facing enums recursively", () => {
    expect(
      normalizeJson({
        amount: new Prisma.Decimal("125.50"),
        date: new Date("2026-09-17T00:00:00.000Z"),
        createdAt: new Date("2026-09-17T12:30:00.000Z"),
        type: "CUSTOMER",
        method: "BANK",
        category: "LABOR",
        rows: [{ qty: new Prisma.Decimal("2.500") }],
        movement: {
          type: "PURCHASE",
          referenceType: "PURCHASE",
          qty: new Prisma.Decimal("2.500"),
        },
      }),
    ).toEqual({
      amount: 125.5,
      date: "2026-09-17",
      createdAt: "2026-09-17T12:30:00.000Z",
      type: "customer",
      method: "Bank",
      category: "Labor",
      rows: [{ qty: 2.5 }],
      movement: {
        type: "PURCHASE_RECEIPT",
        referenceType: "PURCHASE",
        qty: 2.5,
      },
    });
  });
});
