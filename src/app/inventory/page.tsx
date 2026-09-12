"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useStore, type VariantStockRow } from "@/lib/store";
import { Page, PageTitle, EmptyState, ConfirmModal } from "@/components/ui";
import { fmtQtyWithUnit, fmtRateWithUnit, fmtMoney, fmtDate } from "@/lib/format";
import { groupDefsByCategory, attrsValuesLine } from "@/lib/catalogue";

type Group = {
  product: string;
  rows: VariantStockRow[];
  qty: number;
  value: number;
};

export default function InventoryPage() {
  const {
    products,
    categories,
    attributeDefs,
    suppliers,
    warehouses,
    locations,
    inventoryByVariant,
    stockLots,
    stockMovements,
    purchases,
    sales,
    deleteInventoryItem,
    hideInventoryItem,
    deleteInventoryVariant,
    hideInventoryVariant,
  } = useStore();

  const [productFilter, setProductFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [tab, setTab] = useState<"stock" | "movements">("stock");
  const [openVariant, setOpenVariant] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VariantStockRow | null>(null);

  const defsByCat = useMemo(() => groupDefsByCategory(attributeDefs), [attributeDefs]);
  const supplierName = (id?: string) => suppliers.find((s) => s.id === id)?.name ?? "";
  const whName = (id?: string) => warehouses.find((w) => w.id === id)?.name ?? "";
  const locName = (id?: string) => locations.find((l) => l.id === id)?.name ?? "";
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "";

  const attrText = (r: VariantStockRow) => attrsValuesLine(defsByCat[r.categoryId ?? ""] ?? [], r.attributeSnapshot);

  const filtered = useMemo(() => {
    let rows = inventoryByVariant;
    if (productFilter !== "all") rows = rows.filter((r) => r.productId === productFilter);
    const q = appliedSearch.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay: string[] = [
        r.product ?? "",
        r.category ?? "",
        r.shortName,
        attrText(r),
        ...Object.values(r.attributeSnapshot ?? {}),
      ];
      // lot / heat / batch / supplier text
      for (const l of stockLots)
        if (l.variantId === r.variantId)
          hay.push(supplierName(l.supplierId), l.lotNumber ?? "", l.heatNumber ?? "", l.batchNumber ?? "", locName(l.locationId));
      return hay.some((x) => x.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryByVariant, productFilter, appliedSearch, stockLots]);

  const active = useMemo(() => filtered.filter((r) => r.stockQty > 0.000001), [filtered]);
  const soldOut = useMemo(() => filtered.filter((r) => r.stockQty <= 0.000001), [filtered]);

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, VariantStockRow[]>();
    for (const r of active) {
      const key = r.product || "Other";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([product, rows]) => ({
        product,
        rows,
        qty: rows.reduce((a, r) => a + r.stockQty, 0),
        value: rows.reduce((a, r) => a + r.stockValue, 0),
      }));
  }, [active]);

  const lotsOf = (variantId: string) =>
    stockLots
      .filter((l) => l.variantId === variantId)
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));

  const filteredMoves = useMemo(() => {
    const q = appliedSearch.toLowerCase().trim();
    const moves = stockMovements;
    if (productFilter !== "all") return moves.filter((m) => m.productId === productFilter);
    if (!q) return moves;
    return moves.filter((m) => {
      const cat = m.categoryId ? categories.find((c) => c.id === m.categoryId) : undefined;
      const defs = m.categoryId ? defsByCat[m.categoryId] ?? [] : [];
      const prod = cat ? products.find((p) => p.id === cat.productId)?.name : undefined;
      const text = [
        prod,
        cat?.name,
        m.attributeSnapshot ? attrsValuesLine(defs, m.attributeSnapshot) : "",
        m.refLabel,
        supplierName(m.supplierId),
      ].join(" ");
      return text.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockMovements, appliedSearch, productFilter]);

  const totalQty = active.reduce((a, r) => a + r.stockQty, 0);
  const totalValue = active.reduce((a, r) => a + r.stockValue, 0);
  const hasFilters = appliedSearch.trim() !== "" || productFilter !== "all";

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const legacy = deleteTarget.variantId.startsWith("item:");
    if (deleteTarget.stockQty <= 0.000001) {
      if (legacy && deleteTarget.legacyItem) hideInventoryItem(deleteTarget.legacyItem);
      else hideInventoryVariant(deleteTarget.variantId);
    } else {
      if (legacy && deleteTarget.legacyItem) deleteInventoryItem(deleteTarget.legacyItem);
      else deleteInventoryVariant(deleteTarget.variantId);
    }
    setDeleteTarget(null);
  };

  const movementLabel = (v: { variantId?: string; productId?: string; categoryId?: string; attributeSnapshot?: Record<string, string>; refLabel?: string }) => {
    if (!v.categoryId) return v.refLabel ?? "—";
    const prod = products.find((p) => p.id === (categories.find((c) => c.id === v.categoryId)?.productId ?? ""))?.name ?? "";
    const attrs = attrsValuesLine(defsByCat[v.categoryId] ?? [], v.attributeSnapshot);
    return [prod, attrs].filter(Boolean).join(" · ");
  };

  return (
    <Page>
      <PageTitle
        title="Inventory"
        sub="Stock at the variant level — each variant is its own sellable row, with its lots underneath"
        action={
          <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="!w-auto !text-xs">
            <option value="all">All products</option>
            {products.filter((p) => p.active !== false).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        }
      />

      {/* tab + filters */}
      <div className="flex gap-6 border-b border-neutral-200 mb-4">
        {([
          ["stock", `Stock${active.length > 0 ? ` (${active.length})` : ""}`],
          ["movements", "Movements"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`pb-2 text-xs uppercase tracking-widest border-b-2 -mb-px transition-colors ${tab === key ? "border-black text-black font-medium" : "border-transparent text-neutral-400 hover:text-neutral-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {inventoryByVariant.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1 sm:max-w-96">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={tab === "stock" ? "Search product, variant, attribute, lot, heat, supplier…" : "Search movements…"}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setAppliedSearch(searchInput); }}
              className="!w-full !pl-9 !text-xs !py-2"
            />
          </div>
          <button onClick={() => setAppliedSearch(searchInput)} className="btn-primary !py-2 !px-3 !text-xs whitespace-nowrap">
            Search
          </button>
          {hasFilters && (
            <button onClick={() => { setSearchInput(""); setAppliedSearch(""); setProductFilter("all"); }} className="btn-ghost !py-2 !px-3 !text-xs whitespace-nowrap">
              Clear
            </button>
          )}
        </div>
      )}

      {tab === "movements" ? (
        /* ---------------- movement journal ---------------- */
        filteredMoves.length === 0 ? (
          <EmptyState emoji="📦" title="No movements yet" hint="Every purchase receipt and sale appears here automatically — it is a view of the ledger, not a second set of records." />
        ) : (
          <div className="panel overflow-hidden">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th>Lot / Ref</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredMoves.slice(0, 300).map((m) => (
                  <tr key={m.id}>
                    <td className="text-neutral-500 whitespace-nowrap">{fmtDate(m.date)}</td>
                    <td>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${m.type === "PURCHASE_RECEIPT" ? "text-[#2e6b2e] bg-[#f0f7ef] border-[#cfe3cd]" : "text-[#a12b1f] bg-[#fdf1ef] border-[#f0d2cc]"}`}>
                        {m.type === "PURCHASE_RECEIPT" ? "In" : m.type === "SALE" ? "Out" : m.type}
                      </span>
                    </td>
                    <td className="text-neutral-700">{movementLabel(m)}</td>
                    <td className="num font-medium tabular-nums">{m.qty > 0 ? "+" : "−"}{fmtQtyWithUnit(Math.abs(m.qty), m.unit)}</td>
                    <td className="text-neutral-500 text-xs">{m.refLabel ?? "—"}</td>
                    <td className="text-neutral-500 text-xs">{m.supplierId ? supplierName(m.supplierId) : m.warehouseId ? [whName(m.warehouseId), locName(m.locationId)].filter(Boolean).join(" / ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMoves.length > 300 && (
              <p className="text-xs text-neutral-400 px-4 py-3">Showing the latest 300 of {filteredMoves.length} movements.</p>
            )}
          </div>
        )
      ) : (
        /* ---------------- stock ---------------- */
        <>
          {groups.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className="border border-neutral-200 bg-white p-4">
                <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Variants in stock</span>
                <span className="block text-xl font-semibold tabular-nums mt-1">
                  {active.length}
                  {hasFilters && <span className="text-sm font-normal text-neutral-400"> / {inventoryByVariant.length}</span>}
                </span>
              </div>
              <div className="border border-neutral-200 bg-white p-4">
                <span className="block text-[11px] uppercase tracking-widest text-neutral-500">Total stock</span>
                <span className="block text-xl font-semibold tabular-nums mt-1">{fmtQtyWithUnit(totalQty)}</span>
              </div>
              <div className="border border-black bg-black text-white p-4">
                <span className="block text-[11px] uppercase tracking-widest text-neutral-400">Stock value</span>
                <span className="block text-xl font-semibold tabular-nums mt-1">{fmtMoney(totalValue)}</span>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              emoji="🏷️"
              title={productFilter === "all" ? "No stock yet" : "Nothing in this product yet"}
              hint="Inventory builds itself as you record purchases and sales."
              action={<Link href="/purchases" className="btn-primary">+ Add Purchase</Link>}
            />
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.product}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium">{g.product}</span>
                    <span className="text-xs text-neutral-400">{g.rows.length} variant{g.rows.length > 1 ? "s" : ""}</span>
                    <div className="flex-1 border-b border-neutral-200" />
                    <span className="text-xs text-neutral-500 tabular-nums">{fmtQtyWithUnit(g.qty)}</span>
                    <span className="text-xs font-medium tabular-nums">{fmtMoney(g.value)}</span>
                  </div>

                  <div className="border border-neutral-200 bg-white divide-y divide-neutral-100">
                    {g.rows.map((r) => {
                      const lots = lotsOf(r.variantId);
                      const open = openVariant === r.variantId;
                      const attrs = attrText(r);
                      const isLow = r.stockQty > 0 && r.stockQty <= 5;
                      return (
                        <div key={r.variantId}>
                          {/* desktop-style row (flex so it also works stacked) */}
                          <div className="grid grid-cols-[minmax(0,2fr)_110px_120px_120px_120px_130px] sm:grid-cols-[minmax(0,2fr)_110px_120px_120px_120px_130px] gap-3 px-4 py-3 items-center">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  onClick={() => setOpenVariant(open ? null : r.variantId)}
                                  aria-label={open ? "Collapse lots" : "Show lots"}
                                  className="shrink-0 text-neutral-300 hover:text-black text-[11px]"
                                >
                                  {open ? "▾" : "▸"}
                                </button>
                                <span className="truncate font-medium text-[13px]">{r.shortName}</span>
                                <span className="text-neutral-400 text-xs shrink-0">{r.category}</span>
                              </div>
                              {attrs && <p className="text-[11px] text-neutral-500 truncate pl-5">{attrs}</p>}
                            </div>
                            <span className={`text-right font-semibold text-[13px] tabular-nums ${isLow ? "text-[#a12b1f]" : ""}`}>
                              {fmtQtyWithUnit(r.stockQty, r.unit)}
                            </span>
                            <span className="text-right text-xs tabular-nums text-neutral-600">
                              {fmtRateWithUnit(r.landedAvg)}
                            </span>
                            <span className="text-right text-xs tabular-nums text-neutral-500">{fmtMoney(r.stockValue)}</span>
                            <span className="text-right text-xs tabular-nums">
                              {(r.sellRate ?? r.avgSellRate) > 0 ? fmtRateWithUnit(r.sellRate ?? r.avgSellRate, r.unit) : <span className="text-neutral-300">—</span>}
                            </span>
                            <span className="flex items-center justify-end gap-2">
                              {lots.length > 1 && <span className="text-[10px] text-neutral-400 tabular-nums">{lots.length} lots</span>}
                              <button onClick={() => setDeleteTarget(r)} className="btn-ghost !py-1 !px-2 text-xs text-red-600 hover:!bg-red-50 shrink-0">Delete</button>
                            </span>
                          </div>

                          {/* lots */}
                          {open && (
                            <div className="px-4 pb-3 pl-9 sm:pl-12">
                              <div className="border border-neutral-200 rounded-md overflow-hidden">
                                <table className="!mb-0">
                                  <thead>
                                    <tr>
                                      <th>Lot</th>
                                      <th>Supplier</th>
                                      <th className="text-right">Remaining</th>
                                      <th className="text-right">Landed</th>
                                      <th>Location</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lots.length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="text-neutral-400 text-xs">No stock left — all lots of this variant are sold.</td>
                                      </tr>
                                    )}
                                    {lots.map((l) => (
                                      <tr key={l.purchaseId}>
                                        <td className="text-neutral-700 font-mono text-xs">
                                          {l.lotNumber || l.heatNumber || l.batchNumber || <span className="text-neutral-400 font-sans">—</span>}
                                        </td>
                                        <td className="text-neutral-600 text-xs">{l.supplierName}</td>
                                        <td className="num font-medium text-xs tabular-nums">{fmtQtyWithUnit(l.remainingQty, l.unit)}</td>
                                        <td className="num text-xs tabular-nums text-neutral-600">{fmtRateWithUnit(l.landedPerUnit)}</td>
                                        <td className="text-xs text-neutral-600">
                                          {l.warehouseId ? [whName(l.warehouseId), locName(l.locationId)].filter(Boolean).join(" / ") : <span className="text-neutral-400">—</span>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* ---- fully sold variants ---- */}
              {soldOut.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold text-neutral-800">Sold Out</span>
                    <span className="text-xs text-neutral-400">{soldOut.length} — everything sold, nothing left in stock</span>
                    <div className="flex-1 border-b border-neutral-200" />
                  </div>
                  <div className="border border-neutral-200 bg-white divide-y divide-neutral-100">
                    {soldOut.map((r) => {
                      const attrs = attrText(r);
                      return (
                        <div key={r.variantId} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <span className="block truncate text-[13px] font-medium">{r.shortName}</span>
                            <span className="block text-[11px] text-neutral-400 truncate">{[r.category, attrs, r.product].filter(Boolean).join(" · ") || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5">Sold Out</span>
                            <button onClick={() => setDeleteTarget(r)} className="btn-ghost !py-1 !px-2 text-xs text-red-600 hover:!bg-red-50">Remove</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget && deleteTarget.stockQty <= 0.000001 ? "Remove sold-out variant?" : "Delete from inventory?"}
        confirmLabel={deleteTarget && deleteTarget.stockQty <= 0.000001 ? "Remove from List" : "Delete"}
      >
        {deleteTarget && (() => {
          const t = deleteTarget;
          const soldOut = t.stockQty <= 0.000001;
          const pur = purchases.filter((x) => x.variantId === t.variantId || (t.legacyItem && x.item === t.legacyItem)).length;
          const sel = sales.filter((s) => s.lines.some((l) => l.variantId === t.variantId || (t.legacyItem && l.item === t.legacyItem))).length;
          return (
            <>
              <div className="border border-neutral-200 mb-5">
                <div className="flex justify-between items-center gap-3 py-2.5 px-4 border-b border-neutral-200">
                  <span className="text-sm text-neutral-500 truncate">{t.shortName}</span>
                  <span className="font-medium text-sm tabular-nums shrink-0">{fmtQtyWithUnit(t.stockQty, t.unit)}</span>
                </div>
                {attrText(t) && (
                  <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                    <span className="text-neutral-500">{catName(t.categoryId)}</span>
                    <span className="tabular-nums">{attrText(t)}</span>
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
                    <li>{t.shortName} and its remaining stock will be permanently removed from Inventory.</li>
                    {pur > 0 && <li>{pur} purchase record{pur === 1 ? "" : "s"} of this variant will be removed.</li>}
                    {sel > 0 && <li>{sel} sale record{sel === 1 ? "" : "s"} of this variant will be removed.</li>}
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
