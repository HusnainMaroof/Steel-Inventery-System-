"use client";

import { useState, useMemo } from "react";
import { saleGrandTotal } from "@/lib/store";
import { ConfirmModal, EmptyState } from "@/components/ui";
import { fmtMoney, fmtDate, fmtTime, fmtQtyWithUnit } from "@/lib/format";

type AttrRow = { label: string; value: string };

type SaleRow = {
  id: string;
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

/* three-dot invoice menu */
function InvoiceMenu({ items }: { items: { label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-block text-left shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Invoice actions"
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-transparent text-black hover:bg-neutral-100 hover:border-neutral-300 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-30 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
            {items.map((it, i) => (
              <button
                key={it.label}
                type="button"
                onClick={() => { setOpen(false); it.onClick(); }}
                className={`w-full text-left px-3.5 py-2 text-[13px] text-black hover:bg-neutral-100 transition-colors ${i > 0 ? "border-t border-neutral-100" : ""}`}
              >
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
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
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const hasFilters = search.trim() !== "" || statusFilter !== "all" || dateFilter !== "";

  const handleClear = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFilter("");
  };

  const rows: SaleRow[] = useMemo(
    () =>
      sales.map((s) => {
        const total = saleGrandTotal(s);
        const paid = salePaid(s.id);
        const due = Math.max(0, total - paid);
        const cust = customers.find((c) => c.id === s.customerId);
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
    [sales, customers, customerName, productOfLine, categoryNameOf, attrRowsOf, salePaid]
  );

  const groups = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = rows
      .filter((r) => {
        if (q && !r.searchHay.includes(q)) return false;
        if (dateFilter) {
          const s = sales.find((x) => x.id === r.id);
          if (!s || s.date !== dateFilter) return false;
        }
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
      const s = sales.find((x) => x.id === r.id)!;
      const list = map.get(s.date) ?? [];
      list.push(r);
      map.set(s.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => ({
        date,
        sales: list,
        dayTotal: list.reduce((a, r) => a + r.total, 0),
      }));
  }, [rows, sales, search, statusFilter, dateFilter]);

  const totalDue = groups.reduce((a, g) => a + g.sales.reduce((b, r) => b + r.due, 0), 0);
  const filteredCount = groups.reduce((a, g) => a + g.sales.length, 0);

  const menuItems = (s: SaleRow) => [
    { label: "Open Invoice", onClick: () => onView(s.id) },
    { label: "Receive Payment", onClick: () => onReceive(s.id) },
    { label: "Print", onClick: () => window.open(`/sales/${s.id}`, "_blank") },
    { label: "Delete", onClick: () => setDeleteId(s.id) },
  ];

  const itemsBlock = (s: SaleRow) => (
    <div className="space-y-2">
      {s.items.map((it, i) => (
        <div key={i}>
          <span className="block font-semibold text-[11px] text-black truncate">{it.product}</span>
          {it.category && <span className="block text-[11px] text-black/60 truncate">{it.category}</span>}
          {it.attrs.map((a, j) => (
            <span key={j} className="block text-[11px] text-black/60 truncate">
              {a.label}: {a.value}
            </span>
          ))}
          <span className="block text-[11px] font-medium text-black tabular-nums">{it.qtyText}</span>
        </div>
      ))}
    </div>
  );

  if (sales.length === 0) {
    return (
      <EmptyState
        emoji={hasInventory ? "🧾" : "🏗️"}
        title={hasInventory ? "No sales yet" : "Nothing to sell yet"}
        hint={hasInventory ? "Sell from your stock — the invoice is created automatically." : "Record a purchase first — once stock lands, sales take a minute."}
        action={<button className="btn-primary" onClick={onNewSale}>+ New Sale</button>}
      />
    );
  }

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
            placeholder="Search customer, invoice, product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!w-full !pl-9 !text-xs !py-2"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Status)}
          className="!w-auto !text-xs"
          aria-label="Filter by payment status"
        >
          <option value="all">All Invoices</option>
          <option value="paid">Paid</option>
          <option value="partial">Partially Paid</option>
          <option value="due">Due</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="!w-auto !text-xs"
          aria-label="Filter by date"
        />
        {hasFilters && (
          <button onClick={handleClear} className="btn-ghost !py-2 !px-3 !text-xs whitespace-nowrap">
            Clear
          </button>
        )}
      </div>

      {/* ── summary: invoice count + outstanding ── */}
      <div className="border border-neutral-200 bg-white p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="block text-[11px] uppercase tracking-widest text-black font-medium">Invoices</span>
          <span className="block text-2xl font-bold tabular-nums text-black mt-1">
            {filteredCount}
            {hasFilters && <span className="text-sm font-normal text-black/60"> / {sales.length}</span>}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[11px] uppercase tracking-widest text-black font-medium">Outstanding</span>
          <span className={`block text-2xl font-bold tabular-nums mt-1 ${totalDue > 0 ? "text-[#a12b1f]" : "text-black"}`}>
            {fmtMoney(totalDue)}
          </span>
        </div>
      </div>

      {/* ── results ── */}
      {groups.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No sales match your filters"
          hint="Try adjusting the search, status or date to find what you're looking for."
          action={<button onClick={handleClear} className="btn-primary">Clear filters</button>}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.date}>
              {/* date group header with count + day total */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-bold text-black">{fmtDate(g.date)}</span>
                <span className="text-xs font-medium text-black">{g.sales.length} sale{g.sales.length > 1 ? "s" : ""}</span>
                <div className="flex-1 border-b border-neutral-200" />
                <span className="text-sm font-bold text-black tabular-nums">{fmtMoney(g.dayTotal)}</span>
              </div>

              {/* desktop */}
              <div className="hidden sm:block border border-neutral-200 bg-white">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_80px_110px_110px_110px_44px] gap-3 px-4 py-2 text-[11px] uppercase tracking-widest text-black font-medium border-b border-neutral-200">
                  <span>Invoice / Customer</span>
                  <span>Items</span>
                  <span className="text-right">Time</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">Paid</span>
                  <span className="text-right">Due</span>
                  <span />
                </div>
                {g.sales.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => onView(s.id)}
                    className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_80px_110px_110px_110px_44px] gap-3 px-4 py-3 border-b border-neutral-100 last:border-b-0 cursor-pointer hover:bg-neutral-50 transition-colors"
                  >
                    {/* invoice number secondary, customer primary */}
                    <span className="min-w-0 self-center">
                      <span className="block text-[11px] text-black/60 truncate">{s.invoiceNo}</span>
                      <span className="block font-semibold text-xs text-black truncate">{s.customerName}</span>
                    </span>
                    {/* items — full variant hierarchy per line, one invoice row */}
                    <div className="min-w-0 self-center">{itemsBlock(s)}</div>
                    <span className="self-center text-right text-xs text-black tabular-nums whitespace-nowrap">{s.time}</span>
                    <span className="self-center text-right font-medium text-xs text-black tabular-nums">{fmtMoney(s.total)}</span>
                    <span className="self-center text-right text-xs text-black tabular-nums">{fmtMoney(s.paid)}</span>
                    <span className={`self-center text-right font-semibold text-xs tabular-nums ${s.due > 0 ? "text-[#a12b1f]" : "text-black"}`}>
                      {s.due > 0 ? fmtMoney(s.due) : "—"}
                    </span>
                    <span className="self-center flex justify-end">
                      <InvoiceMenu items={menuItems(s)} />
                    </span>
                  </div>
                ))}
              </div>

              {/* mobile */}
              <div className="sm:hidden border border-neutral-200 bg-white divide-y divide-neutral-100">
                {g.sales.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => onView(s.id)}
                    className="p-3 cursor-pointer active:bg-neutral-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-[11px] text-black/60">{s.invoiceNo}</span>
                        <span className="block font-semibold text-sm text-black truncate">{s.customerName}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-black tabular-nums">{s.time}</span>
                        <InvoiceMenu items={menuItems(s)} />
                      </span>
                    </div>
                    <div className="mt-2 mb-2">{itemsBlock(s)}</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium tabular-nums text-sm text-black">{fmtMoney(s.total)}</span>
                      <span className={`tabular-nums text-xs font-semibold ${s.due > 0 ? "text-[#a12b1f]" : "text-black"}`}>
                        {s.due > 0 ? `Due ${fmtMoney(s.due)}` : "Paid"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* delete confirm */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await onDelete(deleteId);
          setDeleteId(null);
        }}
        title="Delete this invoice?"
        confirmLabel="Delete Invoice"
      >
        {(() => {
          const s = sales.find((x) => x.id === deleteId);
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
