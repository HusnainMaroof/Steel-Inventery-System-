"use client";

import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Page, PageTitle, EmptyState } from "@/components/ui";
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
  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get("type");
    if (type === "received" || type === "customer") setTypeFilter("customer");
    else if (type === "paid" || type === "supplier") setTypeFilter("supplier");
  }, []);
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
        invoiceNo: (() => {
          if (p.type !== "customer") return "—";
          if (p.saleId) {
            return sales.find((s) => s.id === p.saleId)?.invoiceNo ?? "—";
          }
          const labels = (p.allocations ?? [])
            .map((a) => sales.find((s) => s.id === a.saleId)?.invoiceNo)
            .filter(Boolean);
          return labels.length ? labels.join(", ") : "FIFO settlement";
        })(),
        method: p.method,
        note: p.note,
        amount: p.amount,
      })),
    [filtered, customers, suppliers, sales]
  );

  const totalReceived = filtered.filter((p) => p.type === "customer").reduce((a, p) => a + p.amount, 0);
  const totalPaid = filtered.filter((p) => p.type === "supplier").reduce((a, p) => a + p.amount, 0);

  const groups = useMemo(() => {
    const map = new Map<string, PaymentRow[]>();
    for (const r of [...rows].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    )) {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        items,
        received: items
          .filter((i) => i.type === "customer")
          .reduce((a, i) => a + i.amount, 0),
        paid: items
          .filter((i) => i.type === "supplier")
          .reduce((a, i) => a + i.amount, 0),
      }));
  }, [rows]);

  const clearAll = () => {
    setSearchInput("");
    setAppliedSearch("");
    setTypeFilter("all");
    setPeriod("all");
    setCustomMonth("");
  };
  const hasActiveFilters =
    appliedSearch.trim() !== "" || typeFilter !== "all" || period !== "all";

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
        <div className="space-y-6">
          {groups.map((g) => {
            const net = g.received - g.paid;
            return (
              <div key={g.date}>
                {/* date group header with count + day net */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-bold text-black">{fmtDate(g.date)}</span>
                  <span className="text-xs font-medium text-black">
                    {g.items.length} payment{g.items.length > 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 border-b border-neutral-200" />
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      net > 0 ? "text-[#2e6b2e]" : net < 0 ? "text-[#a12b1f]" : "text-black"
                    }`}
                  >
                    {net > 0 ? "+" : net < 0 ? "−" : ""}
                    {fmtMoney(Math.abs(net))}
                  </span>
                </div>

                {/* desktop */}
                <div className="hidden sm:block border border-neutral-200 bg-white">
                  <div className="grid grid-cols-[minmax(0,1.4fr)_90px_minmax(0,0.8fr)_90px_minmax(0,1fr)_120px] gap-3 px-4 py-2 text-[11px] uppercase tracking-widest text-black font-medium border-b border-neutral-200">
                    <span>Party</span>
                    <span>Type</span>
                    <span>Invoice</span>
                    <span>Method</span>
                    <span>Note</span>
                    <span className="text-right">Amount</span>
                  </div>
                  {g.items.map((p) => (
                    <div
                      key={p.id}
                      className="grid grid-cols-[minmax(0,1.4fr)_90px_minmax(0,0.8fr)_90px_minmax(0,1fr)_120px] gap-3 px-4 py-3 border-b border-neutral-100 last:border-b-0"
                    >
                      <span className="min-w-0 self-center font-semibold text-xs truncate">{p.partyName}</span>
                      <span className="self-center">
                        <span className={`text-xs border px-2 py-0.5 uppercase tracking-wider ${p.type === "customer" ? "border-[#cfe3cd] text-[#2e6b2e]" : "border-[#d2e0f2] text-[#1f4e8c]"}`}>
                          {p.type === "customer" ? "Received" : "Paid"}
                        </span>
                      </span>
                      <span className="min-w-0 self-center text-xs text-black/60 truncate">{p.invoiceNo}</span>
                      <span className="self-center text-xs truncate">{p.method}</span>
                      <span className="min-w-0 self-center text-xs text-black/60 truncate">{p.note || "—"}</span>
                      <span className="self-center text-right font-medium text-xs tabular-nums">
                        {p.type === "customer" ? "+" : "−"} {fmtMoney(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* mobile */}
                <div className="sm:hidden border border-neutral-200 bg-white divide-y divide-neutral-100">
                  {g.items.map((p) => (
                    <div key={p.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block font-semibold text-sm truncate">{p.partyName}</span>
                          <span className="block text-[11px] text-black/60">
                            {p.invoiceNo !== "—" ? `${p.invoiceNo} · ` : ""}
                            {p.method}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-xs border px-2 py-0.5 uppercase tracking-wider ${p.type === "customer" ? "border-[#cfe3cd] text-[#2e6b2e]" : "border-[#d2e0f2] text-[#1f4e8c]"}`}
                        >
                          {p.type === "customer" ? "Received" : "Paid"}
                        </span>
                      </div>
                      {p.note ? <p className="mt-1.5 text-xs text-black/60">{p.note}</p> : null}
                      <div className="mt-1.5 text-right font-medium text-sm tabular-nums">
                        {p.type === "customer" ? "+" : "−"} {fmtMoney(p.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
