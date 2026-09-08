"use client";

import { useState, useMemo } from "react";
import { saleGrandTotal } from "@/lib/store";
import { EmptyState } from "@/components/ui";
import { fmtMoney, fmtDate, fmtTime, fmtQtyWithUnit } from "@/lib/format";

type SoldLine = {
  product: string; // highlighted product category (e.g. "Steel")
  item: string; // the item name (e.g. "3 Sutar")
  quality: string; // quality grade or ""
  qtyText: string; // e.g. "500 kg"
};

type SaleRow = {
  id: string;
  customerName: string;
  createdAt: string;
  time: string;
  soldLines: SoldLine[];
  total: number;
  paid: number;
  due: number;
};

export default function SalesTable({
  sales,
  customerName,
  customers,
  hasInventory,
  productOf,
  qualityOf,
  salePaid,
  onView,
  onReceive,
  onNewSale,
}: {
  sales: { id: string; invoiceNo: string; date: string; createdAt: string; customerId: string; lines: { item: string; qty: number; rate: number; unit: string; quality?: string; supplierId?: string }[]; discountPct?: number; taxPct?: number }[];
  customerName: (id: string) => string;
  customers: { id: string; name: string; phone: string }[];
  hasInventory: boolean;
  productOf: (item: string) => string;
  qualityOf: (item: string) => string;
  salePaid: (saleId: string) => number;
  onView: (id: string) => void;
  onReceive: (id: string) => void;
  onNewSale: () => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState<"name" | "phone">("name");
  const [dateInput, setDateInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedMode, setAppliedMode] = useState<"name" | "phone">("name");
  const [appliedDate, setAppliedDate] = useState("");

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 11);
    return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  };

  const onSearchChange = (v: string) => {
    setSearchInput(searchMode === "phone" ? formatPhone(v) : v);
  };

  const hasFilters = appliedSearch.trim() !== "" || appliedDate !== "";

  const groups = useMemo(() => {
    const q = appliedSearch.toLowerCase().trim();
    const filtered = [...sales].reverse().filter((s) => {
      if (q) {
        const cust = customers.find((c) => c.id === s.customerId);
        if (!cust) return false;
        if (appliedMode === "name") {
          if (!cust.name.toLowerCase().includes(q)) return false;
        } else {
          const phoneDigits = cust.phone.replace(/\D/g, "");
          const queryDigits = q.replace(/\D/g, "");
          if (!phoneDigits.includes(queryDigits)) return false;
        }
      }
      if (appliedDate && s.date !== appliedDate) return false;
      return true;
    });

    const map = new Map<string, SaleRow[]>();
    for (const s of filtered) {
      const total = saleGrandTotal(s);
      const paid = salePaid(s.id);
      const due = Math.max(0, total - paid);
      const row: SaleRow = {
        id: s.id,
        customerName: customerName(s.customerId),
        createdAt: s.createdAt,
        time: fmtTime(s.createdAt),
        soldLines: s.lines.map((l) => {
          const product = productOf(l.item);
          return {
            product: product || l.item,
            item: product ? l.item : "—",
            quality: l.quality || qualityOf(l.item) || "",
            qtyText: fmtQtyWithUnit(l.qty, l.unit),
          };
        }),
        total, paid, due,
      };
      const list = map.get(s.date) ?? [];
      list.push(row);
      map.set(s.date, list);
    }

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, sales]) => ({
        date,
        sales: sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }));
  }, [sales, customers, customerName, productOf, qualityOf, salePaid, appliedSearch, appliedMode, appliedDate]);

  const totalDue = groups.reduce((a, g) => a + g.sales.reduce((b, r) => b + r.due, 0), 0);
  const filteredCount = groups.reduce((a, g) => a + g.sales.length, 0);

  const handleSearch = () => {
    setAppliedSearch(searchInput);
    setAppliedMode(searchMode);
    setAppliedDate(dateInput);
  };

  const handleClear = () => {
    setSearchInput("");
    setSearchMode("name");
    setDateInput("");
    setAppliedSearch("");
    setAppliedMode("name");
    setAppliedDate("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

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
      {/* ── filters ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="flex flex-1 sm:max-w-96">
          <select
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value as "name" | "phone")}
            className="!w-auto !rounded-r-none !border-r-0"
          >
            <option value="name">Name</option>
            <option value="phone">Phone</option>
          </select>
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
              <input
                type="text"
                placeholder={searchMode === "name" ? "Search by customer name..." : "Search by phone number..."}
                value={searchInput}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="!w-full !rounded-l-none !pl-9"
              />
          </div>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="!w-full sm:!w-52 !pl-9"
          />
        </div>
        <button onClick={handleSearch} className="btn-primary !py-2 !px-4 text-xs whitespace-nowrap">
          Search
        </button>
        {hasFilters && (
          <button onClick={handleClear} className="btn-ghost !py-2 !px-4 text-xs whitespace-nowrap">
            Clear
          </button>
        )}
      </div>

      {/* ── stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="border border-neutral-200 bg-white p-4">
          <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Sales</span>
          <span className="block text-xl font-semibold tabular-nums mt-1">
            {filteredCount}
            {hasFilters && <span className="text-sm font-normal text-neutral-400"> / {sales.length}</span>}
          </span>
        </div>
        <div className="border border-black bg-black text-white p-4">
          <span className="block text-[11px] uppercase tracking-widest text-neutral-400">Total outstanding</span>
          <span className="block text-xl font-semibold tabular-nums mt-1">{fmtMoney(totalDue)}</span>
        </div>
      </div>

      {/* ── results ── */}
      {groups.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No sales match your filters"
          hint="Try adjusting the search or date to find what you're looking for."
          action={<button onClick={handleClear} className="btn-primary">Clear filters</button>}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.date}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium">{fmtDate(g.date)}</span>
                <span className="text-xs text-neutral-400">{g.sales.length} sale{g.sales.length > 1 ? "s" : ""}</span>
                <div className="flex-1 border-b border-neutral-200" />
              </div>

              {/* desktop */}
              <div className="hidden sm:block border border-neutral-200 bg-white overflow-x-auto">
                <div className="grid grid-cols-[minmax(0,1.5fr)_70px_110px_110px_110px_150px] gap-2 px-4 py-2 text-[11px] uppercase tracking-widest text-neutral-500 font-medium border-b border-neutral-200 min-w-[850px]">
                  <span>Items Sold</span>
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
                    className="grid grid-cols-[minmax(0,1.5fr)_70px_110px_110px_110px_150px] gap-2 px-4 py-3 border-b border-neutral-100 last:border-b-0 cursor-pointer hover:bg-neutral-50 transition-colors min-w-[850px]"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-xs text-neutral-900 truncate mb-0.5">{s.customerName}</span>
                      <span className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] gap-x-3 gap-y-0.5">
                        {s.soldLines.map((line, i) => (
                          <span key={i} className="contents">
                            <span className="text-[11px] font-semibold text-neutral-900 truncate">{line.product}</span>
                            <span className="text-[11px] font-medium text-neutral-700 truncate">{line.item}</span>
                            <span className="text-[11px] text-neutral-500 truncate">{line.quality || "—"}</span>
                            <span className="text-[11px] font-medium tabular-nums text-right whitespace-nowrap">{line.qtyText}</span>
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="self-center text-right text-xs text-neutral-500 tabular-nums whitespace-nowrap">{s.time}</span>
                    <span className="self-center text-right font-medium text-xs tabular-nums">{fmtMoney(s.total)}</span>
                    <span className="self-center text-right text-xs text-neutral-500 tabular-nums">{fmtMoney(s.paid)}</span>
                    <span className={`self-center text-right font-medium text-xs tabular-nums ${s.due > 0 ? "text-[#a12b1f]" : "text-neutral-400"}`}>
                      {s.due > 0 ? fmtMoney(s.due) : "—"}
                    </span>
                    <span className="self-center text-right whitespace-nowrap">
                      {s.due > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); onReceive(s.id); }} className="btn-primary !py-1 !px-2.5 text-xs">
                          Receive
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onView(s.id); }} className="underline underline-offset-2 hover:text-neutral-500 text-xs ml-2">
                        Open
                      </button>
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{s.customerName}</span>
                      <span className="shrink-0 text-[10px] text-neutral-400 tabular-nums">{s.time}</span>
                    </div>
                    <div className="mt-1.5 mb-2 space-y-1">
                      {s.soldLines.map((line, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate">
                            <span className="font-semibold text-neutral-900">{line.product}</span>
                            <span className="text-neutral-700"> · {line.item}</span>
                            {line.quality && <span className="text-neutral-500"> · {line.quality}</span>}
                          </span>
                          <span className="shrink-0 font-medium tabular-nums text-neutral-700">{line.qtyText}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium tabular-nums text-sm">{fmtMoney(s.total)}</span>
                      <span className={`tabular-nums text-xs ${s.due > 0 ? "text-[#a12b1f] font-medium" : "text-neutral-400"}`}>
                        {s.due > 0 ? `Due ${fmtMoney(s.due)}` : "Paid"}
                      </span>
                    </div>
                    {s.due > 0 && (
                      <div className="mt-2 flex justify-end">
                        <button onClick={(e) => { e.stopPropagation(); onReceive(s.id); }} className="btn-primary !py-1 !px-3 text-xs">
                          Receive Payment
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
