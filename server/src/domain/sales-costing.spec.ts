import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { assertMaxDecimals } from "../common/security/limits";
import { landedCostPerUnit, saleGrandTotalDecimal } from "./money";
import { computeProfit } from "./profit";

/**
 * Regression example (purchase-to-sale costing, weighted by landed cost):
 *   Purchase 10,000 kg @ Rs 380, charges Rs 25,000 → landed Rs 3,825,000
 *   → exact landed cost Rs 382.50/kg.
 *   Sell 2,500 kg @ Rs 450/kg → revenue 1,125,000, COGS 956,250, gross 168,750.
 *   Remaining 7,500 kg → value 2,868,750.
 */
describe("sales costing regression (purchase lot, landed cost)", () => {
  const unitCost = landedCostPerUnit({
    qty: 10000,
    rate: 380,
    purchaseCharges: 25000,
  });

  it("derives the exact landed unit cost of Rs 382.50/kg", () => {
    expect(unitCost.toString()).toBe("382.5");
  });

  it("computes revenue, COGS and realized profit for a partial sale", () => {
    const result = computeProfit(
      [
        {
          saleId: "s1",
          lines: [
            { productId: "steel", qty: 2500, rate: 450, unitCost },
          ],
          discountPct: 0,
          taxPct: 0,
          loading: 0,
          transport: 0,
          labour: 0,
        },
      ],
      [],
    );
    expect(result.salesRevenue).toBe(1125000);
    expect(result.stockCost).toBe(956250);
    expect(result.profitOnSales).toBe(168750);
  });

  it("values the remaining 7,500 kg at the unrounded unit cost", () => {
    const remainingQty = new Prisma.Decimal(10000).minus(2500);
    expect(remainingQty.toString()).toBe("7500");
    const remainingValue = remainingQty.times(unitCost);
    expect(remainingValue.toFixed(2)).toBe("2868750.00");
  });
});

describe("fractional quantities and repeating unit costs", () => {
  it("keeps a repeating unit cost exact: 3 kg @ 100 + 1 charge → 100.333...", () => {
    const unit = landedCostPerUnit({ qty: 3, rate: 100, purchaseCharges: 1 });
    // Decimal keeps 20 significant digits, so 301/3 × 3 is not bit-exact.
    // The residual is ~1e-17, far below a paisa. Assert the tolerance and
    // the paisa-rounded value, which is what the money totals use.
    const back = unit.times(3);
    expect(back.minus(301).abs().lt(new Prisma.Decimal("1e-12"))).toBe(true);
    expect(back.toDecimalPlaces(2).toString()).toBe("301");
  });

  it("sells 1.5 kg of that lot: COGS 150.50 exactly, revenue 150.75", () => {
    const unit = landedCostPerUnit({ qty: 3, rate: 100, purchaseCharges: 1 });
    const result = computeProfit(
      [
        {
          saleId: "s2",
          lines: [{ productId: "x", qty: 1.5, rate: 100.5, unitCost: unit }],
          discountPct: 0,
          taxPct: 0,
          loading: 0,
          transport: 0,
          labour: 0,
        },
      ],
      [],
    );
    expect(result.salesRevenue).toBe(150.75);
    expect(result.stockCost).toBe(150.5);
    expect(result.profitOnSales).toBe(0.25);
  });

  it("rounds only the invoice money total, half-up at paisa", () => {
    // 3 × 33.335 = 100.005 subtotal → 100.01 (half-up), no float drift.
    const totals = saleGrandTotalDecimal(
      [{ qty: 3, rate: 33.335 }],
      { discountPct: 0, taxPct: 0, loading: 0, transport: 0, labour: 0 },
    );
    expect(totals.subtotal.toFixed(2)).toBe("100.01");
    expect(totals.grandTotal.toFixed(2)).toBe("100.01");
  });

  it("documents the rounding boundary: invoice total is rounded, unit cost is not", () => {
    const unit = landedCostPerUnit({ qty: 3, rate: 100, purchaseCharges: 1 });
    expect(unit.toDecimalPlaces(2).toString()).toBe("100.33");
    expect(unit.toString()).not.toBe("100.33");
  });
});

describe("decimal-place guards on sale input", () => {
  it("accepts quantities with up to 3 decimals", () => {
    expect(() => assertMaxDecimals(2.125, 3, "Quantity")).not.toThrow();
  });

  it("rejects quantities with a 4th decimal, since the DB would round them", () => {
    expect(() => assertMaxDecimals(2.1255, 3, "Quantity")).toThrow(
      BadRequestException,
    );
  });

  it("rejects rates with more than 2 decimals, since SaleLine.rate is Decimal(14,2)", () => {
    expect(() => assertMaxDecimals(33.335, 2, "Rate")).toThrow(BadRequestException);
    expect(() => assertMaxDecimals(33.33, 2, "Rate")).not.toThrow();
  });
});
