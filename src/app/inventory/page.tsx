"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Page, PageTitle, EmptyState } from "@/components/ui";
import { fmtQtyWithUnit, fmtRateWithUnit, fmtMoney } from "@/lib/format";

type InvRow = {
  item: string;
  product?: string;
  quality?: string;
  unit?: string;
  purchasedQty: number;
  soldQty: number;
  stockQty: number;
  totalCost: number;
  landedAvg: number;
  stockValue: number;
  avgSellRate: number;
  sellRate?: number;
};

type ProductGroup = {
  product: string;
  items: InvRow[];
  totalStockQty: number;
  totalStockValue: number;
};

export default function InventoryPage() {
  const { inventory, products } = useStore();
  const [productFilter, setProductFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const allRows: InvRow[] = useMemo(() => {
    if (productFilter === "all") return inventory;
    return inventory.filter((r) => r.product === productFilter);
  }, [inventory, productFilter]);

  const rows = useMemo(() => {
    const q = appliedSearch.toLowerCase().trim();
    if (!q) return allRows;
    return allRows.filter((r) => {
      const name = r.item.toLowerCase();
      const quality = (r.quality ?? "").toLowerCase();
      return name.includes(q) || quality.includes(q);
    });
  }, [allRows, appliedSearch]);

  // Group rows by product category
  const groups: ProductGroup[] = useMemo(() => {
    const map = new Map<string, InvRow[]>();
    for (const row of rows) {
      const product = row.product || "Other";
      const list = map.get(product) ?? [];
      list.push(row);
      map.set(product, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([product, items]) => ({
        product,
        items,
        totalStockQty: items.reduce((a, r) => a + r.stockQty, 0),
        totalStockValue: items.reduce((a, r) => a + r.stockValue, 0),
      }));
  }, [rows]);

  const totalStockQty = rows.reduce((a, r) => a + r.stockQty, 0);
  const totalStockValue = rows.reduce((a, r) => a + r.stockValue, 0);
  const totalItems = rows.length;

  const hasFilters = appliedSearch.trim() !== "" || productFilter !== "all";

  return (
    <Page>
      <PageTitle
        title="Inventory"
        sub="Stock per product item at weighted-average actual cost"
        action={
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="!w-auto !text-xs"
          >
            <option value="all">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        }
      />

      {/* ── filters ── */}
      {allRows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1 sm:max-w-80">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search items..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setAppliedSearch(searchInput); }}
              className="!w-full !pl-9 !text-xs !py-1.5"
            />
          </div>
          <button onClick={() => setAppliedSearch(searchInput)} className="btn-primary !py-1.5 !px-3 !text-xs whitespace-nowrap">
            Search
          </button>
          {hasFilters && (
            <button onClick={() => { setSearchInput(""); setAppliedSearch(""); setProductFilter("all"); }} className="btn-ghost !py-1.5 !px-3 !text-xs whitespace-nowrap">
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── stats ── */}
      {allRows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="border border-neutral-200 bg-white p-4">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Items</span>
            <span className="block text-xl font-semibold tabular-nums mt-1">
              {totalItems}
              {hasFilters && <span className="text-sm font-normal text-neutral-400"> / {allRows.length}</span>}
            </span>
          </div>
          <div className="border border-neutral-200 bg-white p-4">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Total stock</span>
            <span className="block text-xl font-semibold tabular-nums mt-1">{fmtQtyWithUnit(totalStockQty)}</span>
          </div>
          <div className="border border-black bg-black text-white p-4">
            <span className="block text-[11px] uppercase tracking-widest text-neutral-400">Stock value</span>
            <span className="block text-xl font-semibold tabular-nums mt-1">{fmtMoney(totalStockValue)}</span>
          </div>
        </div>
      )}

      {/* ── results ── */}
      {rows.length === 0 ? (
        <EmptyState
          emoji="🏷️"
          title={productFilter === "all" ? "No stock yet" : `No ${productFilter} in stock`}
          hint={productFilter === "all" ? "Inventory builds itself as you record purchases and sales." : "Try another product or add a purchase."}
          action={<Link href="/purchases" className="btn-primary">+ Add Purchase</Link>}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.product}>
              {/* Product group header */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium">{g.product}</span>
                <span className="text-xs text-neutral-400">{g.items.length} item{g.items.length > 1 ? "s" : ""}</span>
                <div className="flex-1 border-b border-neutral-200" />
                <span className="text-xs text-neutral-500 tabular-nums">{fmtQtyWithUnit(g.totalStockQty)}</span>
                <span className="text-xs font-medium tabular-nums">{fmtMoney(g.totalStockValue)}</span>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block border border-neutral-200 bg-white">
                <div className="grid grid-cols-[1fr_80px_100px_100px_100px_100px_100px] gap-2 px-4 py-2 text-[11px] uppercase tracking-widest text-neutral-500 font-medium border-b border-neutral-200">
                  <span>Item</span>
                  <span>Quality</span>
                  <span className="text-right">Purchased</span>
                  <span className="text-right">Sold</span>
                  <span className="text-right">In stock</span>
                  <span className="text-right">Cost</span>
                  <span className="text-right">Sell Price</span>
                </div>
                {g.items.map((r) => (
                  <div
                    key={r.item}
                    className="grid grid-cols-[1fr_80px_100px_100px_100px_100px_100px] gap-2 px-4 py-3 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors"
                  >
                    <span className="font-medium text-xs truncate">{r.item}</span>
                    <span className="text-neutral-500 text-xs">{r.quality || "—"}</span>
                    <span className="text-right text-xs tabular-nums">{fmtQtyWithUnit(r.purchasedQty, r.unit)}</span>
                    <span className="text-right text-xs tabular-nums">{fmtQtyWithUnit(r.soldQty, r.unit)}</span>
                    <span className={`text-right font-medium text-xs tabular-nums ${r.stockQty <= 0 ? "text-neutral-400" : r.stockQty <= 5 ? "text-[#a12b1f]" : ""}`}>
                      {fmtQtyWithUnit(r.stockQty, r.unit)}
                    </span>
                    <span className="text-right text-xs tabular-nums">{fmtRateWithUnit(r.landedAvg)}</span>
                    <span className="text-right text-xs tabular-nums">
                      {(r.sellRate ?? r.avgSellRate) > 0 ? fmtRateWithUnit(r.sellRate ?? r.avgSellRate) : <span className="text-neutral-400">—</span>}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden border border-neutral-200 bg-white divide-y divide-neutral-100">
                {g.items.map((r) => (
                  <div key={r.item} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm truncate">{r.item}</span>
                      <span className={`font-medium text-sm tabular-nums ${r.stockQty <= 0 ? "text-neutral-400" : r.stockQty <= 5 ? "text-[#a12b1f]" : ""}`}>
                        {fmtQtyWithUnit(r.stockQty, r.unit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{r.quality || "No quality"}</span>
                      <span className="tabular-nums">
                        {(r.sellRate ?? r.avgSellRate) > 0 ? fmtRateWithUnit(r.sellRate ?? r.avgSellRate) : "—"}
                      </span>
                    </div>
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
