import { Prisma } from "@prisma/client";

const QTY_KEYS = new Set([
  "qty",
  "physicalQty",
  "systemQty",
  "purchasedQty",
  "soldQty",
  "stockQty",
  "openingQty",
  "purchaseQty",
  "totalQty",
  "remainingQty",
  "difference",
]);

const MONEY_KEYS = new Set([
  "rate",
  "sellRate",
  "amount",
  "paid",
  "total",
  "transport",
  "loading",
  "labour",
  "otherCost",
  "loadingCharges",
  "transportCharges",
  "labourCharges",
  "paidNow",
  "price",
  "goodsTotal",
  "subtotal",
  "discount",
  "tax",
  "taxable",
  "chargesTotal",
  "grandTotal",
  "revenue",
  "cogs",
  "grossProfit",
  "netProfit",
  "customerDue",
  "supplierDue",
  "stockValue",
  "cashReceived",
  "cashPaid",
  "cashInHand",
  "remainingValuation",
  "businessValue",
  "openingValue",
  "purchaseValue",
  "salesAmount",
  "remainingValue",
  "due",
  "landedAvg",
  "avgSellRate",
  "unitCost",
]);

export function decimalToJson(value: Prisma.Decimal, key?: string): string {
  if (key && QTY_KEYS.has(key)) {
    return value.toFixed(3);
  }
  if (key && MONEY_KEYS.has(key)) {
    return value.toFixed(2);
  }
  const asNumber = value.toNumber();
  if (Math.abs(asNumber - Math.round(asNumber)) < 0.0001) {
    return value.toFixed(0);
  }
  return value.toFixed(3);
}

export function isDecimalKey(key?: string): boolean {
  return !key || MONEY_KEYS.has(key) || QTY_KEYS.has(key);
}
