import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { round2, round3, sumDecimal, toDecimal } from "./decimal.ts";
import { fmtMoney } from "./format.ts";
import { draftLineTotals, lineGoods, type PurchaseDraftLine } from "../components/purchases/purchase-draft-utils.ts";

const line = (over: Partial<PurchaseDraftLine>): PurchaseDraftLine => ({
  key: "k",
  productId: "p",
  productName: "Steel",
  variantId: "v",
  item: "Steel",
  attributeSnapshot: {},
  qty: 1,
  unit: "kg",
  rate: 0,
  loading: 0,
  transport: 0,
  labour: 0,
  otherCost: 0,
  paidToSupplier: 0,
  ...over,
});

describe("sumDecimal avoids float drift", () => {
  it("adds 0.1 + 0.2 as exactly 0.3", () => {
    assert.equal(sumDecimal([0.1, 0.2]).toString(), "0.3");
    assert.equal(round2(sumDecimal([0.1, 0.2])), 0.3);
  });

  it("treats null and empty values as zero", () => {
    assert.equal(round2(sumDecimal([null, "", 5])), 5);
  });
});

describe("rounding boundaries", () => {
  it("rounds money half-up at the paisa boundary", () => {
    assert.equal(round2(1.005), 1.01);
    assert.equal(round2(0.004), 0);
    assert.equal(round2(0.005), 0.01);
  });

  it("rounds quantities to 3 decimals half-up", () => {
    assert.equal(round3(1.0005), 1.001);
    assert.equal(round3(10.7), 10.7);
  });

  it("keeps fractional landed unit costs exact before rounding", () => {
    // 3566.631 / 10.7 = 333.33 exactly, so no drift
    assert.equal(toDecimal(3566.631).div(10.7).toDecimalPlaces(2).toNumber(), 333.33);
  });
});

describe("large amounts and display", () => {
  it("rounds large money values with thousands separators", () => {
    const v = round2(12345678.905);
    assert.equal(v, 12345678.91);
    assert.equal(fmtMoney(v), "₨ 12,345,678.91");
  });
});

describe("purchase draft totals", () => {
  it("computes fractional goods, charges and due from exact decimals", () => {
    const totals = draftLineTotals([
      line({ qty: 10.7, rate: 333.33, paidToSupplier: 1000, loading: 10.5 }),
    ]);
    assert.equal(totals.millGoodsTotal, 3566.63);
    assert.equal(totals.totalCharges, 10.5);
    assert.equal(totals.landedTotal, 3577.13);
    assert.equal(totals.totalPaidToSupplier, 1000);
    assert.equal(totals.dueToSupplier, 2566.63);
  });

  it("caps due to supplier at zero when overpaid", () => {
    const totals = draftLineTotals([line({ qty: 2, rate: 100, paidToSupplier: 250 })]);
    assert.equal(totals.dueToSupplier, 0);
  });

  it("sums multiple lines without float drift", () => {
    const totals = draftLineTotals([
      line({ qty: 1, rate: 0.1 }),
      line({ qty: 1, rate: 0.2 }),
    ]);
    assert.equal(totals.millGoodsTotal, 0.3);
  });
});

// Phase 4 regression: client money paths must not drift on float sums.

describe("client money: float drift regressions", () => {
  it("sums 0.1 + 0.2 exactly", () => {
    assert.equal(sumDecimal([0.1, 0.2]).toNumber(), 0.3);
  });

  it("keeps fractional quantities exact (10.7 - 2.5 = 8.2)", () => {
    assert.equal(toDecimal(10.7).minus(2.5).toNumber(), 8.2);
  });

  it("rounds a fractional line goods value half-up to paisa", () => {
    // 3.333 x 100.005 = 333.316665, half-up to paisa = 333.32
    assert.equal(lineGoods(3.333, 100.005), 333.32);
  });

  it("builds draft totals from unrounded values, then rounds once", () => {
    const totals = draftLineTotals([
      {
        key: "a", productId: "p", productName: "x", variantId: "v", item: "x",
        attributeSnapshot: {}, qty: 1.5, unit: "kg", rate: 0.1,
        loading: 0.1, transport: 0.2, labour: 0, otherCost: 0, paidToSupplier: 0.1,
      },
      {
        key: "b", productId: "p", productName: "x", variantId: "v", item: "x",
        attributeSnapshot: {}, qty: 2, unit: "kg", rate: 0.2,
        loading: 0, transport: 0, labour: 0.3, otherCost: 0, paidToSupplier: 0.2,
      },
    ]);
    // goods 0.15 + 0.4 = 0.55 ; charges 0.3 + 0.3 = 0.6 ; paid 0.3
    assert.equal(totals.millGoodsTotal, 0.55);
    assert.equal(totals.totalCharges, 0.6);
    assert.equal(totals.totalPaidToSupplier, 0.3);
    assert.equal(totals.dueToSupplier, 0.25);
    assert.equal(totals.landedTotal, 1.15);
  });

  it("round2 handles the half-up boundary on large amounts", () => {
    assert.equal(round2("1234567.125"), 1234567.13);
    assert.equal(round2("1234567.124"), 1234567.12);
  });
});
