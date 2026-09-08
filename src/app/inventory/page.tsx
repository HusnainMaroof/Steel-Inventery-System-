"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Page, PageTitle, EmptyState, ConfirmModal } from "@/components/ui";
import { fmtQtyWithUnit, fmtRateWithUnit, fmtMoney } from "@/lib/format";

type InvRow = {
  item: string;
  product?: string;
  spec?: string;
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
  const { inventory, products, purchases, sales, deleteInventoryItem, hideInventoryItem } = useStore();
  const [productFilter, setProductFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<InvRow | null>(null);

  const confirmDeleteItem = () => {
    if (!deleteTarget) return;
    if (deleteTarget.stockQty <= 0.000001) {
      // fully sold — just clean it off the list, leave every record intact
      hideInventoryItem(deleteTarget.item);
    } else {
      deleteInventoryItem(deleteTarget.item);
    }
    setDeleteTarget(null);
  };

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

  // what's still in stock vs what's fully sold
  const activeRows = useMemo(
    () => rows.filter((r) => r.stockQty > 0.000001),
    [rows]
  );
  const soldOutRows = useMemo(
    () => rows.filter((r) => r.stockQty <= 0.000001),
    [rows]
  );

  // Group rows by product category
  const groups: ProductGroup[] = useMemo(() => {
    const map = new Map<string, InvRow[]>();
    for (const row of activeRows) {
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
  }, [activeRows]);

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
                <div className="grid grid-cols-[1fr_80px_100px_100px_100px_100px_100px_80px] gap-2 px-4 py-2 text-[11px] uppercase tracking-widest text-neutral-500 font-medium border-b border-neutral-200">
                  <span>Item</span>
                  <span>Grade / Factory</span>
                  <span className="text-right">Purchased</span>
                  <span className="text-right">Sold</span>
                  <span className="text-right">In stock</span>
                  <span className="text-right">Cost</span>
                  <span className="text-right">Sell Price</span>
                  <span />
                </div>
                {g.items.map((r) => (
                  <div
                    key={r.item}
                    className="grid grid-cols-[1fr_80px_100px_100px_100px_100px_100px_80px] gap-2 px-4 py-3 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors"
                  >
                    <span className="font-medium text-xs truncate">{r.item}</span>
                    <span className="text-neutral-500 text-xs">
                      {[r.quality, r.spec].filter(Boolean).join(" · ") || "—"}
                    </span>
                    <span className="text-right text-xs tabular-nums">{fmtQtyWithUnit(r.purchasedQty, r.unit)}</span>
                    <span className="text-right text-xs tabular-nums">{fmtQtyWithUnit(r.soldQty, r.unit)}</span>
                    <span className={`text-right font-medium text-xs tabular-nums ${r.stockQty <= 0 ? "text-neutral-400" : r.stockQty <= 5 ? "text-[#a12b1f]" : ""}`}>
                      {fmtQtyWithUnit(r.stockQty, r.unit)}
                    </span>
                    <span className="text-right text-xs tabular-nums">{fmtRateWithUnit(r.landedAvg)}</span>
                    <span className="text-right text-xs tabular-nums">
                      {(r.sellRate ?? r.avgSellRate) > 0 ? fmtRateWithUnit(r.sellRate ?? r.avgSellRate) : <span className="text-neutral-400">—</span>}
                    </span>
                    <span className="text-right">
                      <button onClick={() => setDeleteTarget(r)} className="btn-ghost !py-1 !px-2 text-xs text-red-600 hover:!bg-red-50">Delete</button>
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
                      <span>{[r.quality, r.spec].filter(Boolean).join(" · ") || "No grade / factory"}</span>
                      <span className="tabular-nums">
                        {(r.sellRate ?? r.avgSellRate) > 0 ? fmtRateWithUnit(r.sellRate ?? r.avgSellRate) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button onClick={() => setDeleteTarget(r)} className="btn-ghost !py-1 !px-2 text-xs text-red-600 hover:!bg-red-50">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* ---- Fully sold items, shown apart ---- */}
          {soldOutRows.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-bold text-neutral-800">Sold Out</span>
                <span className="text-xs text-neutral-400">{soldOutRows.length} item{soldOutRows.length === 1 ? "" : "s"} — everything sold, nothing left in stock</span>
                <div className="flex-1 border-b border-neutral-200" />
              </div>

              {/* Desktop */}
              <div className="hidden sm:block border border-neutral-200 bg-white">
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_90px_90px_100px_90px] gap-3 px-4 py-2 text-[11px] uppercase tracking-widest text-neutral-500 font-medium border-b border-neutral-200">
                  <span>Item</span>
                  <span>Product</span>
                  <span className="text-right">Purchased</span>
                  <span className="text-right">Sold</span>
                  <span>Status</span>
                  <span />
                </div>
                {soldOutRows.map((r) => (
                  <div key={r.item} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_90px_90px_100px_90px] gap-3 px-4 py-3 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors">
                    <span className="min-w-0">
                      <span className="block font-medium text-xs truncate">{r.item}</span>
                      {r.quality && <span className="block text-[11px] text-neutral-400 truncate">{r.quality}</span>}
                    </span>
                    <span className="self-center text-neutral-500 text-xs truncate">{r.product || "—"}</span>
                    <span className="self-center text-right text-xs tabular-nums">{fmtQtyWithUnit(r.purchasedQty, r.unit)}</span>
                    <span className="self-center text-right text-xs tabular-nums">{fmtQtyWithUnit(r.soldQty, r.unit)}</span>
                    <span className="self-center">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5">Sold Out</span>
                    </span>
                    <span className="self-center text-right">
                      <button onClick={() => setDeleteTarget(r)} className="btn-ghost !py-1 !px-2 text-xs text-red-600 hover:!bg-red-50">Delete</button>
                    </span>
                  </div>
                ))}
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden border border-neutral-200 bg-white divide-y divide-neutral-100">
                {soldOutRows.map((r) => (
                  <div key={r.item} className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{r.item}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5">Sold Out</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span className="truncate">{[r.product, r.quality].filter(Boolean).join(" · ") || "—"}</span>
                      <span className="tabular-nums shrink-0">Sold {fmtQtyWithUnit(r.soldQty, r.unit)}</span>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button onClick={() => setDeleteTarget(r)} className="btn-ghost !py-1 !px-2 text-xs text-red-600 hover:!bg-red-50">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Item Confirm Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteItem}
        title={deleteTarget && deleteTarget.stockQty <= 0.000001 ? "Remove sold-out item?" : "Delete from inventory?"}
        confirmLabel={deleteTarget && deleteTarget.stockQty <= 0.000001 ? "Remove from List" : "Delete Item"}
      >
        {deleteTarget && (() => {
          const t = deleteTarget;
          const soldOut = t.stockQty <= 0.000001;
          const pur = purchases.filter((x) => x.item === t.item).length;
          const sel = sales.filter((s) => s.lines.some((l) => l.item === t.item)).length;
          return (
            <>
              <div className="border border-neutral-200 mb-5">
                <div className="flex justify-between items-center gap-3 py-2.5 px-4 border-b border-neutral-200">
                  <span className="text-sm text-neutral-500 truncate">{t.item}</span>
                  <span className="font-medium text-sm tabular-nums shrink-0">{fmtQtyWithUnit(t.stockQty, t.unit)}</span>
                </div>
                {t.quality && (
                  <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                    <span className="text-neutral-500">Quality</span>
                    <span className="tabular-nums">{t.quality}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Purchased / sold</span>
                  <span className="tabular-nums">{fmtQtyWithUnit(t.purchasedQty, t.unit)} / {fmtQtyWithUnit(t.soldQty, t.unit)}</span>
                </div>
                {!soldOut && (
                  <div className="flex justify-between py-2 px-4 text-xs">
                    <span className="text-neutral-500">Stock worth</span>
                    <span className="tabular-nums">{fmtMoney(t.stockValue)}</span>
                  </div>
                )}
              </div>
              {soldOut ? (
                <div className="border border-red-200 bg-red-50 p-4">
                  <p className="text-[11px] uppercase tracking-widest text-red-700 font-medium mb-2">Removing it</p>
                  <ul className="text-xs text-neutral-700 space-y-1.5 list-disc pl-4">
                    <li>Nothing is left in stock — it only leaves the Inventory list.</li>
                    <li>Its purchases and sales stay on record.</li>
                    <li>Dues, profit and every other number stay exactly as they are.</li>
                  </ul>
                </div>
              ) : (
                <div className="border border-red-200 bg-red-50 p-4">
                  <p className="text-[11px] uppercase tracking-widest text-red-700 font-medium mb-2">Before you delete</p>
                  <ul className="text-xs text-neutral-700 space-y-1.5 list-disc pl-4">
                    <li>{t.item} and its remaining stock will be permanently removed from Inventory.</li>
                    {pur > 0 && <li>{pur} purchase record{pur === 1 ? "" : "s"} of this item will be removed.</li>}
                    {sel > 0 && <li>{sel} sale record{sel === 1 ? "" : "s"} of this item will be removed.</li>}
                    <li>Stock, mill dues and profit all recalculate to match.</li>
                  </ul>
                </div>
              )}
            </>
          );
        })()}
      </ConfirmModal>
    </Page>
  );
}
