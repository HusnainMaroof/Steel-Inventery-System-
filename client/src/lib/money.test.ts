import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { round2, round3, roundMoney, toDecimal } from "./decimal.ts";
import { saleGrandTotalAmount, saleSubtotal } from "./money.ts";
import { purchaseLiveTotals } from "../components/purchases/purchase-draft-utils.ts";
import { fmtMoney, fmtUnitMoney } from "./format.ts";

const example = {
  qty: 10000,
  rate: 380,
  sellRate: 450,
  loading: 10000,
  transport: 10000,
  labour: 5000,
  otherCost: 0,
  paidToSupplier: 0,
};

describe("purchase live summary (spec example)", () => {
  it("computes goods, charges, landed total, and per-kg values exactly", () => {
    const t = purchaseLiveTotals(example);
    assert.equal(t.goodsTotal, 3800000);
    assert.equal(t.chargesTotal, 25000);
    assert.equal(t.landedTotal, 3825000);
    assert.equal(t.landedPerUnit, 382.5);
    assert.equal(t.marginPerUnit, 67.5);
    assert.equal(t.expectedTotalProfit, 675000);
  });

  it("does not use a rounded landed cost of 383/kg for profit", () => {
    const t = purchaseLiveTotals(example);
    assert.notEqual(t.landedPerUnit, 383);
    assert.notEqual(t.marginPerUnit, 67);
  });

  it("shows 382.50 and 67.50 per kg, not 383 and 68", () => {
    const t = purchaseLiveTotals(example);
    assert.equal(fmtUnitMoney(t.landedPerUnit), "₨ 382.50");
    assert.equal(fmtUnitMoney(t.marginPerUnit), "₨ 67.50");
    assert.equal(fmtMoney(t.expectedTotalProfit), "₨ 675,000");
  });

  it("reconciles: landed total = goods + charges", () => {
    const t = purchaseLiveTotals(example);
    assert.equal(t.landedTotal, t.goodsTotal + t.chargesTotal);
  });

  it("returns zero per-unit values for zero quantity without dividing by zero", () => {
    const t = purchaseLiveTotals({ ...example, qty: 0 });
    assert.equal(t.landedPerUnit, 0);
    assert.equal(t.expectedTotalProfit, 0);
    assert.equal(t.goodsTotal, 0);
  });

  it("keeps fractional quantities exact (10.7 kg x 333.33)", () => {
    const t = purchaseLiveTotals({ ...example, qty: 10.7, rate: 333.33, sellRate: 0, loading: 0, transport: 0, labour: 0 });
    // 10.7 x 333.33 = 3566.631, rounds half-up to 3566.63
    assert.equal(t.goodsTotal, 3566.63);
  });

  it("caps due to supplier at zero when overpaid", () => {
    const t = purchaseLiveTotals({ ...example, paidToSupplier: 4000000 });
    assert.equal(t.dueToSupplier, 0);
  });

  it("computes due to supplier on goods only, excluding charges", () => {
    const t = purchaseLiveTotals({ ...example, paidToSupplier: 1000000 });
    assert.equal(t.dueToSupplier, 2800000);
  });
});

describe("decimal rounding boundaries (half-up to paisa)", () => {
  it("rounds .004 down and .005 up", () => {
    assert.equal(round2("1.004"), 1);
    assert.equal(round2("1.005"), 1.01);
  });

  it("rounds 1.005 correctly where float math gives 1.00", () => {
    assert.equal(round2(1.005), 1.01);
  });

  it("rounds .495 and .995 at the second decimal", () => {
    assert.equal(roundMoney("0.495").toString(), "0.5");
    assert.equal(roundMoney("0.994").toString(), "0.99");
    assert.equal(roundMoney("0.995").toString(), "1");
  });

  it("keeps .50 as an exact paisa value", () => {
    assert.equal(round2("382.50"), 382.5);
  });

  it("rounds quantities to 3 decimals", () => {
    assert.equal(round3("10.3455"), 10.346);
    assert.equal(round3("8.2"), 8.2);
  });

  it("parses decimal strings without float drift", () => {
    assert.equal(toDecimal("0.1").plus("0.2").toString(), "0.3");
  });

  it("keeps repeating-decimal unit costs within Decimal precision (no float error)", () => {
    // 10 / 3 is not finite; Decimal keeps ~20 significant digits, far beyond paisa
    const unit = toDecimal(10).div(3);
    const drift = unit.times(3).minus(10).abs();
    assert.ok(drift.lt("1e-15"), `drift was ${drift.toString()}`);
  });
});

describe("sale totals", () => {
  it("sums line amounts exactly", () => {
    assert.equal(saleSubtotal([{ qty: 0.1, rate: 0.2 }, { qty: 0.2, rate: 0.1 }]), 0.04);
  });

  it("computes grand total: subtotal - discount + tax + charges", () => {
    const total = saleGrandTotalAmount({
      lines: [{ qty: 10, rate: 100 }],
      discountPct: 10,
      taxPct: 5,
      loadingCharges: 50,
    });
    // 1000 - 100 = 900; tax 45; charges 50 → 995
    assert.equal(total, 995);
  });
});
