"use client";

import { useDeferredValue, useState, useMemo } from "react";
import { saleGrandTotal, useStore } from "@/lib/store";
import { useBusinessHref } from "@/components/BusinessLink";
import { Skeleton } from "@/components/skeletons";
import { ConfirmModal, EmptyState, ErrorState, PaginationBar, RowActionsMenu } from "@/components/ui";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { dateInIsoRange } from "@/lib/date-range-filter";
import { fmtMoney, fmtDate, fmtTime, fmtQtyWithUnit } from "@/lib/format";
import Decimal from "decimal.js";
import { toDecimal } from "../../lib/decimal";

type AttrRow = { label: string; value: string };

type SaleRow = {
  id: string;
  /** Sale date (ISO yyyy-mm-dd), used for grouping and the date filter. */
  date: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  time: string;
  items: {
    product: string;
    category: string;
    attrs: AttrRow[];
    qtyText: string;
  }[];
  searchHay: string;
  total: number;
  paid: number;
  due: number;
};

const SALE_GRID =
  "md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)_130px_130px_140px_40px] md:gap-4 md:px-4";

/** how many item lines a row shows before "+N more" */
const ITEMS_SHOWN = 2;

function StatusCell({ total, paid, due }: { total: number; paid: number; due: number }) {
  if (due <= 0.005 && total > 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        Paid
      </span>
    );
  }
  const partly = paid > 0.005;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
          partly ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
        }`}
      >
        {partly ? "Partly paid" : "Unpaid"}
      </span>
      <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-destructive">{fmtMoney(due)} due</span>
    </span>
  );
}

type Status = "all" | "paid" | "partial" | "due";

export default function SalesTable({
  sales,
  customerName,
  customers,
  hasInventory,
  productOfLine,
  categoryNameOf,
  attrRowsOf,
  salePaid,
  onView,
  onReceive,
  onDelete,
  onNewSale,
  loading = false,
  error = null,
  onRetry,
  listTotal,
  page,
  totalPages,
  onPageChange,
  allSales,
  transactionsReady,
}: {
  sales: {
    id: string;
    invoiceNo: string;
    date: string;
    createdAt: string;
    customerId: string;
    lines: {
      item: string;
      qty: number;
      rate: number;
      unit: string;
      quality?: string;
      categoryId?: string;
      variantId?: string;
      attributeSnapshot?: Record<string, string>;
      supplierId?: string;
    }[];
    discountPct?: number;
    taxPct?: number;
  }[];
  customerName: (id: string) => string;
  customers: { id: string; name: string; phone: string }[];
  hasInventory: boolean;
  productOfLine: (l: { categoryId?: string; item: string }) => string;
  categoryNameOf: (l: { categoryId?: string }) => string;
  attrRowsOf: (l: { categoryId?: string; attributeSnapshot?: Record<string, string>; quality?: string; item: string }) => AttrRow[];
  salePaid: (saleId: string) => number;
  onView: (id: string) => void;
  onReceive: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onNewSale: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  listTotal?: number;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  /** Full sales list from the store ledger, used when a filter is active so filters apply across every sale, not just the current server page. */
  allSales?: {
    id: string;
    invoiceNo: string;
    date: string;
    createdAt: string;
    customerId: string;
    lines: {
      item: string;
      qty: number;
      rate: number;
      unit: string;
      quality?: string;
      categoryId?: string;
      variantId?: string;
      attributeSnapshot?: Record<string, string>;
      supplierId?: string;
    }[];
    discountPct?: number;
    taxPct?: number;
  }[];
  /** Whether the store ledger (allSales) has finished loading. */
  transactionsReady?: boolean;
}) {
  const { isPending } = useStore();
  const businessHref = useBusinessHref();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Typing stays responsive: the list filters on a deferred copy of the search text.
  const deferredSearch = useDeferredValue(search);
  const hasFilters =
    deferredSearch.trim() !== "" || statusFilter !== "all" || !!(dateRange.from || dateRange.to);
  // When a filter is active, filter across the full ledger (allSales) instead of the current server page,
  // and hide server pagination. When no filter is active, keep the server page and its PaginationBar.
  const displaySales = (hasFilters ? allSales : sales) ?? sales;
  const listReady = !hasFilters || transactionsReady;
  const resetPage = () => {
    if (onPageChange && page !== 1) onPageChange(1);
  };
  const handleClear = () => {
    setSearch("");
    setStatusFilter("all");
    setDateRange({ from: null, to: null });
    resetPage();
  };

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const rows: SaleRow[] = useMemo(
    () =>
      displaySales.map((s) => {
        const total = saleGrandTotal(s);
        const paid = salePaid(s.id);
        const due = Math.max(0, total - paid);
        const cust = customerById.get(s.customerId);
        const items = s.lines.map((l) => ({
          product: productOfLine(l) || l.item,
          category: categoryNameOf(l),
          attrs: attrRowsOf(l),
          qtyText: fmtQtyWithUnit(l.qty, l.unit),
        }));
        const searchHay = [
          cust?.name ?? "",
          cust?.phone ?? "",
          s.invoiceNo,
          ...items.flatMap((it) => [it.product, it.category, ...it.attrs.map((a) => `${a.label} ${a.value}`)]),
        ]
          .join(" ")
          .toLowerCase();
        return {
          id: s.id,
          date: s.date,
          invoiceNo: s.invoiceNo,
          customerName: customerName(s.customerId),
          customerPhone: cust?.phone ?? "",
          createdAt: s.createdAt,
          time: fmtTime(s.createdAt),
          items,
          searchHay,
          total,
          paid,
          due,
        };
      }),
    [displaySales, customerById, customerName, productOfLine, categoryNameOf, attrRowsOf, salePaid]
  );

  const groups = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    const filtered = rows
      .filter((r) => {
        if (q && !r.searchHay.includes(q)) return false;
        if ((dateRange.from || dateRange.to) && !dateInIsoRange(r.date, dateRange)) return false;
        if (statusFilter !== "all") {
          if (statusFilter === "due" && r.due <= 0.001) return false;
          if (statusFilter === "paid" && (r.paid <= 0.001 || r.due > 0.001)) return false;
          if (statusFilter === "partial" && !(r.paid > 0.001 && r.due > 0.001)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const map = new Map<string, SaleRow[]>();
    for (const r of filtered) {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => ({
        date,
        sales: list,
        dayTotal: list.reduce((a, r) => a.plus(toDecimal(r.total)), new Decimal(0)).toNumber(),
      }));
  }, [rows, deferredSearch, statusFilter, dateRange]);

  const totalDue = groups.reduce((a, g) => a.plus(toDecimal(g.sales.reduce((b, r) => b.plus(toDecimal(r.due)), new Decimal(0)).toNumber())), new Decimal(0)).toNumber();
  const filteredCount = groups.reduce((a, g) => a + g.sales.length, 0);

  const menuItems = (s: SaleRow) => [
    { label: "View sale", onClick: () => onView(s.id) },
    { label: "Receive Payment", onClick: () => onReceive(s.id) },
    { label: "Print", onClick: () => window.open(businessHref(`/sales/${s.id}`), "_blank") },
    { label: "Delete", onClick: () => setDeleteId(s.id) },
  ];

  /* one compact line per item: "Cement · Grey Cement · 33 OPC · Lucky Cement   300 bags" */
  const itemsBlock = (s: SaleRow) => {
    const shown = s.items.slice(0, ITEMS_SHOWN);
    const more = s.items.length - shown.length;
    return (
      <div className="space-y-1">
        {shown.map((it, i) => {
          const detail = [it.category, ...it.attrs.map((a) => a.value)].filter(Boolean).join(" · ");
          return (
            <div key={i} className="flex items-baseline justify-between gap-3 min-w-0">
              <span className="min-w-0 truncate text-sm" title={detail ? `${it.product} · ${detail}` : it.product}>
                <span className="font-medium text-[#171717]">{it.product}</span>
                {detail && <span className="text-[13px] text-[#171717]/70"> · {detail}</span>}
              </span>
              <span className="shrink-0 text-[13px] font-medium text-[#171717] tabular-nums whitespace-nowrap">{it.qtyText}</span>
            </div>
          );
        })}
        {more > 0 && (
          <span className="block text-[13px] text-[#171717]/70">
            + {more} more item{more === 1 ? "" : "s"}
          </span>
        )}
      </div>
    );
  };

  // Same element while the list is unchanged, so keystrokes do not re-render every row.
  const resultsNode = useMemo(
    () => (
      <>
          {!listReady ? (
            <div className="panel bg-white overflow-hidden" role="status" aria-label="Loading all sales">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3.5 border-b border-[#E5E5E5] last:border-0"
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1 max-w-[180px]" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title="No sales match your filters"
              hint="Try adjusting the search, status or date to find what you're looking for."
              action={<button onClick={handleClear} className="btn-primary">Clear filters</button>}
            />
          ) : (
            <div className="space-y-8">
              {groups.map((g) => (
                <div key={g.date}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
                    <span className="text-sm font-bold text-black">{fmtDate(g.date)}</span>
                    <span className="text-[13px] text-[#171717]/70 tabular-nums">
                      {g.sales.length} sale{g.sales.length === 1 ? "" : "s"} · {fmtMoney(g.dayTotal)}
                    </span>
                    <div className="flex-1 min-w-[2rem] border-b border-[#E5E5E5]" />
                  </div>

                  <div className="md:overflow-hidden md:rounded-xl md:border md:border-[#E5E5E5] md:bg-white">
                    <div
                      className={`${SALE_GRID} hidden py-2.5 bg-[#FAFAF9] border-b border-[#E5E5E5] text-xs font-medium uppercase tracking-wide text-[#171717]/60 md:grid md:items-center`}
                    >
                      <span>Customer</span>
                      <span>Items</span>
                      <span className="text-right">Total</span>
                      <span className="text-right">Paid</span>
                      <span className="text-right">Status</span>
                      <span className="sr-only">Actions</span>
                    </div>

                    <div className="hidden flex-col divide-y divide-[#E5E5E5] md:flex">
                      {g.sales.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => onView(s.id)}
                          className="cursor-pointer transition-colors hover:bg-[#F8F8F7]"
                        >
                          <div className={`${SALE_GRID} items-start py-3.5`}>
                            <div className="min-w-0 self-start">
                              <span className="block text-sm font-medium text-[#171717] truncate">{s.customerName}</span>
                              <span className="block text-[13px] text-[#171717]/70 tabular-nums">
                                {s.invoiceNo} · {s.time}
                              </span>
                            </div>
                            <div className="min-w-0 self-start">{itemsBlock(s)}</div>
                            <span className="self-start text-right text-sm font-semibold text-[#171717] tabular-nums whitespace-nowrap">
                              {fmtMoney(s.total)}
                            </span>
                            <span className="self-start text-right text-sm text-[#171717]/70 tabular-nums whitespace-nowrap">
                              {s.paid > 0.005 ? fmtMoney(s.paid) : "-"}
                            </span>
                            <span className="self-start flex justify-end">
                              <StatusCell total={s.total} paid={s.paid} due={s.due} />
                            </span>
                            <span className="self-start flex justify-end" onClick={(e) => e.stopPropagation()}>
                              <RowActionsMenu items={menuItems(s)} />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 md:hidden">
                      {g.sales.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => onView(s.id)}
                          className="cursor-pointer rounded-xl border border-[#E5E5E5] bg-white p-4 active:bg-[#F8F8F7]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="block font-semibold text-sm text-[#171717] truncate">{s.customerName}</span>
                              <span className="block text-[13px] text-[#171717]/70 tabular-nums">
                                {s.invoiceNo} · {s.time}
                              </span>
                            </div>
                            <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                              <RowActionsMenu items={menuItems(s)} />
                            </span>
                          </div>
                          <div className="my-3">{itemsBlock(s)}</div>
                          <div className="flex items-end justify-between gap-3 border-t border-[#E5E5E5] pt-3">
                            <div>
                              <span className="block text-xs uppercase tracking-wide text-[#171717]/60">Total</span>
                              <span className="block font-semibold tabular-nums text-base text-[#171717] whitespace-nowrap">
                                {fmtMoney(s.total)}
                              </span>
                            </div>
                            <StatusCell total={s.total} paid={s.paid} due={s.due} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when the shown rows or handlers change
    [groups, listReady, onView, onReceive, onNewSale, businessHref],
  );

  if (error) {
    return (
      <ErrorState
        title="Could not load invoices"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (loading && sales.length === 0) {
    return (
      <div className="panel bg-white overflow-hidden" role="status" aria-label="Loading invoices">
        <div className="border-b border-neutral-200 px-4 py-3 flex gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3.5 border-b border-[#E5E5E5] last:border-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1 max-w-[180px]" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (!loading && sales.length === 0 && (listTotal ?? 0) === 0) {
    return (
      <EmptyState
        emoji={hasInventory ? "🧾" : "🏗️"}
        title={hasInventory ? "No sales yet" : "Nothing to sell yet"}
        hint={hasInventory ? "Sell from your stock. The bill is created when you save." : "Record a purchase first. Once stock lands, a sale takes a minute."}
        action={<button className="btn-primary" onClick={onNewSale}>+ New Sale</button>}
      />
    );
  }

  const catalogTotal = listTotal ?? sales.length;

  return (
    <>
      {/* ── one row: search + payment status + date + clear ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search customer or product"
            aria-label="Search customer or product"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="!w-full !pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as Status); resetPage(); }}
          className="!w-auto"
          aria-label="Filter by payment status"
        >
          <option value="all">All sales</option>
          <option value="paid">Paid</option>
          <option value="partial">Partially Paid</option>
          <option value="due">Due</option>
        </select>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={(r) => { setDateRange(r); resetPage(); }}
          placeholder="All dates"
          ariaLabel="Filter by date range"
        />
        {hasFilters && (
          <button onClick={handleClear} className="btn-ghost whitespace-nowrap">
            Clear
          </button>
        )}
      </div>

      {/* ── summary: invoice count + outstanding ── */}
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="block text-xs uppercase tracking-wide text-[#171717]/60 font-medium">Sales</span>
          <span className="block text-2xl font-bold tabular-nums text-black mt-1">
            {filteredCount}
            {hasFilters && <span className="text-sm font-normal text-black/60"> / {catalogTotal}</span>}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-xs uppercase tracking-wide text-[#171717]/60 font-medium">Outstanding</span>
          <span className={`block text-2xl font-bold tabular-nums mt-1 ${totalDue > 0 ? "text-destructive" : "text-[#171717]"}`}>
            {fmtMoney(totalDue)}
          </span>
        </div>
      </div>

      {/* ── results ── */}
      {resultsNode}

      {!hasFilters && onPageChange && page != null && totalPages != null && listTotal != null && (
        <PaginationBar
          page={page}
          pages={totalPages}
          total={listTotal}
          onPageChange={onPageChange}
        />
      )}

      {/* delete confirm */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await onDelete(deleteId);
          setDeleteId(null);
        }}
        title="Delete this sale?"
        confirmLabel="Delete sale"
        loading={deleteId ? isPending(`sale:delete:${deleteId}`) : false}
      >
        {(() => {
          const s = displaySales.find((x) => x.id === deleteId);
          if (!s) return null;
          const paid = salePaid(s.id);
          return (
            <div className="text-sm text-neutral-700 space-y-2">
              <p>
                <span className="font-semibold text-neutral-900">{s.invoiceNo}</span> — {customerName(s.customerId)} will be permanently removed.
              </p>
              <ul className="text-xs list-disc pl-4 space-y-1">
                <li>Its stock goes back to Inventory and profit figures recalculate.</li>
                {paid > 0 && <li>The {fmtMoney(paid)} received against it is removed from Payments.</li>}
                <li>This cannot be undone.</li>
              </ul>
            </div>
          );
        })()}
      </ConfirmModal>
    </>
  );
}
