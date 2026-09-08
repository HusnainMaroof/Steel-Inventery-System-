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

export default function PaymentsPage() {
  const { payments, customers, suppliers, sales } = useStore();

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "customer" | "supplier">("all");

  const rows: PaymentRow[] = useMemo(() => {
    const q = appliedSearch.toLowerCase().trim();
    return payments
      .filter((p) => {
        if (typeFilter !== "all" && p.type !== typeFilter) return false;
        if (q) {
          const name = p.type === "customer"
            ? customers.find((c) => c.id === p.partyId)?.name ?? ""
            : suppliers.find((s) => s.id === p.partyId)?.name ?? "";
          if (!name.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .map((p) => ({
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
      }));
  }, [payments, customers, suppliers, sales, appliedSearch, typeFilter]);

  const totalReceived = payments.filter((p) => p.type === "customer").reduce((a, p) => a + p.amount, 0);
  const totalPaid = payments.filter((p) => p.type === "supplier").reduce((a, p) => a + p.amount, 0);

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

      {/* ── summary bar ── */}
      {payments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="border border-neutral-200 bg-white p-4">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Received from customers</span>
            <span className="block text-xl font-semibold tabular-nums mt-1 text-[#2e6b2e]">{fmtMoney(totalReceived)}</span>
          </div>
          <div className="border border-neutral-200 bg-white p-4">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Paid to mills</span>
            <span className="block text-xl font-semibold tabular-nums mt-1 text-[#1f4e8c]">{fmtMoney(totalPaid)}</span>
          </div>
          <div className="border border-black bg-black text-white p-4">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-400">Net cash flow</span>
            <span className="block text-xl font-semibold tabular-nums mt-1">{fmtMoney(totalReceived - totalPaid)}</span>
          </div>
        </div>
      )}

      {/* ── filters ── */}
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
          {(appliedSearch.trim() !== "" || typeFilter !== "all") && (
            <button onClick={() => { setSearchInput(""); setAppliedSearch(""); setTypeFilter("all"); }} className="btn-ghost !py-2 !px-4 text-xs whitespace-nowrap">
              Clear
            </button>
          )}
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
          hint="Try adjusting the search or type filter."
          action={<button onClick={() => { setSearchInput(""); setAppliedSearch(""); setTypeFilter("all"); }} className="btn-primary">Clear filters</button>}
        />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </Page>
  );
}
