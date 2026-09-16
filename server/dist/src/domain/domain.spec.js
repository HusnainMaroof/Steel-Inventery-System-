"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const money_1 = require("./money");
const sale_availability_1 = require("./sale-availability");
const payment_settlement_1 = require("./payment-settlement");
const profit_1 = require("./profit");
describe("money", () => {
    it("computes landed cost per unit with charges spread by quantity", () => {
        expect((0, money_1.landedCostPerUnit)({ qty: 1000, rate: 265, purchaseCharges: 24000 })).toBe(289);
    });
    it("computes invoice grand total: subtotal − discount + tax + flat charges", () => {
        const result = (0, money_1.saleGrandTotal)([
            { qty: 100, rate: 300 },
            { qty: 200, rate: 300 },
        ], { discountPct: 10, taxPct: 5, loading: 500, transport: 2000, labour: 0 });
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
        const levels = (0, sale_availability_1.stockLevelsFromLedger)([
            { productId: "steel", qty: 5000 },
            { productId: "steel", qty: -1000 },
            { productId: "cement", qty: 400 },
        ]);
        const shortages = (0, sale_availability_1.findShortages)(levels, [
            { productId: "steel", qty: 4500 },
            { productId: "cement", qty: 450 },
        ]);
        expect(shortages).toHaveLength(1);
        expect(shortages[0]).toMatchObject({
            productId: "cement",
            available: 400,
            requested: 450,
            missing: 50,
        });
    });
    it("accepts a sale that exactly empties the yard", () => {
        const levels = (0, sale_availability_1.stockLevelsFromLedger)([{ productId: "steel", qty: 2000 }]);
        expect((0, sale_availability_1.findShortages)(levels, [{ productId: "steel", qty: 2000 }])).toHaveLength(0);
    });
});
describe("payment FIFO settlement (§10)", () => {
    it("settles the oldest unpaid invoice first", () => {
        const result = (0, payment_settlement_1.settleFifo)([
            { saleId: "new", total: 50000, paidSoFar: 0, date: "2026-08-10" },
            { saleId: "old", total: 30000, paidSoFar: 5000, date: "2026-06-01" },
        ], 30000);
        expect(result.allocations).toEqual([{ saleId: "old", amount: 25000 }]);
        expect(result.unallocated).toBe(5000);
    });
    it("spills across invoices in date order", () => {
        const result = (0, payment_settlement_1.settleFifo)([
            { saleId: "b", total: 20000, paidSoFar: 0, date: "2026-07-01" },
            { saleId: "a", total: 15000, paidSoFar: 0, date: "2026-05-01" },
        ], 30000);
        expect(result.allocations).toEqual([
            { saleId: "a", amount: 15000 },
            { saleId: "b", amount: 15000 },
        ]);
        expect(result.unallocated).toBe(0);
    });
    it("never settles more than an invoice's remaining due", () => {
        const result = (0, payment_settlement_1.settleFifo)([{ saleId: "a", total: 10000, paidSoFar: 9990, date: "2026-05-01" }], 500);
        expect(result.allocations).toEqual([{ saleId: "a", amount: 10 }]);
        expect(result.unallocated).toBe(490);
    });
});
describe("supplier payable", () => {
    it("counts only the goods total — charges are on us", () => {
        expect((0, payment_settlement_1.supplierPayable)([
            { goodsTotal: 530000, paid: 530000 },
            { goodsTotal: 400000, paid: 150000 },
        ])).toBe(250000);
    });
});
describe("profit engine (§22)", () => {
    it("computes profit on sales only — never on stock still held", () => {
        const result = (0, profit_1.computeProfit)([
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
        ], [{ amount: 5000 }]);
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
        expect((0, profit_1.computeProfit)(sales, expenses, { productId: "steel" }).netProfit).toBe(200);
        expect((0, profit_1.computeProfit)(sales, expenses).netProfit).toBe(-500);
    });
});
//# sourceMappingURL=domain.spec.js.map