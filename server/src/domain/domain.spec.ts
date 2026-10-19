import { Prisma } from "@prisma/client";
import { landedCostPerUnit, round2, saleGrandTotal } from "./money";
import { findShortages, stockLevelsFromLedger } from "./sale-availability";
import { settleFifo, settleSupplierFifo, supplierPayable } from "./payment-settlement";
import { computeProfit } from "./profit";

describe("money", () => {
  it("computes landed cost per unit with charges spread by quantity", () => {
    // 1000 kg @ 265 = 265000 goods + 24000 charges → 289 per kg
    expect(
      landedCostPerUnit({ qty: 1000, rate: 265, purchaseCharges: 24000 }).toNumber(),
    ).toBe(289);
  });

  it("keeps landed cost per kg exact: 10,000 kg @ 380 + 25,000 charges = 382.50/kg", () => {
    const perKg = landedCostPerUnit({
      qty: 10000,
      rate: 380,
      purchaseCharges: 25000,
    });
    expect(perKg.toString()).toBe("382.5");
    // expected profit per kg uses the exact unit cost, not a rounded Rs 383
    expect(new Prisma.Decimal(450).minus(perKg).toNumber()).toBe(67.5);
    expect(new Prisma.Decimal(450).minus(perKg).times(10000).toNumber()).toBe(675000);
  });

  it("keeps fractional unit cost exact across repeating decimals", () => {
    // 3 kg @ 100 + 1 charge = 301 / 3 = 100.333... (not rounded to 100.33 before use)
    const perKg = landedCostPerUnit({ qty: 3, rate: 100, purchaseCharges: 1 });
    expect(perKg.times(3).toNumber()).toBe(301);
  });

  it("rounds money totals half-up, not via float Math.round", () => {
    expect(round2("1.005")).toBe(1.01);
    expect(round2("382.495")).toBe(382.5);
    expect(round2("0.994")).toBe(0.99);
  });

  it("computes invoice grand total: subtotal − discount + tax + flat charges", () => {
    const result = saleGrandTotal(
      [
        { qty: 100, rate: 300 },
        { qty: 200, rate: 300 },
      ],
      { discountPct: 10, taxPct: 5, loading: 500, transport: 2000, labour: 0 },
    );
    expect(result.subtotal).toBe(90000);
    expect(result.discount).toBe(9000);
    expect(result.taxable).toBe(81000);
    expect(result.tax).toBe(4050);
    expect(result.chargesTotal).toBe(2500);
    expect(result.grandTotal).toBe(87550);
  });
});

describe("sale availability (§22)", () => {
  it("flags every product that would go negative", () => {
    const levels = stockLevelsFromLedger([
      { productId: "steel", qty: 5000 },
      { productId: "steel", qty: -1000 },
      { productId: "cement", qty: 400 },
    ]);
    const shortages = findShortages(levels, [
      { productId: "steel", qty: 4500 },
      { productId: "cement", qty: 450 },
    ]);
    expect(shortages).toHaveLength(2);
    expect(shortages[0]).toMatchObject({ productId: "steel" });
    expect(shortages[0].available.toNumber()).toBe(4000);
    expect(shortages[0].requested.toNumber()).toBe(4500);
    expect(shortages[0].missing.toNumber()).toBe(500);
    expect(shortages[1]).toMatchObject({ productId: "cement" });
    expect(shortages[1].available.toNumber()).toBe(400);
    expect(shortages[1].requested.toNumber()).toBe(450);
    expect(shortages[1].missing.toNumber()).toBe(50);
  });

  it("accepts a sale that exactly empties the yard", () => {
    const levels = stockLevelsFromLedger([{ productId: "steel", qty: 2000 }]);
    expect(findShortages(levels, [{ productId: "steel", qty: 2000 }])).toHaveLength(0);
  });
});

describe("payment FIFO settlement (§10)", () => {
  it("settles the oldest unpaid invoice first, then spills to the next", () => {
    const result = settleFifo(
      [
        { saleId: "new", total: 50000, paidSoFar: 0, date: "2026-08-10" },
        { saleId: "old", total: 30000, paidSoFar: 5000, date: "2026-06-01" },
      ],
      30000,
    );
    expect(result.allocations).toEqual([
      { saleId: "old", amount: 25000 },
      { saleId: "new", amount: 5000 },
    ]);
    expect(result.unallocated).toBe(0);
  });

  it("spills across invoices in date order", () => {
    const result = settleFifo(
      [
        { saleId: "b", total: 20000, paidSoFar: 0, date: "2026-07-01" },
        { saleId: "a", total: 15000, paidSoFar: 0, date: "2026-05-01" },
      ],
      30000,
    );
    expect(result.allocations).toEqual([
      { saleId: "a", amount: 15000 },
      { saleId: "b", amount: 15000 },
    ]);
    expect(result.unallocated).toBe(0);
  });

  it("never settles more than an invoice's remaining due", () => {
    const result = settleFifo(
      [{ saleId: "a", total: 10000, paidSoFar: 9990, date: "2026-05-01" }],
      500,
    );
    expect(result.allocations).toEqual([{ saleId: "a", amount: 10 }]);
    expect(result.unallocated).toBe(490);
  });
});

describe("supplier payment FIFO settlement", () => {
  it("allocates oldest dues first and reports any unallocated overpayment", () => {
    expect(
      settleSupplierFifo(
        [
          { purchaseId: "old", goodsTotal: 100, paid: 70 },
          { purchaseId: "new", goodsTotal: 80, paid: 0 },
        ],
        120,
      ),
    ).toEqual({
      allocations: [
        { purchaseId: "old", amount: 30 },
        { purchaseId: "new", amount: 80 },
      ],
      unallocated: 10,
    });
  });
});

describe("payment settlement precision (Decimal, no float drift)", () => {
  it("settles exact paisa where float64 would drift (0.1 + 0.2)", () => {
    const result = settleFifo(
      [{ saleId: "a", total: "0.30", paidSoFar: "0.10", date: "2026-05-01" }],
      "0.20",
    );
    expect(result.allocations).toEqual([{ saleId: "a", amount: 0.2 }]);
    expect(result.unallocated).toBe(0);
  });

  it("accepts Decimal-string inputs without Number conversion", () => {
    const result = settleSupplierFifo(
      [{ purchaseId: "p", goodsTotal: "1234.56", paid: "1234.55" }],
      "0.01",
    );
    expect(result).toEqual({
      allocations: [{ purchaseId: "p", amount: 0.01 }],
      unallocated: 0,
    });
  });

  it("reports an overpayment of one paisa as unallocated, not as a rounding gap", () => {
    const result = settleFifo(
      [{ saleId: "a", total: "100.00", paidSoFar: "99.99", date: "2026-05-01" }],
      "0.02",
    );
    expect(result.allocations).toEqual([{ saleId: "a", amount: 0.01 }]);
    expect(result.unallocated).toBe(0.01);
  });

  it("supplier payable ignores over-paid purchases and keeps paisa exact", () => {
    expect(
      supplierPayable([
        { goodsTotal: "100.10", paid: "100.00" },
        { goodsTotal: "50.00", paid: "60.00" },
      ]),
    ).toBe(0.1);
  });
});

describe("supplier payable", () => {
  it("counts only the goods total — charges are on us", () => {
    expect(
      supplierPayable([
        { goodsTotal: 530000, paid: 530000 },
        { goodsTotal: 400000, paid: 150000 },
      ]),
    ).toBe(250000);
  });
});

describe("profit engine (§22)", () => {
  it("computes profit on sales only — never on stock still held", () => {
    const result = computeProfit(
      [
        {
          saleId: "s1",
          lines: [
            { productId: "steel", qty: 100, rate: 300, unitCost: 270 },
            { productId: "cement", qty: 50, rate: 1500, unitCost: 1400 },
          ],
          discountPct: 0,
          taxPct: 0,
          loading: 0,
          transport: 0,
          labour: 0,
        },
      ],
      [{ amount: 5000 }],
    );
    expect(result.salesRevenue).toBe(105000);
    expect(result.stockCost).toBe(97000);
    expect(result.profitOnSales).toBe(8000);
    expect(result.netProfit).toBe(3000);
    expect(result.profitPct).toBeCloseTo(2.86, 1);
  });

  it("subtracts shop-wide expenses only in the All Products view", () => {
    const sales = [
      {
        saleId: "s1",
        lines: [{ productId: "steel", qty: 10, rate: 300, unitCost: 250 }],
        discountPct: 0,
        taxPct: 0,
        loading: 0,
        transport: 0,
        labour: 0,
      },
    ];
    const expenses = [{ productId: "steel", amount: 300 }, { amount: 700 }];
    expect(computeProfit(sales, expenses, { productId: "steel" }).netProfit).toBe(200);
    expect(computeProfit(sales, expenses).netProfit).toBe(-500);
  });
});

describe("computeProfit product scope", () => {
  // Sale with two products plus discount/tax/flat charges. Charges and tax are
  // spread by subtotal share, so per-product revenue reconciles to the grand total.
  const sale = {
    saleId: "s1",
    lines: [
      { productId: "steel", qty: 10, rate: 100, unitCost: 80 },
      { productId: "cement", qty: 5, rate: 200, unitCost: 150 },
    ],
    discountPct: 5,
    taxPct: 2,
    loading: 300,
    transport: 200,
    labour: 100,
  };

  it("per-product revenue sums to the sale grand total", () => {
    const all = computeProfit([sale], []);
    const steel = computeProfit([sale], [], { productId: "steel" });
    const cement = computeProfit([sale], [], { productId: "cement" });

    const grandTotal = saleGrandTotal(sale.lines, {
      discountPct: 5,
      taxPct: 2,
      loading: 300,
      transport: 200,
      labour: 100,
    }).grandTotal;

    expect(all.salesRevenue).toBeCloseTo(steel.salesRevenue + cement.salesRevenue, 2);
    expect(all.salesRevenue).toBeCloseTo(grandTotal, 2);
  });

  it("stockCost is attributed per product and adds up", () => {
    const steel = computeProfit([sale], [], { productId: "steel" });
    const cement = computeProfit([sale], [], { productId: "cement" });
    const all = computeProfit([sale], []);

    expect(steel.stockCost).toBe(800);
    expect(cement.stockCost).toBe(750);
    expect(all.stockCost).toBe(1550);
  });

  it("does not give a product the whole invoice's flat charges (old bug)", () => {
    const steel = computeProfit([sale], [], { productId: "steel" });
    // Steel goods share of grand total = 1000/2000 * grandTotal
    const grandTotal = saleGrandTotal(sale.lines, {
      discountPct: 5,
      taxPct: 2,
      loading: 300,
      transport: 200,
      labour: 100,
    }).grandTotal;
    const steelGoodsShare = grandTotal * 0.5;

    // Old bug gave steel the FULL 600 charges (revenue ~1569).
    // Correct behaviour gives only the proportional charge (revenue ~1269).
    expect(steel.salesRevenue).toBeLessThan(steelGoodsShare + 1);
    expect(steel.salesRevenue).toBeCloseTo(steelGoodsShare, 2);
  });
});
