import { Prisma } from "@prisma/client";
import { replacementStockShortage } from "./purchases.service";

describe("purchase stock safety", () => {
  it("rejects deleting receipts that existing sales depend on", () => {
    expect(
      replacementStockShortage(
        [{ productId: "steel", qty: -25 }],
        [],
      ),
    ).toBe("steel");
  });

  it("accepts a reduced receipt when remaining stock stays non-negative", () => {
    expect(
      replacementStockShortage(
        [{ productId: "steel", qty: -25 }],
        [{ productId: "steel", qty: 25 }],
      ),
    ).toBeUndefined();
  });

  it("combines replacement lines for the same product", () => {
    expect(
      replacementStockShortage(
        [{ productId: "cement", qty: -10 }],
        [
          { productId: "cement", qty: 4 },
          { productId: "cement", qty: 5 },
        ],
      ),
    ).toBe("cement");
  });

  it("handles Prisma-compatible numeric values after conversion", () => {
    expect(Number(new Prisma.Decimal("12.500"))).toBe(12.5);
  });
});
