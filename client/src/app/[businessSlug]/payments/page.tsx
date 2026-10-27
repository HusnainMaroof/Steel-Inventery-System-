"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { EmptyState, Page, PageTitle, RowActionsMenu, SearchBar } from "@/components/ui";
import { DateRangePicker, formatRangeLabel } from "@/components/ui/date-range-picker";
import { dateInIsoRange, isoDay } from "@/lib/date-range-filter";
import { useBusinessHref } from "@/components/BusinessLink";
import { purchaseParentId } from "@/lib/purchase-utils";
import { fmtMoney, fmtDate, fmtDateTime } from "@/lib/format";
import type { Payment, Purchase } from "@/lib/types";
import Decimal from "decimal.js";
import { toDecimal } from "../../../lib/decimal";

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
    <span
      className={`inline-flex w-fit items-center self-start rounded-full px-2 py-0.5 text-xs font-medium ${
        incoming ? "bg-success/10 text-success" : "bg-[#F1F1EF] text-[#171717]"
      }`}
    >
      {incoming ? "Received" : "Paid"}
    </span>
  );
}

function displayNote(note: string | undefined): string | null {
  if (!note?.trim()) return null;
  if (/^payment recorded with purchase/i.test(note.trim())) return "Recorded with purchase";
  return note.trim();
}

const PAYMENT_GRID =
  "md:grid md:grid-cols-[minmax(0,1.2fr)_96px_minmax(0,1fr)_88px_100px_minmax(88px,1fr)_40px] md:gap-3 md:px-4";

function PaymentDateColumnsHeader() {
  return (
    <div
      className={`${PAYMENT_GRID} hidden md:grid py-2.5 text-[13px] font-semibold normal-case tracking-normal text-[#171717] bg-white border-b border-[#E5E5E5] items-center`}
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

  const totalReceived = filtered.filter((p) => p.type === "customer").reduce((a, p) => a.plus(toDecimal(p.amount)), new Decimal(0)).toNumber();
  const totalPaid = filtered.filter((p) => p.type === "supplier").reduce((a, p) => a.plus(toDecimal(p.amount)), new Decimal(0)).toNumber();

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
        const dayIn = items.filter((i) => i.type === "customer").reduce((a, i) => a.plus(toDecimal(i.amount)), new Decimal(0)).toNumber();
        const dayOut = items.filter((i) => i.type === "supplier").reduce((a, i) => a.plus(toDecimal(i.amount)), new Decimal(0)).toNumber();
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
    setAppliedSearch("");
    setTypeFilter("all");
    setDateRange({ from: null, to: null });
  };
  const hasActiveFilters =
    appliedSearch.trim() !== "" || typeFilter !== "all" || !!(dateRange.from || dateRange.to);

  return (
    <Page>
      <PageTitle title="Payments" />

      {payments.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2.5">
            <p className="text-[13px] text-[#171717]/70">
              {filtered.length} payment{filtered.length === 1 ? "" : "s"} ·{" "}
              <span className="font-medium text-[#171717]">{periodLabel}</span>
            </p>
            {hasActiveFilters && (
              <button onClick={clearAll} className="text-[13px] text-[#171717]/70 hover:text-[#171717] underline underline-offset-2">
                Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-5">
              <span className="block text-[14px] font-semibold text-[#171717]">Received</span>
              <span className="block text-2xl font-bold tabular-nums mt-1 text-success">{fmtMoney(totalReceived)}</span>
            </div>
            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-5">
              <span className="block text-[14px] font-semibold text-[#171717]">Paid</span>
              <span className="block text-2xl font-bold tabular-nums mt-1 text-[#171717]">{fmtMoney(totalPaid)}</span>
            </div>
            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-5">
              <span className="block text-[14px] font-semibold text-[#171717]">Net</span>
              <span className={`block text-2xl font-bold tabular-nums mt-1 ${totalReceived - totalPaid >= 0 ? "text-success" : "text-destructive"}`}>
                {fmtMoney(totalReceived - totalPaid)}
              </span>
            </div>
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <div className="mb-6 flex flex-col gap-2.5 rounded-2xl border border-[#E5E5E5] bg-white p-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="inline-flex items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1 w-full sm:w-auto">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={typeFilter === tab.key}
                onClick={() => {
                  setTypeFilter(tab.key);
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    if (tab.key === "all") url.searchParams.delete("type");
                    else url.searchParams.set("type", tab.key);
                    window.history.replaceState({}, "", url.pathname + url.search);
                  }
                }}
                className={`min-h-9 px-3 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                  typeFilter === tab.key
                    ? "bg-ink text-white"
                    : "text-[#171717]/70 hover:text-[#171717]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
            placeholder="All dates"
            ariaLabel="Filter payments by date range"
            className="w-full sm:w-auto"
            disableFuture
          />
          <SearchBar
            value={appliedSearch}
            onSearch={setAppliedSearch}
            placeholder="Search by name"
            className="min-w-[240px] flex-1"
          />
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
                <span className="text-[15px] font-bold text-[#171717]">{fmtDate(g.date)}</span>
                <span className="text-[13px] text-[#171717]/70 tabular-nums">
                  {g.items.length} payment{g.items.length === 1 ? "" : "s"}
                  {g.dayIn > 0 ? ` · In ${fmtMoney(g.dayIn)}` : ""}
                  {g.dayOut > 0 ? ` · Out ${fmtMoney(g.dayOut)}` : ""}
                </span>
                <div className="flex-1 min-w-[2rem] border-b border-[#E5E5E5]" />
              </div>

              <div className="md:overflow-hidden md:rounded-2xl md:border md:border-[#E5E5E5] md:bg-white">
                <PaymentDateColumnsHeader />

                <div className="flex flex-col gap-3 md:block md:divide-y md:divide-[#E5E5E5]">
                  {g.items.map((p) => (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigatePaymentView(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") navigatePaymentView(p);
                      }}
                      className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white cursor-pointer transition-colors hover:bg-[#FBFBFA] md:rounded-none md:border-0"
                    >
                      <div className={`${PAYMENT_GRID} hidden md:py-3.5 md:items-center`}>
                        <span className="min-w-0 truncate text-sm font-medium text-[#171717]">{p.partyName}</span>
                        <TypeBadge type={p.type} />
                        <span className="min-w-0 truncate text-sm text-[#171717]" title={p.reference}>{p.reference}</span>
                        <span className="text-sm text-[#171717]/70">{p.method}</span>
                        <span className="text-[13px] text-[#171717]/70 tabular-nums">
                          {p.createdAt ? fmtDateTime(p.createdAt) : "-"}
                        </span>
                        <span
                          className={`text-right text-sm font-semibold tabular-nums ${
                            p.type === "customer" ? "text-success" : "text-[#171717]"
                          }`}
                        >
                          {p.type === "customer" ? "+" : "-"}
                          {fmtMoney(p.amount)}
                        </span>
                        <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <RowActionsMenu items={[{ label: "View", onClick: () => navigatePaymentView(p) }]} />
                        </span>
                      </div>

                      <div className="md:hidden p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#171717]">{p.partyName}</p>
                          <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <RowActionsMenu items={[{ label: "View", onClick: () => navigatePaymentView(p) }]} />
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <TypeBadge type={p.type} />
                          <span className="min-w-0 max-w-full truncate text-[13px] text-[#171717]/70" title={p.reference}>
                            {p.reference}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-[#171717]/70">
                          {p.method}
                          {p.createdAt ? ` · ${fmtDateTime(p.createdAt)}` : ""}
                        </p>
                        {p.note ? (
                          <p className="mt-1 text-[13px] text-[#171717]/70">{displayNote(p.note)}</p>
                        ) : null}
                        <p
                          className={`mt-2 text-right text-sm font-semibold tabular-nums ${
                            p.type === "customer" ? "text-success" : "text-[#171717]"
                          }`}
                        >
                          {p.type === "customer" ? "+" : "-"}
                          {fmtMoney(p.amount)}
                        </p>
                      </div>
                      {p.note ? (
                        <p className="hidden md:block px-4 pb-3 -mt-1 text-[13px] text-[#171717]/70 truncate" title={displayNote(p.note) ?? undefined}>
                          {displayNote(p.note)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}