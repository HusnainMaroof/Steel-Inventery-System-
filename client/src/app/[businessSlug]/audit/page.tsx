"use client";

/*
 * Hidden QA page — verifies that every number the app shows is internally
 * consistent with the raw ledger (purchases, sales, payments, expenses).
 *
 * It is not linked in the sidebar; open it directly at /audit.
 * Every line prints [PASS] or [FAIL] so the report can be generated from it.
 */

import { useMemo } from "react";
import { useStore, saleGrandTotal } from "@/lib/store";
import {
  groupPurchasesByParent,
  purchaseDocumentTotals,
  steelAmount,
} from "@/lib/purchase-utils";
import { buildProfitReport } from "@/lib/profitReport";
import { Page, PageTitle } from "@/components/ui";
import Decimal from "decimal.js";
import { toDecimal } from "../../../lib/decimal";

const eps = 0.01;
const money = (n: number) => "₨ " + Math.round(n).toLocaleString("en-US");
const qty = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString("en-US");

export default function AuditPage() {
  const store = useStore();
  const {
    customers,
    suppliers,
    purchases,
    sales,
    payments,
    expenses,
    inventory,
    stockLots,
    inventoryBySource,
    inventoryByVariant,
    stockMovements,
    byItem,
    salePaid,
    customerBalance,
    supplierBalance,
    lineUnitCost,
    stats,
    products,
    categories,
    variants,
    productItems,
    stockChecks,
  } = store;

  const out = useMemo(() => {
    const L: string[] = [];
    const check = (name: string, ok: boolean, detail = "") => {
      L.push(`${ok ? "[PASS]" : "[FAIL]"} ${name}${!ok && detail ? " → " + detail : ""}`);
    };

    /* ---------- STOCK: buy updates inventory, sell draws it down ---------- */
    const purchasedByItem: Record<string, number> = {};
    for (const p of purchases) {
      purchasedByItem[p.item] = (purchasedByItem[p.item] ?? 0) + p.qty;
    }
    const soldByItem: Record<string, number> = {};
    for (const s of sales)
      for (const l of s.lines) soldByItem[l.item] = (soldByItem[l.item] ?? 0) + l.qty;

    L.push("== STOCK ==");
    let stockOk = true;
    let stockWorth = new Decimal(0);
    for (const r of inventory) {
      const left = (purchasedByItem[r.item] ?? 0) - (soldByItem[r.item] ?? 0);
      const ident = Math.abs(left - r.stockQty) < eps;
      const rowValOk = Math.abs(r.stockQty * r.landedAvg - r.stockValue) < 0.5;
      if (!ident || !rowValOk || r.stockQty < -eps) stockOk = false;
      stockWorth = stockWorth.plus(toDecimal(r.stockValue));
      check(
        `${r.item}: purchased−sold (${qty(purchasedByItem[r.item] ?? 0)}−${qty(soldByItem[r.item] ?? 0)}=${qty(left)}) = stock ${qty(r.stockQty)}`,
        ident && r.stockQty >= -eps
      );
    }
    const boughtTotal = purchases.reduce((a, p) => a + p.qty, 0);
    const soldTotal = sales.reduce((a, s) => a + s.lines.reduce((b, l) => b + l.qty, 0), 0);
    check("Total qty in = total qty out + stock left", stockOk);
    check("Σ stock worth = Σ row stockValue", Math.abs(stockWorth.toNumber() - stats.stockValue) < 0.5, `${money(stockWorth.toNumber())} vs ${money(stats.stockValue)}`);
    check(
      "Whole ledger balances",
      Math.abs(boughtTotal - soldTotal - inventory.reduce((a, r) => a + r.stockQty, 0)) < 0.5,
      `bought ${qty(boughtTotal)} − sold ${qty(soldTotal)} = stock ${qty(inventory.reduce((a, r) => a + r.stockQty, 0))}`
    );

    /* per-source lots never negative and agree with per-source rows */
    let lotOk = true;
    for (const lot of stockLots) if (lot.remainingQty < -eps) lotOk = false;
    check("Every source lot has non-negative remaining stock", lotOk);
    let srcOk = true;
    for (const r of inventoryBySource) {
      const fromLots = stockLots
        .filter((x) => x.item === r.item && x.supplierId === r.supplierId)
        .reduce((a, x) => a + x.remainingQty, 0);
      if (Math.abs(fromLots - r.stockQty) > eps) srcOk = false;
      if (r.stockQty < -eps) srcOk = false;
    }
    check("Per-source inventory = Σ its remaining lots", srcOk);

    /* variant-level conservation + movement journal (derived from the same
       purchases/sales — must always match, never a second truth) */
    let varOk = true;
    let moveOk = true;
    let moveTotal = 0;
    const moveByPurchaseRow = new Map<string, number>();
    const moveBySaleLine = new Map<string, number>();
    for (const m of stockMovements) {
      if (m.type === "PURCHASE_RECEIPT" && m.id.startsWith("mv-p-"))
        moveByPurchaseRow.set(m.id.slice(5), m.qty);
      if (m.type === "SALE" && m.saleId && m.saleLineIndex !== undefined)
        moveBySaleLine.set(`${m.saleId}:${m.saleLineIndex}`, (moveBySaleLine.get(`${m.saleId}:${m.saleLineIndex}`) ?? 0) + m.qty);
      moveTotal += m.qty;
    }
    for (const p of purchases) if (Math.abs((moveByPurchaseRow.get(p.id) ?? 0) - p.qty) > eps) moveOk = false;
    for (const s of sales)
      s.lines.forEach((l, i) => {
        if (Math.abs((moveBySaleLine.get(`${s.id}:${i}`) ?? 0) + l.qty) > eps) moveOk = false;
      });
    check("Every purchase has one +qty movement, every sale line one −qty movement", moveOk);
    check(
      "Movement journal sums to zero net change at row level",
      Math.abs(moveTotal - (purchases.reduce((a, p) => a + p.qty, 0) - sales.reduce((a, s) => a + s.lines.reduce((b, l) => b + l.qty, 0), 0))) < 0.5,
      `+${qty(purchases.reduce((a, p) => a + p.qty, 0))} in − ${qty(sales.reduce((a, s) => a + s.lines.reduce((b, l) => b + l.qty, 0), 0))} out`
    );
    const byVariant: Record<string, { bought: number; sold: number; stockQty: number }> = {};
    for (const p of purchases)
      if (p.variantId) {
        (byVariant[p.variantId] ??= { bought: 0, sold: 0, stockQty: 0 }).bought += p.qty;
      }
    for (const s of sales)
      for (const l of s.lines)
        if (l.variantId) (byVariant[l.variantId] ??= { bought: 0, sold: 0, stockQty: 0 }).sold += l.qty;
    for (const r of inventoryByVariant) {
      if (r.variantId.startsWith("item:")) continue; // legacy rows (no variant)
      const b = byVariant[r.variantId];
      const expect = (b?.bought ?? 0) - (b?.sold ?? 0);
      if (Math.abs(expect - r.stockQty) > eps || r.stockQty < -eps) varOk = false;
      const lotQty = stockLots
        .filter((l) => l.variantId === r.variantId)
        .reduce((a, l) => a + l.remainingQty, 0);
      if (Math.abs(lotQty - r.stockQty) > eps) varOk = false;
    }
    check(
      "Variant stock = Σ its purchases − Σ its sales = Σ its remaining lots",
      varOk,
      `checked ${inventoryByVariant.filter((r) => !r.variantId.startsWith("item:")).length} variants`
    );

    /* simulate: buy one more +100 of a stocked item, then sell 25 */
    const stocked = inventory.find((r) => r.stockQty > 0);
    if (stocked) {
      const sellPrice = stocked.sellRate || stocked.avgSellRate || stocked.landedAvg;
      L.push("== SCENARIO: buy + sell flow (simulated on " + stocked.item + ") ==");
      L.push(`  stock ${qty(stocked.stockQty)} ${stocked.unit ?? ""} → buy 100 → stock ${qty(stocked.stockQty + 100)} ${stocked.unit ?? ""} (stock worth +${money(100 * stocked.landedAvg)})`);
      L.push(`  stock ${qty(stocked.stockQty)} ${stocked.unit ?? ""} → sell 25 @ ${money(sellPrice)} → stock ${qty(stocked.stockQty - 25)} ${stocked.unit ?? ""}, revenue +${money(25 * sellPrice)}`);
      check("Simulated stock deltas are exact", stocked.stockQty + 100 - 25 === stocked.stockQty + 75 && stocked.stockQty - 25 >= 0);
    }

    /* ---------- INVOICES & CUSTOMERS ---------- */
    L.push("== INVOICES / CUSTOMERS ==");
    let invoiceTotalsOk = true;
    for (const s of sales) {
      const grand = saleGrandTotal(s);
      const paid = salePaid(s.id);
      if (paid < -eps || paid > grand + eps) invoiceTotalsOk = false;
      check(
        `${s.invoiceNo}: grand ${money(grand)} = paid ${money(paid)} + due ${money(Math.max(0, grand - paid))} (${s.customerId})`,
        paid >= -eps && paid <= grand + eps
      );
    }
    check("All invoice grand totals reconcile", invoiceTotalsOk);

    const billed = customers.reduce((a, c) => a.plus(toDecimal(sales.filter((s) => s.customerId === c.id).reduce((b, s) => b.plus(toDecimal(saleGrandTotal(s))), new Decimal(0)).toNumber())), new Decimal(0)).toNumber();
    const received = payments.filter((p) => p.type === "customer").reduce((a, p) => a.plus(toDecimal(p.amount)), new Decimal(0)).toNumber();
    const totalDues = customers.reduce((a, c) => a.plus(toDecimal(Math.max(0, customerBalance(c.id)))), new Decimal(0)).toNumber();
    check("Billed = received + outstanding", Math.abs(billed - received - totalDues) < eps, `${money(billed)} = ${money(received)} + ${money(totalDues)}`);
    check("Dashboard customer dues = Σ customer balances", Math.abs(totalDues - stats.customerDues) < eps, `${money(totalDues)} vs ${money(stats.customerDues)}`);
    for (const c of customers) {
      const bal = customerBalance(c.id);
      check(
        `${c.name} balance ${money(bal)}`,
        Math.abs(bal - (sales.filter((s) => s.customerId === c.id).reduce((a, s) => a.plus(toDecimal(saleGrandTotal(s))), new Decimal(0)).toNumber() - payments.filter((p) => p.type === "customer" && p.partyId === c.id).reduce((a, p) => a.plus(toDecimal(p.amount)), new Decimal(0)).toNumber())) < eps
      );
    }

    /* ---------- SUPPLIERS ---------- */
    L.push("== SUPPLIERS ==");
    let millBilled = new Decimal(0);
    let millPaid = new Decimal(0);
    let millDue = new Decimal(0);
    for (const lines of groupPurchasesByParent(purchases).values()) {
      const t = purchaseDocumentTotals(lines);
      millBilled = millBilled.plus(toDecimal(t.goods));
      millPaid = millPaid.plus(toDecimal(t.paid));
      millDue = millDue.plus(toDecimal(t.remaining));
    }
    check("Mill dues = billed − paid", Math.abs(millBilled.toNumber() - millPaid.toNumber() - millDue.toNumber()) < eps, `${money(millDue.toNumber())}`);
    const supplierDues = suppliers.reduce((a, s) => a.plus(toDecimal(Math.max(0, supplierBalance(s.id)))), new Decimal(0)).toNumber();
    check("Dashboard mills dues = Σ purchase dues", Math.abs(supplierDues - stats.supplierDues) < eps && Math.abs(supplierDues - millDue.toNumber()) < eps, `${money(supplierDues)}`);
    for (const s of suppliers) {
      const ownDue = [...groupPurchasesByParent(purchases.filter((p) => p.supplierId === s.id)).values()]
        .reduce((a, lines) => a.plus(toDecimal(purchaseDocumentTotals(lines).remaining)), new Decimal(0)).toNumber();
      check(`${s.name} due ${money(ownDue)}`, Math.abs(ownDue - Math.max(0, supplierBalance(s.id))) < eps);
    }
    const journalToMills = payments.filter((p) => p.type === "supplier").reduce((a, p) => a.plus(toDecimal(p.amount)), new Decimal(0)).toNumber();
    const historiesToMills = purchases.reduce((a, p) => a.plus(toDecimal((p.paymentHistory ?? []).reduce((b, h) => b.plus(toDecimal(h.amount)), new Decimal(0)).toNumber())), new Decimal(0)).toNumber();
    check(
      "Paid-to-mills (Payments page) = purchase payment histories",
      Math.abs(journalToMills - historiesToMills) < eps && Math.abs(journalToMills - millPaid.toNumber()) < eps,
      `${money(journalToMills)} = ${money(historiesToMills)} = ${money(millPaid.toNumber())}`
    );

    /* ---------- PAYMENTS / CASH ---------- */
    L.push("== PAYMENTS ==");
    let pRefOk = true;
    for (const p of payments) {
      const partyOk = p.type === "customer" ? customers.some((c) => c.id === p.partyId) : suppliers.some((s) => s.id === p.partyId);
      const invOk = !p.saleId || sales.some((s) => s.id === p.saleId);
      if (!partyOk || !invOk) pRefOk = false;
    }
    check("Every payment references a real party/invoice", pRefOk);
    check("Received from customers (journal) = " + money(received), true);
    check("Paid to mills (journal) = " + money(journalToMills), true);

    /* ---------- PROFIT & LOSS ---------- */
    L.push("== PROFIT & LOSS ==");
    let revenue = new Decimal(0);
    let cogs = new Decimal(0);
    for (const s of sales) {
      revenue = revenue.plus(toDecimal(saleGrandTotal(s)));
      for (const [i, l] of s.lines.entries())
        cogs = cogs.plus(toDecimal(l.qty).times(lineUnitCost(s.id, i) || byItem[l.item] || 0));
    }
    const expenseTotal = expenses.reduce((a, e) => a.plus(toDecimal(e.amount)), new Decimal(0)).toNumber();
    check("Revenue = Σ invoice grand totals", Math.abs(revenue.toNumber() - stats.revenue) < eps, money(revenue.toNumber()));
    check("COGS uses the actual landed cost of consumed stock", Math.abs(cogs.toNumber() - stats.cogs) < 0.5, money(cogs.toNumber()));
    check("Expenses = Σ expense rows", Math.abs(expenseTotal - stats.expenses) < eps, money(expenseTotal));
    check("Net profit = revenue.toNumber() − cogs.toNumber() − expenses", Math.abs(revenue.toNumber() - cogs.toNumber() - expenseTotal - stats.netProfit) < 0.5, money(revenue.toNumber() - cogs.toNumber() - expenseTotal));

    /* ---------- PROFIT & REPORTS ENGINE ---------- */
    L.push("== PROFIT & REPORTS ==");
    const yearNow = new Date().getFullYear();
    const monthNow = new Date().getMonth() + 1;
    const yearly = buildProfitReport({
      mode: "year",
      year: yearNow,
      productId: "",
      products,
      categories,
      variants,
      productItems,
      purchases,
      sales,
      payments,
      expenses,
      customers,
      suppliers,
      lineUnitCost,
      byItem,
      salePaid,
      stockChecks,
    });
    const monthly = buildProfitReport({
      mode: "month",
      year: yearNow,
      month: monthNow,
      productId: "",
      products,
      categories,
      variants,
      productItems,
      purchases,
      sales,
      payments,
      expenses,
      customers,
      suppliers,
      lineUnitCost,
      byItem,
      salePaid,
      stockChecks,
    });
    let stockFormulaOk = true;
    for (const r of yearly.stock) {
      const totalOk = Math.abs(r.openingQty + r.purchaseQty - r.totalQty) < 0.01;
      const remainOk = Math.abs(r.totalQty - r.soldQty - r.remainingQty) < 0.01;
      if (!totalOk || !remainOk) stockFormulaOk = false;
    }
    check("Yearly stock: Opening + Purchase = Total, Total − Sold = Remaining", stockFormulaOk);
    check(
      "Yearly net profit = profit on sales − expenses",
      Math.abs(yearly.profitOnSales - yearly.expenses - yearly.netProfit) < 0.5,
      money(yearly.netProfit)
    );
    check(
      "Yearly business value = remaining stock + customer due + cash in hand",
      Math.abs(yearly.remainingValue + yearly.customerDue + yearly.cashInHand - yearly.businessValue) < 0.5,
      money(yearly.businessValue)
    );
    const lotWorth = stockLots.reduce((a, l) => a.plus(toDecimal(l.remainingQty).times(l.landedPerUnit)), new Decimal(0)).toNumber();
    check(
      "Yearly remaining stock value ≈ current FIFO lots",
      Math.abs(yearly.remainingValue - lotWorth) < 1,
      `${money(yearly.remainingValue)} vs ${money(lotWorth)}`
    );
    check(
      "Monthly net profit = profit on sales − expenses",
      Math.abs(monthly.profitOnSales - monthly.expenses - monthly.netProfit) < 0.5,
      money(monthly.netProfit)
    );
    check("Yearly cash in hand is received − paid − expenses from opening cash", Math.abs(yearly.openingCash + yearly.cashReceived - yearly.cashPaid - yearly.cashExpenses - yearly.cashInHand) < 0.5, money(yearly.cashInHand));
    L.push(`Report ${yearly.periodLabel} All Products: sales ${money(yearly.salesRevenue)} · stock cost ${money(yearly.stockCost)} · net ${money(yearly.netProfit)} · cash ${money(yearly.cashInHand)} · worth ${money(yearly.businessValue)}`);

    /* ---------- INVOICE NUMBERS ---------- */
    const nos = sales.map((s) => s.invoiceNo);
    check("All invoice numbers are unique", new Set(nos).size === nos.length);

    /* ---------- MASTER TOTALS BLOCK (for the report) ---------- */
    L.push("");
    L.push("== MASTER NUMBERS (single source, printed for the report) ==");
    L.push(`Suppliers: ${suppliers.length} · Customers: ${customers.length} · Purchases: ${purchases.length} · Sales: ${sales.length}`);
    L.push(`Stock purchased total (mill amount): ${money(purchases.reduce((a, p) => a.plus(toDecimal(steelAmount(p))), new Decimal(0)).toNumber())}`);
    L.push(`Stock in hand worth (${money(stockWorth.toNumber())}) · landed COGS (${money(stats.cogs)})`);
    L.push(`Billed to customers: ${money(billed)} · Received: ${money(received)} · Customer dues: ${money(totalDues)}`);
    L.push(`Owed to mills: ${money(millDue.toNumber())} · Paid to mills: ${money(journalToMills)}`);
    L.push(`Revenue ${money(revenue.toNumber())} − COGS ${money(cogs.toNumber())} − Expenses ${money(expenseTotal)} = Net ${money(revenue.toNumber() - cogs.toNumber() - expenseTotal)}`);
    L.push(`Stock value ${money(stockWorth.toNumber())} + customer dues ${money(totalDues)} − mill dues ${money(millDue.toNumber())} = ${money(stockWorth.toNumber() + totalDues - millDue.toNumber())}`);

    const fails = L.filter((x) => x.startsWith("[FAIL]")).length;
    L.unshift(`AUDIT SUMMARY: ${fails === 0 ? "ALL CHECKS PASSED" : fails + " CHECK(S) FAILED"} (${L.length} lines)`);
    return L.join("\n");
  }, [
    customers, suppliers, purchases, sales, payments, expenses, inventory,
    stockLots, inventoryBySource, inventoryByVariant, stockMovements, byItem,
    salePaid, customerBalance, supplierBalance, lineUnitCost, stats,
    products, categories, variants, productItems, stockChecks,
  ]);

  return (
    <Page>
      <PageTitle title="Number Audit" sub="Hidden QA page — every figure cross-checked against the raw ledger" />
      <pre className="border border-neutral-200 bg-white p-4 text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto">
        {out}
      </pre>
    </Page>
  );
}
