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

function FlowCell({
  label,
  qty,
  unit,
  prefix,
  strong,
}: {
  label: string;
  qty: number;
  unit: string;
  prefix?: string;
  strong?: boolean;
}) {
  return (
    <div className={strong ? "min-w-0" : "min-w-0"}>
      <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70">{label}</p>
      <p className={`mt-1.5 tabular-nums leading-tight ${strong ? "text-[18px] sm:text-[20px] font-bold" : "text-[15px] font-semibold"}`}>
        {prefix ? <span className="text-[#171717]/60 font-medium mr-1">{prefix}</span> : null}
        {stockQty(qty, unit)}
      </p>
    </div>
  );
}

function StockBlock({ row }: { row: QtyBlock }) {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 sm:gap-3">
        <FlowCell label="Opening Stock" qty={row.openingQty} unit={row.unit} />
        <FlowCell label="Purchase" qty={row.purchaseQty} unit={row.unit} prefix="+" />
        <FlowCell label="Total Stock" qty={row.totalQty} unit={row.unit} prefix="=" />
        <FlowCell label="Sold Stock" qty={row.soldQty} unit={row.unit} prefix="−" />
        <FlowCell label="Remaining Stock" qty={row.remainingQty} unit={row.unit} prefix="=" strong />
      </div>
      <div className="mt-4 pt-4 border-t border-[#E5E5E5] grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70">Opening Value</p>
          <p className="mt-1 tabular-nums font-semibold">{fmtMoney(row.openingValue)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70">Purchase Value</p>
          <p className="mt-1 tabular-nums font-semibold">{fmtMoney(row.purchaseValue)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70">Remaining Stock Value</p>
          <p className="mt-1 tabular-nums font-bold">{fmtMoney(row.remainingValue)}</p>
        </div>
      </div>
    </div>
  );
}

export function StockSummary({ report }: { report: ProfitReport }) {
  const many = report.stock.length > 1;
  return (
    <Section title="Stock Summary">
      {report.stock.length === 0 ? (
        <p className="text-[14px] text-[#171717]">No products to measure yet.</p>
      ) : many ? (
        <>
          <div className="lg:hidden space-y-6">
            {report.stock.map((r) => (
              <div key={r.productId}>
                <p className="text-[13px] font-semibold mb-3">{r.productName}</p>
                <StockBlock row={r} />
              </div>
            ))}
          </div>
          <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest font-medium border-b border-[#E5E5E5]">
                <th className="text-left py-2 pr-3 font-medium">Product</th>
                <th className="text-right py-2 px-2 font-medium">Opening</th>
                <th className="text-right py-2 px-2 font-medium">Purchase</th>
                <th className="text-right py-2 px-2 font-medium">Total</th>
                <th className="text-right py-2 px-2 font-medium">Sold</th>
                <th className="text-right py-2 pl-2 font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {report.stock.map((r) => (
                <tr key={r.productId} className="border-b border-[#E5E5E5] last:border-b-0">
                  <td className="py-3 pr-3 font-semibold">{r.productName}</td>
                  <td className="py-3 px-2 text-right tabular-nums">{stockQty(r.openingQty, r.unit)}</td>
                  <td className="py-3 px-2 text-right tabular-nums">{stockQty(r.purchaseQty, r.unit)}</td>
                  <td className="py-3 px-2 text-right tabular-nums">{stockQty(r.totalQty, r.unit)}</td>
                  <td className="py-3 px-2 text-right tabular-nums">{stockQty(r.soldQty, r.unit)}</td>
                  <td className="py-3 pl-2 text-right tabular-nums font-bold">{stockQty(r.remainingQty, r.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 pt-4 border-t border-[#E5E5E5] grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70">Opening Value</p>
              <p className="mt-1 tabular-nums font-semibold">{fmtMoney(report.openingValue)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70">Purchase Value</p>
              <p className="mt-1 tabular-nums font-semibold">{fmtMoney(report.purchaseValue)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70">Remaining Stock Value</p>
              <p className="mt-1 tabular-nums font-bold">{fmtMoney(report.remainingValue)}</p>
            </div>
          </div>
          </div>
        </>
      ) : (
        <StockBlock row={report.stock[0]} />
      )}
    </Section>
  );
}

export function ProfitLoss({ report }: { report: ProfitReport }) {
  return (
    <Section title="Profit & Loss">
      <div className="max-w-xl">
        <StatementRow label="Sales Revenue" value={report.salesRevenue} />
        <StatementRow label="Stock Cost" value={-report.stockCost} />
        <StatementRule />
        <StatementRow label="Profit on Sales" value={report.profitOnSales} />
        {report.expensesApplied ? (
          <StatementRow label="Expenses" value={-report.expenses} />
        ) : (
          <p className="py-2.5 text-[13px] text-[#171717]/70">
            Shop expenses stay on All Products — they are not this product&apos;s cost.
          </p>
        )}
        <StatementTotal label="Net Profit" value={report.netProfit} dark />
        <div className="flex items-baseline justify-between gap-4 pt-3">
          <span className="text-[#171717]/70 text-[14px]">Profit %</span>
          <span className="tabular-nums font-semibold">{report.salesRevenue > 0 ? fmtPct(report.profitPct) : "—"}</span>
        </div>
      </div>
    </Section>
  );
}

export function CashPosition({ report }: { report: ProfitReport }) {
  return (
    <Section title="Cash Position">
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

export function BusinessValue({ report }: { report: ProfitReport }) {
  return (
    <Section title="Business Value">
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
  days,
}: {
  rows: { id: string; name: string; due: number; days?: number }[];
  empty: string;
  days?: boolean;
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
          <span className="flex items-baseline gap-4 shrink-0">
            {days && r.days != null ? (
              <span className="tabular-nums text-[13px] text-[#171717]/70">{r.days} days</span>
            ) : null}
            <span className={`tabular-nums font-semibold ${r.due > 0 ? "text-[#a12b1f]" : "text-[#171717]"}`}>
              {fmtCompact(r.due)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MoneySides({ report }: { report: ProfitReport }) {
  const aging = [
    { label: "0–30 Days", value: report.aging.d0_30 },
    { label: "31–60 Days", value: report.aging.d31_60 },
    { label: "61–90 Days", value: report.aging.d61_90 },
    { label: "90+ Days", value: report.aging.d90 },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
      <Section
        className="!mb-0"
        title="Money to Pay"
        action={
          <Link href="/suppliers" className="text-[13px] font-medium min-h-[44px] inline-flex items-center">
            View All →
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
          <Link href="/customers" className="text-[13px] font-medium min-h-[44px] inline-flex items-center">
            View All →
          </Link>
        }
      >
        <p className="text-[11px] uppercase tracking-widest font-medium text-[#171717]/70 mb-1">Customer Due</p>
        <PartyList rows={report.customers} empty="No customer dues." days />
        <StatementTotal label="Total Customer Due" value={report.customerDue} />
        {report.customerDue > 0.001 ? (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {aging.map((a) => (
              <div key={a.label} className="border border-[#E5E5E5] rounded-[8px] p-2.5">
                <p className="text-[10px] uppercase tracking-widest font-medium">{a.label}</p>
                <p className="mt-1 tabular-nums text-[13px] font-semibold">{fmtCompact(a.value)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </Section>
    </div>
  );
}

export function Expenses({ report }: { report: ProfitReport }) {
  if (!report.expensesApplied) {
    return (
      <Section title="Expenses">
        <p className="text-[14px] leading-relaxed text-[#171717]">
          Rent, labour and other shop costs belong to the whole business. Open All Products to see them.
        </p>
      </Section>
    );
  }
  return (
    <Section title="Expenses">
      <div className="max-w-xl">
        {report.expenseRows.map((r) => (
          <StatementRow key={r.key} label={r.label} value={r.amount} />
        ))}
        <StatementTotal label="Total" value={report.expenses} />
      </div>
    </Section>
  );
}

export function StockCheckPanel({
  report,
  onRecord,
}: {
  report: ProfitReport;
  onRecord: (productId: string) => void;
}) {
  return (
    <Section title="Stock Check">
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
          Record Stock Check
        </button>
      </div>
      <div className="max-w-xl">
        <StatementRow label="System Stock" text={checkQty(row.systemQty, row.unit)} />
        <StatementRow
          label="Physical Stock"
          text={row.physicalQty == null ? "Not Checked" : checkQty(row.physicalQty, row.unit)}
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
          <p className="pt-2 text-[13px] text-[#171717]/70">Count the yard before this line can fill in.</p>
        )}
      </div>
    </div>
  );
}
