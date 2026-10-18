import { businessValue, cashInHand, openBalance } from "./report-money";

describe("report money helpers", () => {
  it("openBalance is total minus paid, exact, never negative", () => {
    expect(openBalance("100.10", "40.05").toFixed(2)).toBe("60.05");
    expect(openBalance("50", "70").toFixed(2)).toBe("0.00");
  });

  it("openBalance avoids float drift on fractional amounts", () => {
    // 0.1 + 0.2 style drift: 1.10 - 0.30 must be exactly 0.80
    expect(openBalance("1.10", "0.30").toFixed(2)).toBe("0.80");
  });

  it("cashInHand = received - paid - expenses, exact", () => {
    const result = cashInHand({ received: "1000.10", paid: "400.05", expenses: "99.99" });
    expect(result.toFixed(2)).toBe("500.06");
  });

  it("businessValue sums valuation, due and cash exactly", () => {
    const result = businessValue({
      remainingValuation: "0.30",
      customerDue: "0.20",
      cashInHand: "0.10",
    });
    expect(result.toFixed(2)).toBe("0.60");
  });
});
