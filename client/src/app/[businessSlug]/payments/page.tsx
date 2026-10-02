"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Page, PageTitle, EmptyState, Tabs, RowActionsMenu } from "@/components/ui";
import { DateRangePicker, formatRangeLabel } from "@/components/ui/date-range-picker";
import { dateInIsoRange, isoDay } from "@/lib/date-range-filter";
import { useBusinessHref } from "@/components/BusinessLink";
import { purchaseParentId } from "@/lib/purchase-utils";
import { fmtMoney, fmtDate, fmtDateTime } from "@/lib/format";
import type { Payment, Purchase } from "@/lib/types";

type PaymentRow = {
  id: string;
  date: string;
  day: string;
  type: "customer" | "supplier";
  partyId: string;
  partyName: string;
  reference: string;
  primarySaleId: string | null;
  primaryPurchaseId: string | null;
  method: string;
  note: string | undefined;
  amount: number;
  createdAt?: string;
};

const TYPE_TABS = [
  { key: "all", label: "All" },
  { key: "customer", label: "Received" },
  { key: "supplier", label: "Paid" },
] as const;

type TypeFilter = (typeof TYPE_TABS)[number]["key"];

function customerDisplayName(
  customerId: string,
  customers: { id: string; name: string }[],
  cached?: string,
): string {
  const fromList = customers.find((c) => c.id === customerId)?.name?.trim();
  if (fromList) return fromList;
  if (cached?.trim()) return cached.trim();
  return "-";
}

function supplierDisplayName(
  supplierId: string,
  suppliers: { id: string; name: string }[],
  cached?: string,
): string {
  const fromList = suppliers.find((s) => s.id === supplierId)?.name?.trim();
  if (fromList) return fromList;
  if (cached?.trim()) return cached.trim();
  return "-";
}

function resolveUserName(
  p: Payment,
  customers: { id: string; name: string }[],
  suppliers: { id: string; name: string }[],
): string {
  if (p.type === "customer") {
    return customerDisplayName(p.partyId, customers, p.partyName);
  }
  return supplierDisplayName(p.partyId, suppliers, p.partyName);
}

function purchaseReference(
  purchaseId: string | undefined,
  purchases: Purchase[],
): { label: string; parentId: string | null } {
  if (!purchaseId) return { label: "-", parentId: null };
  const line = purchases.find(
    (row) => purchaseParentId(row) === purchaseId || row.id === purchaseId,
  );
  if (!line) return { label: "-", parentId: purchaseId };
  const name = line.product || line.item;
  return {
    label: name ? `${name} · ${fmtDate(line.date)}` : fmtDate(line.date),
    parentId: purchaseParentId(line),
  };
}

function TypeBadge({ type }: { type: "customer" | "supplier" }) {
  const incoming = type === "customer";
  return (
    <span className={`text-[13px] font-medium ${incoming ? "text-[#2e6b2e]" : "text-[#1f4e8c]"}`}>
      {incoming ? "Received" : "Paid"}
    </span>
  );
}

const PAYMENT_GRID =
  "md:grid md:grid-cols-[minmax(0,1.2fr)_100px_minmax(0,1fr)_88px_100px_minmax(88px,1fr)_40px] md:gap-3 md:px-4";

function PaymentDateColumnsHeader() {
  return (
    <div
      className={`${PAYMENT_GRID} hidden md:grid py-2.5 text-[10px] font-medium uppercase tracking-widest text-neutral-500 bg-neutral-50/90 border border-neutral-200 rounded-lg mb-2 items-center`}
    >
      <span>Name</span>
      <span>Type</span>
      <span>Reference</span>
      <span>Method</span>
      <span>Time</span>
      <span className="text-right">Amount</span>
      <span className="sr-only">Actions</span>
    </div>
  );
}

export default function PaymentsPage() {
  const router = useRouter();
  const businessHref = useBusinessHref();
  const { payments, customers, suppliers, sales, purchases } = useStore();

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get("type");
    if (type === "received" || type === "customer") setTypeFilter("customer");
    else if (type === "paid" || type === "supplier") setTypeFilter("supplier");
    else setTypeFilter("all");
  }, []);
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });

  const periodLabel = formatRangeLabel(dateRange.from, dateRange.to, "All time");
  const inRange = (date: string) => dateInIsoRange(date, dateRange);

  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        if (typeFilter !== "all" && p.type !== typeFilter) return false;
        if (!inRange(p.date)) return false;
        const q = appliedSearch.toLowerCase().trim();
        if (q) {
          const name = resolveUserName(p, customers, suppliers);
          const hay = [name, p.note, p.method].filter(Boolean).join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, customers, suppliers, appliedSearch, typeFilter, dateRange],
  );

  const rows: PaymentRow[] = useMemo(
    () =>
      filtered.map((p) => {
        const primarySaleId =
          p.type === "customer"
            ? p.saleId ?? p.allocations?.find((a) => a.saleId)?.saleId ?? null
            : null;
        const primaryPurchaseId =
          p.type === "supplier"
            ? p.purchaseId ?? p.allocations?.find((a) => a.purchaseId)?.purchaseId ?? null
            : null;
        const invoiceNo = (() => {
          if (p.type !== "customer") return "-";
          if (p.saleId) return sales.find((s) => s.id === p.saleId)?.invoiceNo ?? "-";
          const labels = (p.allocations ?? [])
            .map((a) => (a.saleId ? sales.find((s) => s.id === a.saleId)?.invoiceNo : undefined))
            .filter(Boolean);
          return labels.length ? labels.join(", ") : "-";
        })();
        const purchaseRef = purchaseReference(primaryPurchaseId ?? undefined, purchases);
        const reference = p.type === "customer" ? invoiceNo : purchaseRef.label;

        return {
          id: p.id,
          date: p.date,
          day: isoDay(p.date),
          type: p.type,
          partyId: p.partyId,
          partyName: resolveUserName(p, customers, suppliers),
          reference,
          primarySaleId,
          primaryPurchaseId: purchaseRef.parentId ?? primaryPurchaseId,
          method: p.method,
          note: p.note,
          amount: p.amount,
          createdAt: p.createdAt,
        };
      }),
    [filtered, customers, suppliers, sales, purchases],
  );

  const totalReceived = filtered.filter((p) => p.type === "customer").reduce((a, p) => a + p.amount, 0);
  const totalPaid = filtered.filter((p) => p.type === "supplier").reduce((a, p) => a + p.amount, 0);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const dayCmp = b.day.localeCompare(a.day);
        if (dayCmp !== 0) return dayCmp;
        const ta = a.createdAt ?? a.date;
        const tb = b.createdAt ?? b.date;
        return tb.localeCompare(ta) || b.id.localeCompare(a.id);
      }),
    [rows],
  );

  const groups = useMemo(() => {
    const map = new Map<string, PaymentRow[]>();
    for (const r of sortedRows) {
      const list = map.get(r.day) ?? [];
      list.push(r);
      map.set(r.day, list);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => {
        const dayIn = items.filter((i) => i.type === "customer").reduce((a, i) => a + i.amount, 0);
        const dayOut = items.filter((i) => i.type === "supplier").reduce((a, i) => a + i.amount, 0);
        return { date, items, dayIn, dayOut };
      });
  }, [sortedRows]);

  const navigatePaymentView = (p: PaymentRow) => {
    if (p.type === "customer" && p.primarySaleId) {
      router.push(businessHref(`sales/${p.primarySaleId}`));
      return;
    }
    if (p.type === "supplier" && p.primaryPurchaseId) {
      router.push(businessHref(`purchases/${p.primaryPurchaseId}`));
      return;
    }
    if (p.type === "customer") {
      router.push(businessHref(`customers?view=${encodeURIComponent(p.partyId)}`));
      return;
    }
    router.push(businessHref(`suppliers?view=${encodeURIComponent(p.partyId)}`));
  };

  const clearAll = () => {
    setSearchInput("");
    setAppliedSearch("");
    setTypeFilter("all");
    setDateRange({ from: null, to: null });
  };
  const hasActiveFilters =
    appliedSearch.trim() !== "" || typeFilter !== "all" || !!(dateRange.from || dateRange.to);

  return (
    <Page>
      <PageTitle
        title="Payments"
        sub="Money received and money paid. Take customer dues on Sales. Pay mill dues on Purchases."
      />

      {payments.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2.5">
            <p className="text-[12px] text-neutral-500">
              {filtered.length} payment{filtered.length === 1 ? "" : "s"} ·{" "}
              <span className="font-medium text-neutral-700">{periodLabel}</span>
            </p>
            {hasActiveFilters && (
              <button onClick={clearAll} className="text-[12px] text-neutral-400 hover:text-black underline underline-offset-2">
                Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="border border-neutral-200 bg-white p-4">
              <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Received</span>
              <span className="block text-xl font-semibold tabular-nums mt-1 text-[#2e6b2e]">{fmtMoney(totalReceived)}</span>
            </div>
            <div className="border border-neutral-200 bg-white p-4">
              <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Paid</span>
              <span className="block text-xl font-semibold tabular-nums mt-1 text-[#1f4e8c]">{fmtMoney(totalPaid)}</span>
            </div>
            <div className={`p-4 ${totalReceived - totalPaid >= 0 ? "border border-black bg-black text-white" : "border border-[#f0d2cc] bg-[#fdf1ef]"}`}>
              <span className={`block text-[11px] uppercase tracking-widest ${totalReceived - totalPaid >= 0 ? "text-neutral-400" : "text-[#a12b1f]/70"}`}>Net</span>
              <span className={`block text-xl font-semibold tabular-nums mt-1 ${totalReceived - totalPaid >= 0 ? "" : "text-[#a12b1f]"}`}>
                {fmtMoney(totalReceived - totalPaid)}
              </span>
            </div>
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
            placeholder="All dates"
            ariaLabel="Filter payments by date range"
          />
        </div>
      )}

      {payments.length > 0 && (
        <div className="flex flex-col gap-4 mb-6">
          <Tabs
            tabs={[...TYPE_TABS]}
            value={typeFilter}
            onChange={(key) => {
              setTypeFilter(key as TypeFilter);
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                if (key === "all") url.searchParams.delete("type");
                else url.searchParams.set("type", key);
                window.history.replaceState({}, "", url.pathname + url.search);
              }
            }}
          />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setAppliedSearch(searchInput); }}
                className="!w-full !pl-9"
              />
            </div>
            <button onClick={() => setAppliedSearch(searchInput)} className="btn-primary !py-2 !px-4 text-xs whitespace-nowrap">
              Search
            </button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          hint="Received and paid amounts show here after you take a customer payment on Sales, or pay a mill on Purchases."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No payments match your filters"
          hint="Try a different date, type, or search."
          action={<button onClick={clearAll} className="btn-primary">Clear filters</button>}
        />
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <div key={g.date}>
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold tracking-tight text-neutral-900">{fmtDate(g.date)}</span>
                <span className="text-[11px] text-neutral-600 tabular-nums">
                  {g.items.length} payment{g.items.length === 1 ? "" : "s"}
                  {g.dayIn > 0 ? ` · In ${fmtMoney(g.dayIn)}` : ""}
                  {g.dayOut > 0 ? ` · Out ${fmtMoney(g.dayOut)}` : ""}
                </span>
                <div className="flex-1 min-w-[2rem] border-b border-neutral-200" />
              </div>

              <PaymentDateColumnsHeader />

              <div className="flex flex-col gap-3">
                {g.items.map((p) => (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigatePaymentView(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") navigatePaymentView(p);
                    }}
                    className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
                  >
                    <div className={`${PAYMENT_GRID} hidden md:py-3.5 md:items-center`}>
                      <span className="min-w-0 truncate text-[13px] font-medium text-neutral-900">{p.partyName}</span>
                      <TypeBadge type={p.type} />
                      <span className="min-w-0 truncate text-[13px] text-neutral-800">{p.reference}</span>
                      <span className="text-[13px] text-neutral-700">{p.method}</span>
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {p.createdAt ? fmtDateTime(p.createdAt) : "-"}
                      </span>
                      <span
                        className={`text-right text-[15px] font-semibold tabular-nums ${
                          p.type === "customer" ? "text-[#2e6b2e]" : "text-[#1f4e8c]"
                        }`}
                      >
                        {p.type === "customer" ? "+" : "-"}
                        {fmtMoney(p.amount)}
                      </span>
                      <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu items={[{ label: "View", onClick: () => navigatePaymentView(p) }]} />
                      </span>
                    </div>

                    <div className="md:hidden p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-neutral-900">{p.partyName}</p>
                          <p className="mt-1 text-[12px] text-neutral-700">
                            <TypeBadge type={p.type} />
                            <span className="text-neutral-400 mx-1">·</span>
                            {p.reference}
                          </p>
                          <p className="mt-1 text-[11px] text-neutral-500">
                            {p.method}
                            {p.createdAt ? ` · ${fmtDateTime(p.createdAt)}` : ""}
                          </p>
                          {p.note ? <p className="mt-1 text-xs text-neutral-500">{p.note}</p> : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <RowActionsMenu items={[{ label: "View", onClick: () => navigatePaymentView(p) }]} />
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              p.type === "customer" ? "text-[#2e6b2e]" : "text-[#1f4e8c]"
                            }`}
                          >
                            {p.type === "customer" ? "+" : "-"}
                            {fmtMoney(p.amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {p.note ? (
                      <p className="hidden md:block px-4 pb-3 -mt-1 text-[11px] text-neutral-500 truncate">{p.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
