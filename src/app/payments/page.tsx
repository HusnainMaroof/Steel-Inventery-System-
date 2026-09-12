"use client";

import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useStore } from "@/lib/store";
import { Page, PageTitle, EmptyState } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { fmtMoney, fmtDate } from "@/lib/format";

type PaymentRow = {
  id: string;
  date: string;
  type: "customer" | "supplier";
  partyName: string;
  invoiceNo: string;
  method: string;
  note: string | undefined;
  amount: number;
};

type PeriodKey = "all" | "month" | "year" | "custom";

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Pick month" },
];

export default function PaymentsPage() {
  const { payments, customers, suppliers, sales } = useStore();

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "customer" | "supplier">("all");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customMonth, setCustomMonth] = useState(""); // yyyy-mm

  const periodLabel =
    period === "all"
      ? "All time"
      : period === "month"
        ? new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })
        : period === "year"
          ? String(new Date().getFullYear())
          : customMonth
            ? new Date(`${customMonth}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
            : "Pick a month";

  const inPeriod = (date: string) => {
    if (period === "all") return true;
    const d = new Date(date);
    if (period === "month") {
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === "year") return d.getFullYear() === new Date().getFullYear();
    if (!customMonth) return true;
    const [y, m] = customMonth.split("-").map(Number);
    return d.getFullYear() === y && d.getMonth() === m - 1;
  };

  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        if (typeFilter !== "all" && p.type !== typeFilter) return false;
        if (!inPeriod(p.date)) return false;
        const q = appliedSearch.toLowerCase().trim();
        if (q) {
          const name = p.type === "customer"
            ? customers.find((c) => c.id === p.partyId)?.name ?? ""
            : suppliers.find((s) => s.id === p.partyId)?.name ?? "";
          if (!name.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, customers, suppliers, appliedSearch, typeFilter, period, customMonth]
  );

  const rows: PaymentRow[] = useMemo(
    () =>
      filtered.map((p) => ({
        id: p.id,
        date: p.date,
        type: p.type,
        partyName: p.type === "customer"
          ? customers.find((c) => c.id === p.partyId)?.name ?? ""
          : suppliers.find((s) => s.id === p.partyId)?.name ?? "",
        invoiceNo: p.type === "customer" && p.saleId
          ? sales.find((s) => s.id === p.saleId)?.invoiceNo ?? "—"
          : "—",
        method: p.method,
        note: p.note,
        amount: p.amount,
      })),
    [filtered, customers, suppliers, sales]
  );

  const totalReceived = filtered.filter((p) => p.type === "customer").reduce((a, p) => a + p.amount, 0);
  const totalPaid = filtered.filter((p) => p.type === "supplier").reduce((a, p) => a + p.amount, 0);

  const clearAll = () => {
    setSearchInput("");
    setAppliedSearch("");
    setTypeFilter("all");
    setPeriod("all");
    setCustomMonth("");
  };
  const hasActiveFilters =
    appliedSearch.trim() !== "" || typeFilter !== "all" || period !== "all";

  const columns: ColumnDef<PaymentRow, unknown>[] = [
    {
      accessorKey: "date",
      header: "Date",
      meta: { card: { position: "date" } },
      cell: ({ getValue }) => <span className="text-xs whitespace-nowrap">{fmtDate(getValue() as string)}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      meta: { card: { position: "badge" } },
      cell: ({ getValue }) => (
        <span className={`text-xs border px-2 py-0.5 uppercase tracking-wider ${getValue() === "customer" ? "border-[#cfe3cd] text-[#2e6b2e]" : "border-[#d2e0f2] text-[#1f4e8c]"}`}>
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "partyName",
      header: "Party",
      meta: { card: { position: "primary" } },
      cell: ({ getValue }) => <span className="font-medium text-xs">{getValue() as string}</span>,
    },
    {
      accessorKey: "invoiceNo",
      header: "Invoice",
      meta: { hiddenOnMobile: true, card: { position: "secondary" } },
      cell: ({ getValue }) => <span className="text-xs text-neutral-500">{getValue() as string}</span>,
    },
    {
      accessorKey: "method",
      header: "Method",
      meta: { hiddenOnMobile: true },
      cell: ({ getValue }) => <span className="text-xs">{getValue() as string}</span>,
    },
    {
      accessorKey: "note",
      header: "Note",
      meta: { hiddenOnMobile: true },
      cell: ({ getValue }) => <span className="text-xs text-neutral-500">{(getValue() as string) ?? "—"}</span>,
    },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { align: "right", card: { position: "amount" } },
      cell: ({ getValue, row }) => (
        <span className="font-medium text-xs tabular-nums">
          {row.original.type === "customer" ? "+" : "−"} {fmtMoney(getValue() as number)}
        </span>
      ),
    },
  ];

  return (
    <Page>
      <PageTitle
        title="Payments"
        sub="Money received from customers and paid to mills"
      />

      {/* ── summary bar (follows the active filters) ── */}
      {payments.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2.5">
            <p className="text-[12px] text-neutral-500">
              {filtered.length} payment{filtered.length === 1 ? "" : "s"} · <span className="font-medium text-neutral-700">{periodLabel}</span>
            </p>
            {hasActiveFilters && (
              <button onClick={clearAll} className="text-[12px] text-neutral-400 hover:text-black underline underline-offset-2">
                Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="border border-neutral-200 bg-white p-4">
              <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Received from customers</span>
              <span className="block text-xl font-semibold tabular-nums mt-1 text-[#2e6b2e]">{fmtMoney(totalReceived)}</span>
            </div>
            <div className="border border-neutral-200 bg-white p-4">
              <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Paid to mills</span>
              <span className="block text-xl font-semibold tabular-nums mt-1 text-[#1f4e8c]">{fmtMoney(totalPaid)}</span>
            </div>
            <div className={`p-4 ${totalReceived - totalPaid >= 0 ? "border border-black bg-black text-white" : "border border-[#f0d2cc] bg-[#fdf1ef]"}`}>
              <span className={`block text-[11px] uppercase tracking-widest ${totalReceived - totalPaid >= 0 ? "text-neutral-400" : "text-[#a12b1f]/70"}`}>Net cash flow</span>
              <span className={`block text-xl font-semibold tabular-nums mt-1 ${totalReceived - totalPaid >= 0 ? "" : "text-[#a12b1f]"}`}>
                {fmtMoney(totalReceived - totalPaid)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── period filter ── */}
      {payments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="inline-flex border border-neutral-200 rounded-md overflow-hidden bg-white">
            {PERIOD_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setPeriod(t.key); if (t.key !== "custom") setCustomMonth(""); }}
                className={`px-3.5 py-2 text-xs font-medium transition-colors ${
                  period === t.key ? "bg-black text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <input
              type="month"
              value={customMonth}
              max={new Date().toISOString().slice(0, 7)}
              onChange={(e) => setCustomMonth(e.target.value)}
              className="!w-auto !py-2 text-xs"
            />
          )}
        </div>
      )}

      {/* ── type + search filters ── */}
      {payments.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="flex flex-1 sm:max-w-96">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "customer" | "supplier")}
              className="!w-auto !rounded-r-none !border-r-0"
            >
              <option value="all">All</option>
              <option value="customer">Received</option>
              <option value="supplier">Paid</option>
            </select>
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by party name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setAppliedSearch(searchInput); }}
                className="!w-full !rounded-l-none !pl-9"
              />
            </div>
          </div>
          <button onClick={() => setAppliedSearch(searchInput)} className="btn-primary !py-2 !px-4 text-xs whitespace-nowrap">
            Search
          </button>
        </div>
      )}

      {/* ── results ── */}
      {payments.length === 0 ? (
        <EmptyState
          emoji="💸"
          title="No payments yet"
          hint="Payments are recorded automatically when you create a sale with payment, receive a customer payment, or pay a mill."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No payments match your filters"
          hint={period === "custom" && !customMonth ? "Pick a month to see its payments." : "Try a different period, type or search."}
          action={<button onClick={clearAll} className="btn-primary">Clear filters</button>}
        />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </Page>
  );
}
