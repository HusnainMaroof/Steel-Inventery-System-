import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fmtMoney, fmtQtyDecimal, fmtQtyExact, fmtQtyNumber, fmtQtyWithUnit } from "./format.ts";

describe("fmtQtyDecimal (display policy, 1 decimal, trailing zeros removed)", () => {
  it("documented examples", () => {
    assert.equal(fmtQtyNumber(20), "20");
    assert.equal(fmtQtyNumber(20.0), "20");
    assert.equal(fmtQtyNumber(20.1), "20.1");
    assert.equal(fmtQtyNumber(20.567), "20.6");
    assert.equal(fmtQtyNumber(0.5), "0.5");
  });

  it("rounds halfway cases HALF-UP", () => {
    assert.equal(fmtQtyNumber(0.25), "0.3");
    assert.equal(fmtQtyNumber(2.45), "2.5");
    assert.equal(fmtQtyNumber(0.049), "0.05");
    assert.equal(fmtQtyNumber(0.05), "0.1");
  });

  it("handles negative values with a minus sign", () => {
    assert.equal(fmtQtyNumber(-2.25), "-2.3");
    assert.equal(fmtQtyNumber(-20), "-20");
    assert.equal(fmtQtyNumber(-0.02), "-0.02");
  });

  it("keeps small fractional quantities readable (0.04 is not shown as 0)", () => {
    assert.equal(fmtQtyNumber(0.04), "0.04");
    assert.equal(fmtQtyNumber(-0.04), "-0.04");
    assert.equal(fmtQtyNumber(0.004), "0.004");
    assert.equal(fmtQtyNumber(0.1), "0.1");
    assert.equal(fmtQtyNumber(0.1 + 0.2), "0.3");
    assert.equal(fmtQtyNumber(10.7 - 2.5), "8.2");
  });

  it("groups large values and keeps Decimal-string precision", () => {
    assert.equal(fmtQtyNumber(1234567.89), "1,234,567.9");
    assert.equal(fmtQtyDecimal("123456789012.345", 1), "123,456,789,012.3");
    assert.equal(fmtQtyDecimal("10.3455", 1), "10.3");
  });

  it("returns 0 for empty or non-finite input", () => {
    assert.equal(fmtQtyNumber(0), "0");
    assert.equal(fmtQtyNumber(Number.NaN), "0");
    assert.equal(fmtQtyNumber(Number.POSITIVE_INFINITY), "0");
  });

  it("keeps the unit label after the one-decimal value", () => {
    assert.equal(fmtQtyWithUnit(20.567, "kg"), "20.6 kg");
    assert.equal(fmtQtyWithUnit(7, "bag"), "7 bags");
  });
});

describe("fmtQtyExact (stock check, 3 decimals)", () => {
  it("keeps a small real difference visible", () => {
    assert.equal(fmtQtyExact(0.04), "0.04");
    assert.equal(fmtQtyExact(-0.04), "-0.04");
    assert.equal(fmtQtyExact(10.375), "10.375");
  });
});

describe("fmtMoney for report party dues (full values, no compact notation)", () => {
  it("shows a customer due of 45,000 instead of 45.0K", () => {
    assert.equal(fmtMoney(45000), "₨ 45,000");
  });

  it("shows a supplier due of 1,250,000 instead of 1.25M", () => {
    assert.equal(fmtMoney(1250000), "₨ 1,250,000");
  });

  it("keeps a negative-free zero due readable", () => {
    assert.equal(fmtMoney(0), "₨ 0");
  });

  it("shows fractional amounts with exactly two decimal places", () => {
    assert.equal(fmtMoney(175948.7), "₨ 175,948.70");
    assert.equal(fmtMoney(17903.77), "₨ 17,903.77");
    assert.equal(fmtMoney(0.004), "₨ 0");
  });
});

describe("fmtMoney for dashboard KPIs (full values, no compact notation)", () => {
  it("shows 110,000 instead of 110K", () => {
    assert.equal(fmtMoney(110000), "₨ 110,000");
  });

  it("shows 1,200,000 instead of 1.2M", () => {
    assert.equal(fmtMoney(1200000), "₨ 1,200,000");
  });

  it("shows 2,500 instead of 2.5K", () => {
    assert.equal(fmtMoney(2500), "₨ 2,500");
  });

  it("shows 12,500 instead of 12.5K", () => {
    assert.equal(fmtMoney(12500), "₨ 12,500");
  });
});
