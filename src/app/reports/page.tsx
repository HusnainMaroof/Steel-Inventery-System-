"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Page, PageTitle, CustomSelect, EmptyState, Modal, useToggle } from "@/components/ui";
import { fmtCompact, fmtMoney, fmtPct, monthLabel } from "@/lib/format";
import { Kpi, MoneyRow } from "@/components/reports/shared";
import {
  PERIOD_OPTIONS,
  customerDueOf,
  downloadReportCsv,
  inDateRange,
  lineAmount,
  matchesProduct,
  monthKeysInRange,
  printReportPdf,
  productMapsOf,
  profitPct,
  purchaseAmount,
  rangeLabel,
  recordProductId,
  reportRange,
  supplierDueOf,
  yearKeysInRange,
  ymd,
  type PerfRow,
  type ReportPeriod,
} from "@/lib/reports";

export default function ReportsPage() {
  const {
    purchases,
    sales,
    inventoryByVariant,
    byItem,
    lineUnitCost,
    products,
    categories,
    variants,
    productItems,
    salePaid,
    customers,
    suppliers,
    customerBalance,
    supplierBalance,
  } = useStore();

  const now = new Date();
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [customFrom, setCustomFrom] = useState(() => ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customTo, setCustomTo] = useState(() => ymd(now));
  const [productId, setProductId] = useState("");
  const [perfKind, setPerfKind] = useState<"month" | "year">("month");
  const exportUi = useToggle();

  const maps = useMemo(
    () => productMapsOf(variants, categories, productItems),
    [variants, categories, productItems]
  );
  const productOf = useCallback(
    (r: { categoryId?: string; variantId?: string; item: string }) =>
      recordProductId(r, maps.varProd, maps.catProd, maps.itemProd),
    [maps]
  );
  const match = useCallback(
    (r: { categoryId?: string; variantId?: string; item: string }) => matchesProduct(r, productId, productOf),
    [productId, productOf]
  );

  const { from, to } = useMemo(
    () => reportRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const productOptions = useMemo(
    () => [
      { value: "", label: "All products" },
      ...products.filter((p) => p.active !== false).map((p) => ({ value: p.id, label: p.name })),
    ],
    [products]
  );
  const productLabel = productOptions.find((o) => o.value === productId)?.label ?? "All products";
  const dateLabel = rangeLabel(period, from, to);

  const scopedPurchases = useMemo(
    () => purchases.filter((p) => inDateRange(p.date, from, to) && match(p)),
    [purchases, from, to, match]
  );

  const scopedSaleLines = useMemo(() => {
    const rows: {
      date: string;
      saleId: string;
      lineIdx: number;
      line: (typeof sales)[number]["lines"][number];
    }[] = [];
    for (const s of sales) {
      if (!inDateRange(s.date, from, to)) continue;
      s.lines.forEach((line, lineIdx) => {
        if (match(line)) rows.push({ date: s.date, saleId: s.id, lineIdx, line });
      });
    }
    return rows;
  }, [sales, from, to, match]);

  const stockValue = useMemo(
    () =>
      inventoryByVariant
        .filter((r) => !productId || r.productId === productId)
        .reduce((a, r) => a + r.stockValue, 0),
    [inventoryByVariant, productId]
  );

  const purchased = scopedPurchases.reduce((a, p) => a + purchaseAmount(p), 0);
  const sold = scopedSaleLines.reduce((a, r) => a + lineAmount(r.line), 0);
  const stockCost = scopedSaleLines.reduce(
    (a, r) => a + r.line.qty * (lineUnitCost(r.saleId, r.lineIdx) || byItem[r.line.item] || 0),
    0
  );
  const profit = sold - stockCost;
  const pct = profitPct(sold, profit);

  const customerDue = useMemo(() => {
    if (!productId)
      return customers.reduce((a, c) => a + Math.max(0, customerBalance(c.id)), 0);
    return customerDueOf(sales, salePaid, productId, match);
  }, [productId, customers, customerBalance, sales, salePaid, match]);
  const supplierDue = useMemo(() => {
    if (!productId)
      return suppliers.reduce((a, s) => a + Math.max(0, supplierBalance(s.id)), 0);
    return supplierDueOf(purchases, productId, match);
  }, [productId, suppliers, supplierBalance, purchases, match]);

  const perf = useMemo<PerfRow[]>(() => {
    const keys = perfKind === "year" ? yearKeysInRange(from, to) : monthKeysInRange(from, to);
    const map = new Map(keys.map((k) => [k, { purchases: 0, sales: 0, stockCost: 0 }]));
    const keyOf = (date: string) => (perfKind === "year" ? date.slice(0, 4) : date.slice(0, 7));
    for (const p of scopedPurchases) {
      const row = map.get(keyOf(p.date));
      if (row) row.purchases += purchaseAmount(p);
    }
    for (const r of scopedSaleLines) {
      const row = map.get(keyOf(r.date));
      if (!row) continue;
      row.sales += lineAmount(r.line);
      row.stockCost += r.line.qty * (lineUnitCost(r.saleId, r.lineIdx) || byItem[r.line.item] || 0);
    }
    return keys
      .map((key) => {
        const row = map.get(key)!;
        return {
          key,
          label: perfKind === "year" ? key : monthLabel(key),
          purchases: row.purchases,
          sales: row.sales,
          profit: row.sales - row.stockCost,
        };
      })
      .filter((r) => r.purchases !== 0 || r.sales !== 0);
  }, [perfKind, from, to, scopedPurchases, scopedSaleLines, lineUnitCost, byItem]);

  const exportPayload = {
    dateLabel,
    productLabel,
    purchased,
    sold,
    profit,
    stockCost,
    stockValue,
    customerDue,
    supplierDue,
    perfKind,
    perf,
  };

  const hasAny = purchases.length > 0 || sales.length > 0;

  return (
    <Page>
      <PageTitle title="Profit & Reports" />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <CustomSelect
          compact
          className="min-w-[10rem]"
          value={period}
          onChange={(v) => setPeriod(v as ReportPeriod)}
          options={PERIOD_OPTIONS}
        />
        {period === "custom" && (
          <>
            <label className="flex items-center gap-2 text-[12px] font-medium">
              <span className="text-black/60">From</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="!w-auto !text-xs"
              />
            </label>
            <label className="flex items-center gap-2 text-[12px] font-medium">
              <span className="text-black/60">To</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="!w-auto !text-xs"
              />
            </label>
          </>
        )}
        <CustomSelect
          compact
          className="min-w-[10.5rem]"
          value={productId}
          onChange={setProductId}
          options={productOptions}
        />
        <button type="button" className="btn-ghost !py-2 !px-3.5 !text-xs" onClick={exportUi.onOpen}>
          Export
        </button>
      </div>

      {!hasAny ? (
        <EmptyState
          emoji=""
          title="Nothing to show yet"
          hint="Add a purchase or a sale and this page will fill in."
          action={
            <Link href="/purchases" className="btn-primary">
              + Add Purchase
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <Kpi label="Total purchases" value={purchased} />
            <Kpi label="Total sales" value={sold} />
            <Kpi label="Profit" value={profit} tone={profit >= 0 ? "ok" : "due"} dark />
            <Kpi label="Stock value" value={stockValue} />
            <Kpi label="Customer due" value={customerDue} tone="due" />
            <Kpi label="Supplier due" value={supplierDue} tone="due" />
          </div>

          <div className="border border-neutral-200 bg-white p-4 sm:p-5 max-w-lg mb-8">
            <p className="text-[11px] uppercase tracking-widest font-medium text-black/60 mb-3">Profit calculation</p>
            <MoneyRow label="Sales" value={sold} />
            <MoneyRow label="Stock cost" value={stockCost} />
            <MoneyRow label="Profit" value={profit} strong line />
            <MoneyRow label="Profit %" text={sold > 0 ? fmtPct(pct) : "—"} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] uppercase tracking-widest font-medium text-black">Business performance</h2>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-white border border-neutral-200">
              {(["month", "year"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPerfKind(k)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                    perfKind === k ? "bg-[#171717] text-white" : "text-black hover:bg-neutral-50"
                  }`}
                >
                  {k === "month" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
          </div>

          {perf.every((r) => r.purchases === 0 && r.sales === 0) ? (
            <EmptyState
              emoji=""
              compact
              title="No buys or sales in this period."
              hint="Pick another date range or product."
            />
          ) : (
            <div className="border border-neutral-200 bg-white overflow-x-auto mb-8">
              <div className="hidden sm:grid grid-cols-[minmax(8rem,1.2fr)_7.5rem_7.5rem_7.5rem] gap-2 px-4 py-2.5 text-[11px] uppercase tracking-widest font-medium border-b border-neutral-200">
                <span>{perfKind === "year" ? "Year" : "Month"}</span>
                <span className="text-right">Purchases</span>
                <span className="text-right">Sales</span>
                <span className="text-right">Profit</span>
              </div>
              {perf.map((r) => (
                <div key={r.key} className="px-4 py-3 border-b border-neutral-100 last:border-b-0">
                  <div className="sm:hidden">
                    <p className="font-semibold text-[13px]">{r.label}</p>
                    <div className="mt-1.5 grid grid-cols-3 gap-2 text-[12px]">
                      <div>
                        <p className="text-black/60">Purchases</p>
                        <p className="tabular-nums font-medium">{fmtCompact(r.purchases)}</p>
                      </div>
                      <div>
                        <p className="text-black/60">Sales</p>
                        <p className="tabular-nums font-medium">{fmtCompact(r.sales)}</p>
                      </div>
                      <div>
                        <p className="text-black/60">Profit</p>
                        <p className="tabular-nums font-medium">{fmtCompact(r.profit)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:grid grid-cols-[minmax(8rem,1.2fr)_7.5rem_7.5rem_7.5rem] gap-2 text-[13px] items-baseline">
                    <span>{r.label}</span>
                    <span className="tabular-nums text-right">{fmtMoney(r.purchases)}</span>
                    <span className="tabular-nums text-right">{fmtMoney(r.sales)}</span>
                    <span className="tabular-nums text-right font-medium">{fmtMoney(r.profit)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-[11px] uppercase tracking-widest font-medium text-black mb-3">Money owed</h2>
          <div className="border border-neutral-200 bg-white p-4 sm:p-5 max-w-lg">
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="text-black/60 text-[14px]">Customer due</span>
              <div className="flex items-baseline gap-3">
                <span className={`tabular-nums text-[14px] font-medium ${customerDue > 0 ? "text-[#a12b1f]" : "text-black"}`}>
                  {fmtMoney(customerDue)}
                </span>
                <Link href="/customers" className="text-[12px] font-medium whitespace-nowrap">
                  View details
                </Link>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2.5 border-t border-neutral-200">
              <span className="text-black/60 text-[14px]">Supplier due</span>
              <div className="flex items-baseline gap-3">
                <span className={`tabular-nums text-[14px] font-medium ${supplierDue > 0 ? "text-[#a12b1f]" : "text-black"}`}>
                  {fmtMoney(supplierDue)}
                </span>
                <Link href="/suppliers" className="text-[12px] font-medium whitespace-nowrap">
                  View details
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      <Modal
        open={exportUi.open}
        onClose={exportUi.onClose}
        title="Export report"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                downloadReportCsv(exportPayload);
                exportUi.onClose();
              }}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                printReportPdf(exportPayload);
                exportUi.onClose();
              }}
            >
              Export PDF
            </button>
          </div>
        }
      >
        <p className="text-[14px]">
          <span className="text-black/60">Date</span>
          <span className="block mt-0.5 font-medium">{dateLabel}</span>
        </p>
        <p className="text-[14px] mt-4">
          <span className="text-black/60">Product</span>
          <span className="block mt-0.5 font-medium">{productLabel}</span>
        </p>
      </Modal>
    </Page>
  );
}
