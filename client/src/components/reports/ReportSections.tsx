"use client";

import Link from "next/link";
import { fmtCompact, fmtMoney, fmtPct, fmtQtyWithUnit, qtyUnitLabel } from "@/lib/format";
import type { ProfitReport, QtyBlock, StockCheckView } from "@/lib/profitReport";
import { Section, StatementRow, StatementRule, StatementTotal } from "./shared";

function stockQty(n: number, unit: string) {
  return fmtQtyWithUnit(n, unit);
}

function checkQty(n: number, unit: string) {
  const v = n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  const u = qtyUnitLabel(unit);
  return u ? `${v} ${u}` : v;
}

function FlowRow({
  no,
  label,
  prefix,
  qty,
  unit,
  amount,
  strong,
}: {
  no: string;
  label: string;
  prefix?: string;
  qty: number;
  unit: string;
  amount?: number | null;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-[14px]">
      <span className="flex items-baseline gap-2 min-w-0">
        <span className="tabular-nums text-[11px] font-medium text-[#171717]/70 w-4 shrink-0">{no}</span>
        <span className="text-[#171717]/70">
          {prefix ? <span className="mr-1.5 font-medium">{prefix}</span> : null}
          {label}
        </span>
      </span>
      <span className="flex items-baseline gap-3 sm:gap-4 shrink-0">
        <span className={`w-20 sm:w-28 text-right tabular-nums ${strong ? "font-bold" : "font-medium"}`}>
          {stockQty(qty, unit)}
        </span>
        <span className={`w-24 sm:w-32 text-right tabular-nums ${strong ? "font-bold" : "font-medium"}`}>
          {amount == null ? "" : fmtMoney(amount)}
        </span>
      </span>
    </div>
  );
}

function StockBlock({ row }: { row: QtyBlock }) {
  const totalStockValue = row.openingValue + row.purchaseValue;
  return (
    <div className="border border-[#E5E5E5] rounded-[8px] p-4 sm:p-5">
      <p className="font-semibold mb-3">{row.productName}</p>
      <div>
        <div className="flex items-baseline justify-between gap-4 pb-1.5 border-b border-[#E5E5E5]">
          <span className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70">
            Stock Flow
          </span>
          <span className="flex items-baseline gap-3 sm:gap-4 shrink-0">
            <span className="w-20 sm:w-28 text-right text-[10px] uppercase tracking-widest font-medium text-[#171717]/70">
              Qty{qtyUnitLabel(row.unit) ? ` (${qtyUnitLabel(row.unit)})` : ""}
            </span>
            <span className="w-24 sm:w-32 text-right text-[10px] uppercase tracking-widest font-medium text-[#171717]/70">
              Rs
            </span>
          </span>
        </div>
        <FlowRow no="1" label="Opening Stock" qty={row.openingQty} unit={row.unit} amount={row.openingValue} />
        <FlowRow no="2" label="Purchase" prefix="+" qty={row.purchaseQty} unit={row.unit} amount={row.purchaseValue} />
        <FlowRow no="3" label="Total Stock" prefix="=" qty={row.totalQty} unit={row.unit} amount={totalStockValue} strong />
        <FlowRow no="4" label="Sold" prefix="−" qty={row.soldQty} unit={row.unit} amount={row.salesAmount} />
        <FlowRow no="5" label="Remaining (Closing)" prefix="=" qty={row.remainingQty} unit={row.unit} strong />
        <StatementTotal label="Valuation of Remaining Stock" value={row.remainingValue} dark />
      </div>
    </div>
  );
}

export function StockSummary({
  report,
  className = "",
}: {
  report: ProfitReport;
  className?: string;
}) {
  return (
    <Section title="Stock Summary" className={className}>
      {report.stock.length === 0 ? (
        <p className="text-[14px] text-[#171717]">No products to measure yet.</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 items-start">
          {report.stock.map((r) => (
            <StockBlock key={r.productId} row={r} />
          ))}
        </div>
      )}
    </Section>
  );
}

export function ProfitLoss({
  report,
  className = "",
}: {
  report: ProfitReport;
  className?: string;
}) {
  return (
    <Section title="Profit & Loss" className={className}>
      <div className="max-w-xl">
        <StatementRow label="Sales Revenue" value={report.salesRevenue} />
        <StatementRow label="Stock Cost" value={-report.stockCost} />
        <StatementRule />
        <StatementRow label="Profit on Sales" value={report.profitOnSales} />
        {report.expensesApplied ? (
          report.expenses > 0.001 ? (
            <StatementRow label="Expenses" value={-report.expenses} />
          ) : null
        ) : report.hasExpenses && report.productId ? (
          <p className="py-2.5 text-[13px] text-[#171717]/70">
            Shop-wide expenses show under All Products — these are this product&apos;s own.
          </p>
        ) : null}
        <StatementTotal label="Net Profit" value={report.netProfit} dark />
        <div className="flex items-baseline justify-between gap-4 pt-3">
          <span className="text-[#171717]/70 text-[14px]">Profit %</span>
          <span className="tabular-nums font-semibold">{report.salesRevenue > 0 ? fmtPct(report.profitPct) : "—"}</span>
        </div>
      </div>
    </Section>
  );
}

export function CashPosition({
  report,
  className = "",
}: {
  report: ProfitReport;
  className?: string;
}) {
  return (
    <Section title="Cash Position" className={className}>
      <div className="max-w-xl">
        <StatementRow label="Opening Cash" value={report.openingCash} />
        <StatementRow label="Cash Received" value={report.cashReceived} />
        <StatementRow label="Cash Paid" value={-report.cashPaid} />
        {report.expensesApplied ? <StatementRow label="Expenses" value={-report.cashExpenses} /> : null}
        <StatementTotal label="Cash in Hand" value={report.cashInHand} />
      </div>
    </Section>
  );
}

export function BusinessValue({
  report,
  className = "",
}: {
  report: ProfitReport;
  className?: string;
}) {
  return (
    <Section title="Business Value" className={className}>
      <div className="max-w-xl">
        <StatementRow label="Remaining Stock Value" value={report.remainingValue} />
        <StatementRow label="Customer Due" value={report.customerDue} />
        <StatementRow label="Cash in Hand" value={report.cashInHand} />
        <StatementTotal label="Total Business Value" value={report.businessValue} dark />
      </div>
    </Section>
  );
}

function PartyList({
  rows,
  empty,
}: {
  rows: { id: string; name: string; due: number }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-[14px] text-[#171717] py-1">{empty}</p>;
  }
  return (
    <ul>
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex items-baseline justify-between gap-3 py-2.5 border-b border-[#E5E5E5] last:border-b-0"
        >
          <span className="min-w-0 truncate font-medium">{r.name}</span>
          <span className={`tabular-nums font-semibold ${r.due > 0 ? "text-[#a12b1f]" : "text-[#171717]"}`}>
            {fmtCompact(r.due)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MoneySides({ report }: { report: ProfitReport }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
      <Section
        className="!mb-0"
        title="Money to Pay"
        action={
          <Link href="/purchases?tab=dues" className="text-[13px] font-medium min-h-[44px] inline-flex items-center">
            Payment Dues →
          </Link>
        }
      >
        <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70 mb-1">Supplier Due</p>
        <PartyList rows={report.suppliers} empty="Nothing owed to mills." />
        <StatementTotal label="Total Supplier Due" value={report.supplierDue} />
      </Section>
      <Section
        className="!mb-0"
        title="Money to Receive"
        action={
          <Link href="/sales" className="text-[13px] font-medium min-h-[44px] inline-flex items-center">
            Sales & Invoices →
          </Link>
        }
      >
        <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70 mb-1">Customer Due</p>
        <PartyList rows={report.customers} empty="No customer dues." />
        <StatementTotal label="Total Customer Due" value={report.customerDue} />
      </Section>
    </div>
  );
}

export function Expenses({
  report,
  className = "",
  onAdd,
}: {
  report: ProfitReport;
  className?: string;
  onAdd?: () => void;
}) {
  const addButton = onAdd ? (
    <button
      type="button"
      className="btn-ghost !py-2 !px-3 !text-xs min-h-[44px]"
      onClick={onAdd}
    >
      + Add Expense
    </button>
  ) : undefined;

  const pc = report.purchaseCharges;
  const sc = report.saleCharges;
  const purchaseRows = [
    { label: "Transport", v: pc.transport },
    { label: "Loading", v: pc.loading },
    { label: "Labour", v: pc.labour },
    { label: "Other", v: pc.other },
  ].filter((r) => r.v > 0.001);
  const saleRows = [
    { label: "Loading", v: sc.loading },
    { label: "Transport", v: sc.transport },
    { label: "Labour", v: sc.labour },
  ].filter((r) => r.v > 0.001);

  if (purchaseRows.length === 0 && saleRows.length === 0 && !report.expensesApplied) {
    return (
      <Section title="Expenses" className={className} action={addButton}>
        <p className="text-[14px] leading-relaxed text-[#171717]">
          No expenses recorded in this period.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Expenses" className={className} action={addButton}>
      <div className="max-w-xl">
        {purchaseRows.length > 0 ? (
          <>
            <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70 pt-1">
              Paid on Purchases
            </p>
            {purchaseRows.map((r) => (
              <StatementRow key={r.label} label={r.label} value={r.v} />
            ))}
            <StatementTotal
              label="Subtotal"
              value={purchaseRows.reduce((a, r) => a + r.v, 0)}
            />
          </>
        ) : null}

        {saleRows.length > 0 ? (
          <>
            <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70 pt-5">
              Paid on Sales
            </p>
            {saleRows.map((r) => (
              <StatementRow key={r.label} label={r.label} value={r.v} />
            ))}
            <StatementTotal
              label="Subtotal"
              value={saleRows.reduce((a, r) => a + r.v, 0)}
            />
          </>
        ) : null}

        {report.expensesApplied ? (
          <>
            <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70 pt-5">
              Other Expenses
            </p>
            {report.expenseRows.map((r) => (
              <StatementRow key={r.key} label={r.label} value={r.amount} />
            ))}
            <StatementTotal label="Total" value={report.expenses} />
          </>
        ) : null}
      </div>
    </Section>
  );
}

export function StockCheckPanel({
  report,
  onRecord,
  className = "",
}: {
  report: ProfitReport;
  onRecord: (productId: string) => void;
  className?: string;
}) {
  return (
    <Section title="Stock Count" className={className}>
      <div className="space-y-5">
        {report.stockChecks.map((row) => (
          <StockCheckRow key={row.productId} row={row} onRecord={() => onRecord(row.productId)} />
        ))}
      </div>
    </Section>
  );
}

function StockCheckRow({ row, onRecord }: { row: StockCheckView; onRecord: () => void }) {
  const shortage = row.difference != null && row.difference < -0.0005;
  const over = row.difference != null && row.difference > 0.0005;
  return (
    <div className={row.productName ? "border border-[#E5E5E5] rounded-[8px] p-4" : ""}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="font-semibold">{row.productName}</p>
        <button type="button" className="btn-ghost !py-2 !px-3 !text-xs min-h-[44px]" onClick={onRecord}>
          Record Count
        </button>
      </div>
      <div className="max-w-xl">
        <StatementRow label="Stock in Records" text={checkQty(row.systemQty, row.unit)} />
        <StatementRow
          label="Counted in Yard"
          text={row.physicalQty == null ? "Not counted yet" : checkQty(row.physicalQty, row.unit)}
        />
        {row.difference != null ? (
          <div className="flex items-baseline justify-between gap-4 py-2.5 text-[14px] border-t border-[#171717] mt-1">
            <span className="font-semibold">
              Difference{shortage ? " — short" : over ? " — over" : ""}
            </span>
            <span
              className={`tabular-nums font-bold ${
                shortage ? "text-[#a12b1f]" : over ? "text-[#2e6b2e]" : "text-[#171717]"
              }`}
            >
              {checkQty(row.difference, row.unit)}
            </span>
          </div>
        ) : (
          <p className="pt-2 text-[13px] text-[#171717]/70">
            Count what is actually in the yard and record it — then the difference shows here.
          </p>
        )}
      </div>
    </div>
  );
}
