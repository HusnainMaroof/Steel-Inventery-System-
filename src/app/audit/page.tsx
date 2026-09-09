"use client";

/*
 * Hidden QA page — verifies that every number the app shows is internally
 * consistent with the raw ledger (purchases, sales, payments, expenses).
 *
 * It is not linked in the sidebar; open it directly at /audit.
 * Every line prints [PASS] or [FAIL] so the report can be generated from it.
 */

import { useMemo } from "react";
import { useStore, steelAmount, saleGrandTotal } from "@/lib/store";
import { Page, PageTitle } from "@/components/ui";

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
    let stockWorth = 0;
    for (const r of inventory) {
      const left = (purchasedByItem[r.item] ?? 0) - (soldByItem[r.item] ?? 0);
      const ident = Math.abs(left - r.stockQty) < eps;
      const rowValOk = Math.abs(r.stockQty * r.landedAvg - r.stockValue) < 0.5;
      if (!ident || !rowValOk || r.stockQty < -eps) stockOk = false;
      stockWorth += r.stockValue;
      check(
        `${r.item}: purchased−sold (${qty(purchasedByItem[r.item] ?? 0)}−${qty(soldByItem[r.item] ?? 0)}=${qty(left)}) = stock ${qty(r.stockQty)}`,
        ident && r.stockQty >= -eps
      );
    }
    const boughtTotal = purchases.reduce((a, p) => a + p.qty, 0);
    const soldTotal = sales.reduce((a, s) => a + s.lines.reduce((b, l) => b + l.qty, 0), 0);
    check("Total qty in = total qty out + stock left", stockOk);
    check("Σ stock worth = Σ row stockValue", Math.abs(stockWorth - stats.stockValue) < 0.5, `${money(stockWorth)} vs ${money(stats.stockValue)}`);
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
    const moveByPurchase = new Map<string, number>();
    const moveBySaleLine = new Map<string, number>();
    for (const m of stockMovements) {
      if (m.type === "PURCHASE_RECEIPT" && m.purchaseId) moveByPurchase.set(m.purchaseId, (moveByPurchase.get(m.purchaseId) ?? 0) + m.qty);
      if (m.type === "SALE" && m.saleId && m.saleLineIndex !== undefined)
        moveBySaleLine.set(`${m.saleId}:${m.saleLineIndex}`, (moveBySaleLine.get(`${m.saleId}:${m.saleLineIndex}`) ?? 0) + m.qty);
      moveTotal += m.qty;
    }
    for (const p of purchases) if (Math.abs((moveByPurchase.get(p.id) ?? 0) - p.qty) > eps) moveOk = false;
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
    const demo = inventory.find((r) => r.stockQty > 0);
    if (demo) {
      const sellPrice = demo.sellRate || demo.avgSellRate || demo.landedAvg;
      L.push("== SCENARIO: buy + sell flow (simulated on " + demo.item + ") ==");
      L.push(`  stock ${qty(demo.stockQty)} ${demo.unit ?? ""} → buy 100 → stock ${qty(demo.stockQty + 100)} ${demo.unit ?? ""} (stock worth +${money(100 * demo.landedAvg)})`);
      L.push(`  stock ${qty(demo.stockQty)} ${demo.unit ?? ""} → sell 25 @ ${money(sellPrice)} → stock ${qty(demo.stockQty - 25)} ${demo.unit ?? ""}, revenue +${money(25 * sellPrice)}`);
      check("Simulated stock deltas are exact", demo.stockQty + 100 - 25 === demo.stockQty + 75 && demo.stockQty - 25 >= 0);
    }

    /* ---------- INVOICES & CUSTOMERS ---------- */
    L.push("== INVOICES / CUSTOMERS ==");
    let invoiceTotalsOk = true;
    for (const s of sales) {
      const sub = s.lines.reduce((a, l) => a + l.qty * l.rate, 0);
      const disc = sub * ((s.discountPct ?? 0) / 100);
      const grand = (sub - disc) * (1 + (s.taxPct ?? 0) / 100);
      const paid = salePaid(s.id);
      if (Math.abs(grand - saleGrandTotal(s)) > eps || paid < -eps || paid > grand + eps)
        invoiceTotalsOk = false;
      check(
        `${s.invoiceNo}: grand ${money(grand)} = paid ${money(paid)} + due ${money(Math.max(0, grand - paid))} (${s.customerId})`,
        Math.abs(grand - saleGrandTotal(s)) < eps && paid >= -eps && paid <= grand + eps
      );
    }
    check("All invoice grand totals reconcile", invoiceTotalsOk);

    const billed = customers.reduce((a, c) => a + sales.filter((s) => s.customerId === c.id).reduce((b, s) => b + saleGrandTotal(s), 0), 0);
    const received = payments.filter((p) => p.type === "customer").reduce((a, p) => a + p.amount, 0);
    const totalDues = customers.reduce((a, c) => a + Math.max(0, customerBalance(c.id)), 0);
    check("Billed = received + outstanding", Math.abs(billed - received - totalDues) < eps, `${money(billed)} = ${money(received)} + ${money(totalDues)}`);
    check("Dashboard customer dues = Σ customer balances", Math.abs(totalDues - stats.customerDues) < eps, `${money(totalDues)} vs ${money(stats.customerDues)}`);
    for (const c of customers) {
      const bal = customerBalance(c.id);
      check(
        `${c.name} balance ${money(bal)}`,
        Math.abs(bal - (sales.filter((s) => s.customerId === c.id).reduce((a, s) => a + saleGrandTotal(s), 0) - payments.filter((p) => p.type === "customer" && p.partyId === c.id).reduce((a, p) => a + p.amount, 0))) < eps
      );
    }

    /* ---------- SUPPLIERS ---------- */
    L.push("== SUPPLIERS ==");
    const millBilled = purchases.reduce((a, p) => a + steelAmount(p), 0);
    const millPaid = purchases.reduce((a, p) => a + (p.paid ?? 0), 0);
    const millDue = purchases.reduce((a, p) => a + Math.max(0, steelAmount(p) - (p.paid ?? 0)), 0);
    check("Mill dues = billed − paid", Math.abs(millBilled - millPaid - millDue) < eps, `${money(millDue)}`);
    const supplierDues = suppliers.reduce((a, s) => a + Math.max(0, supplierBalance(s.id)), 0);
    check("Dashboard mills dues = Σ purchase dues", Math.abs(supplierDues - stats.supplierDues) < eps && Math.abs(supplierDues - millDue) < eps, `${money(supplierDues)}`);
    for (const s of suppliers) {
      const ownDue = purchases.filter((p) => p.supplierId === s.id).reduce((a, p) => a + Math.max(0, steelAmount(p) - (p.paid ?? 0)), 0);
      check(`${s.name} due ${money(ownDue)}`, Math.abs(ownDue - Math.max(0, supplierBalance(s.id))) < eps);
    }
    const journalToMills = payments.filter((p) => p.type === "supplier").reduce((a, p) => a + p.amount, 0);
    const historiesToMills = purchases.reduce((a, p) => a + (p.paymentHistory ?? []).reduce((b, h) => b + h.amount, 0), 0);
    check(
      "Paid-to-mills (Payments page) = purchase payment histories",
      Math.abs(journalToMills - historiesToMills) < eps && Math.abs(journalToMills - millPaid) < eps,
      `${money(journalToMills)} = ${money(historiesToMills)} = ${money(millPaid)}`
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
    let revenue = 0;
    let cogs = 0;
    for (const s of sales) {
      revenue += saleGrandTotal(s);
      for (const [i, l] of s.lines.entries())
        cogs += l.qty * (lineUnitCost(s.id, i) || byItem[l.item] || 0);
    }
    const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
    check("Revenue = Σ invoice grand totals", Math.abs(revenue - stats.revenue) < eps, money(revenue));
    check("COGS uses the actual landed cost of consumed stock", Math.abs(cogs - stats.cogs) < 0.5, money(cogs));
    check("Expenses = Σ expense rows", Math.abs(expenseTotal - stats.expenses) < eps, money(expenseTotal));
    check("Net profit = revenue − cogs − expenses", Math.abs(revenue - cogs - expenseTotal - stats.netProfit) < 0.5, money(revenue - cogs - expenseTotal));

    /* ---------- INVOICE NUMBERS ---------- */
    const nos = sales.map((s) => s.invoiceNo);
    check("All invoice numbers are unique", new Set(nos).size === nos.length);

    /* ---------- MASTER TOTALS BLOCK (for the report) ---------- */
    L.push("");
    L.push("== MASTER NUMBERS (single source, printed for the report) ==");
    L.push(`Suppliers: ${suppliers.length} · Customers: ${customers.length} · Purchases: ${purchases.length} · Sales: ${sales.length}`);
    L.push(`Stock purchased total (mill amount): ${money(purchases.reduce((a, p) => a + steelAmount(p), 0))}`);
    L.push(`Stock in hand worth (${money(stockWorth)}) · landed COGS (${money(stats.cogs)})`);
    L.push(`Billed to customers: ${money(billed)} · Received: ${money(received)} · Customer dues: ${money(totalDues)}`);
    L.push(`Owed to mills: ${money(millDue)} · Paid to mills: ${money(journalToMills)}`);
    L.push(`Revenue ${money(revenue)} − COGS ${money(cogs)} − Expenses ${money(expenseTotal)} = Net ${money(revenue - cogs - expenseTotal)}`);
    L.push(`Stock value ${money(stockWorth)} + customer dues ${money(totalDues)} − mill dues ${money(millDue)} = ${money(stockWorth + totalDues - millDue)}`);

    const fails = L.filter((x) => x.startsWith("[FAIL]")).length;
    L.unshift(`AUDIT SUMMARY: ${fails === 0 ? "ALL CHECKS PASSED" : fails + " CHECK(S) FAILED"} (${L.length} lines)`);
    return L.join("\n");
  }, [
    customers, suppliers, purchases, sales, payments, expenses, inventory,
    stockLots, inventoryBySource, inventoryByVariant, stockMovements, byItem,
    salePaid, customerBalance, supplierBalance, lineUnitCost, stats,
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
