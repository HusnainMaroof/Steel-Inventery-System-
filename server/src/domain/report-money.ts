import { Prisma } from "@prisma/client";
import { roundMoneyDecimal } from "./money";

type D = Prisma.Decimal.Value;
const Dec = (v: D) => new Prisma.Decimal(v);

/**
 * Open balance of one invoice or bill: total − paid, never below zero,
 * rounded to paisa at this boundary.
 */
export function openBalance(total: D, paid: D): Prisma.Decimal {
  return roundMoneyDecimal(Prisma.Decimal.max(Dec(total).minus(paid), 0));
}

/** Cash in hand = customer cash in − supplier cash out − expenses. */
export function cashInHand(input: { received: D; paid: D; expenses: D }): Prisma.Decimal {
  return roundMoneyDecimal(Dec(input.received).minus(input.paid).minus(input.expenses));
}

/** Business value = remaining stock valuation + customer due + cash in hand. */
export function businessValue(input: {
  remainingValuation: D;
  customerDue: D;
  cashInHand: D;
}): Prisma.Decimal {
  return roundMoneyDecimal(
    Dec(input.remainingValuation).plus(input.customerDue).plus(input.cashInHand),
  );
}
