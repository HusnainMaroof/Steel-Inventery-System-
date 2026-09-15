"use client";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useStore, type VariantStockRow } from "@/lib/store";
import { Page, PageTitle, EmptyState, Modal } from "@/components/ui";
import { fmtQtyWithUnit, fmtRateWithUnit, fmtMoney, fmtDate } from "@/lib/format";
import { productUsesCategories, resolveDefs, attrsValuesLine } from "@/lib/catalogue";

type Group = {
  product: string;
  unit: string;
  rows: VariantStockRow[];
  qty: number;
  value: number;
};

type StockStatus = "in" | "low" | "out";

/* stock status: out = nothing left; low = ≤10% of what was purchased remains */
const statusOf = (r: VariantStockRow): StockStatus => {
  if (r.stockQty <= 0.000001) return "out";
  if (r.stockQty <= r.purchasedQty * 0.1 + 0.000001) return "low";
  return "in";
};

const STATUS_LABEL: Record<StockStatus, string> = {
  in: "In stock",
  low: "Low stock",
  out: "Out of stock",
};

/* three-dot row menu */
function StockMenu({ items }: { items: { label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-block text-left shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Row actions"
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
  } = useStore();

  const [productFilter, setProductFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | StockStatus>("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"stock" | "movements">("stock");
  const [movementVariant, setMovementVariant] = useState<string | null>(null);
  const [moveType, setMoveType] = useState<string>("all");
  const [moveMonth, setMoveMonth] = useState<string>("all");
  const [moveYear, setMoveYear] = useState<string>("all");
  const [moveDate, setMoveDate] = useState<string>("");
  const [detail, setDetail] = useState<VariantStockRow | null>(null);

  const defsFor = (opts: { productId?: string; categoryId?: string; snapshot?: Record<string, string> }) =>
    resolveDefs(attributeDefs, opts);
  const supplierName = (id?: string) => suppliers.find((s) => s.id === id)?.name ?? "";
  const whName = (id?: string) => warehouses.find((w) => w.id === id)?.name ?? "";
  const locName = (id?: string) => locations.find((l) => l.id === id)?.name ?? "";
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "";
  const filterProduct = products.find((p) => p.id === productFilter);
  const showCategoryFilter = productFilter !== "all" && productUsesCategories(filterProduct);

  /* dynamic attribute rows for a variant: "Label: value", one per attribute */
  const attrRows = (r: VariantStockRow) => {
    const defs = defsFor({ productId: r.productId, categoryId: r.categoryId, snapshot: r.attributeSnapshot });
    if (r.attributeSnapshot && defs.length > 0)
      return defs.filter((d) => r.attributeSnapshot![d.key]).map((d) => ({ label: d.name, value: r.attributeSnapshot![d.key] }));
    const line = attrsValuesLine(defs, r.attributeSnapshot);
    return line ? line.split(" · ").map((v) => ({ label: "", value: v })) : [];
  };

  const matchesSearch = (r: VariantStockRow) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const hay: string[] = [
      r.product ?? "",
      r.category ?? "",
      r.shortName,
      ...attrRows(r).map((a) => `${a.label} ${a.value}`),
      ...Object.values(r.attributeSnapshot ?? {}),
    ];
    for (const l of stockLots)
      if (l.variantId === r.variantId)
        hay.push(supplierName(l.supplierId), l.lotNumber ?? "", l.heatNumber ?? "", l.batchNumber ?? "", locName(l.locationId));
    return hay.some((x) => x.toLowerCase().includes(q));
  };

  const filtered = useMemo(() => {
    let rows = inventoryByVariant;
    if (productFilter !== "all") rows = rows.filter((r) => r.productId === productFilter);
    if (categoryFilter !== "all") rows = rows.filter((r) => r.categoryId === categoryFilter);
    if (statusFilter !== "all") rows = rows.filter((r) => statusOf(r) === statusFilter);
    return rows.filter(matchesSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryByVariant, productFilter, categoryFilter, statusFilter, search, stockLots]);

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, VariantStockRow[]>();
    for (const r of filtered) {
      const key = r.product || "Other";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([product, rows]) => ({
        product,
        unit: rows[0]?.unit ?? "",
        rows,
        qty: rows.reduce((a, r) => a + r.stockQty, 0),
        value: rows.reduce((a, r) => a + r.stockValue, 0),
      }));
  }, [filtered]);

  /* movements with running stock per variant (chronological accumulation) */
  const movesWithRunning = useMemo(() => {
    const sorted = [...stockMovements].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const running: Record<string, number> = {};
    const withRun = sorted.map((m) => {
      const key = m.variantId ?? `?${m.categoryId ?? m.productId ?? ""}`;
      running[key] = (running[key] ?? 0) + m.qty;
      return { ...m, after: running[key] };
    });
    return withRun.reverse();
  }, [stockMovements]);

  const inStockCount = filtered.filter((r) => r.stockQty > 0.000001).length;
  const hasFilters =
    search.trim() !== "" ||
    productFilter !== "all" ||
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    moveType !== "all" ||
    moveMonth !== "all" ||
    moveYear !== "all" ||
    moveDate !== "";

  const lotsOf = (variantId: string) =>
    stockLots
      .filter((l) => l.variantId === variantId)
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));

  const movementsOf = (variantId: string) =>
    stockMovements
      .filter((m) => m.variantId === variantId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);

  const filteredMoves = useMemo(() => {
    const q = search.toLowerCase().trim();
    let moves = movesWithRunning;
    if (movementVariant) return moves.filter((m) => m.variantId === movementVariant);
    if (productFilter !== "all") moves = moves.filter((m) => m.productId === productFilter);
    if (moveType !== "all") moves = moves.filter((m) => m.type === moveType);
    if (moveDate) moves = moves.filter((m) => m.date === moveDate);
    if (moveMonth !== "all") moves = moves.filter((m) => m.date.slice(5, 7) === moveMonth);
    if (moveYear !== "all") moves = moves.filter((m) => m.date.slice(0, 4) === moveYear);
    if (!q) return moves;
    return moves.filter((m) => {
      const prod = m.productId ? products.find((p) => p.id === m.productId)?.name : undefined;
      const cat = m.categoryId ? categories.find((c) => c.id === m.categoryId) : undefined;
      const defs = defsFor({ productId: m.productId, categoryId: m.categoryId, snapshot: m.attributeSnapshot });
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
  }, [movesWithRunning, search, productFilter, moveType, moveMonth, moveYear, moveDate, movementVariant]);

  /* movements grouped by date — each movement gets its own table */
  const moveDateGroups = useMemo(() => {
    const sorted = [...filteredMoves].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    const map = new Map<string, typeof sorted>();
    for (const m of sorted) {
      const list = map.get(m.date) ?? [];
      list.push(m);
      map.set(m.date, list);
    }
    return Array.from(map.entries());
  }, [filteredMoves]);

  const clearFilters = () => {
    setSearch("");
    setProductFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setMoveType("all");
    setMoveMonth("all");
    setMoveYear("all");
    setMoveDate("");
    setMovementVariant(null);
  };

  const categoryOptions = productFilter === "all"
    ? categories
    : categories.filter((c) => c.productId === productFilter);

  return (
    <Page>
      <PageTitle
        title="Inventory"
        sub="What do I have, how much, and exactly which variant"
      />

      {/* tab switcher */}
      <div className="flex gap-6 border-b border-neutral-200 mb-4">
        {([
          ["stock", "Stock"],
          ["movements", "Movements"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setMovementVariant(null); }} className={`pb-2 text-xs uppercase tracking-widest border-b-2 -mb-px transition-colors ${tab === key ? "border-black text-black font-bold" : "border-transparent text-black font-normal hover:opacity-60"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* one row: search + filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={tab === "stock" ? "Search product, variant, attribute, lot, supplier…" : "Search movements…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!w-full !pl-9 !text-xs !py-2"
          />
        </div>
        <select
          value={productFilter}
          onChange={(e) => { setProductFilter(e.target.value); setCategoryFilter("all"); }}
          className="!w-auto !text-xs"
          aria-label="Filter by product"
        >
          <option value="all">All Products</option>
          {products.filter((p) => p.active !== false).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {tab === "stock" ? (
          <>
            {showCategoryFilter && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="!w-auto !text-xs"
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | StockStatus)}
              className="!w-auto !text-xs"
              aria-label="Filter by stock status"
            >
              <option value="all">All Status</option>
              <option value="in">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </>
        ) : (
          <>
            <select
              value={moveType}
              onChange={(e) => setMoveType(e.target.value)}
              className="!w-auto !text-xs"
              aria-label="Filter by movement type"
            >
              <option value="all">All Movement Types</option>
              <option value="PURCHASE_RECEIPT">Purchase</option>
              <option value="SALE">Sale</option>
            </select>
            <select
              value={moveMonth}
              onChange={(e) => setMoveMonth(e.target.value)}
              className="!w-auto !text-xs"
              aria-label="Filter by month"
            >
              <option value="all">All months</option>
              {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m, i) => (
                <option key={m} value={m}>{new Date(2000, i, 1).toLocaleDateString("en-GB", { month: "long" })}</option>
              ))}
            </select>
            <select
              value={moveYear}
              onChange={(e) => setMoveYear(e.target.value)}
              className="!w-auto !text-xs"
              aria-label="Filter by year"
            >
              <option value="all">All years</option>
              {Array.from(new Set([...stockMovements.map((m) => m.date.slice(0, 4)), String(new Date().getFullYear())]))
                .sort((a, b) => b.localeCompare(a))
                .map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
            </select>
            <input
              type="date"
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              className="!w-auto !text-xs"
              aria-label="Filter by exact date"
            />
          </>
        )}
        {hasFilters && (
          <button onClick={clearFilters} className="btn-ghost !py-2 !px-3 !text-xs whitespace-nowrap">
            Clear
          </button>
        )}
      </div>

      {tab === "movements" ? (
        /* ---------------- movement journal — grouped by date, one table per movement ---------------- */
        filteredMoves.length === 0 ? (
          <EmptyState
            emoji="📦"
            title={movementVariant ? "No movements for this variant" : "No movements yet"}
            hint={movementVariant ? undefined : "Every purchase receipt and sale appears here automatically — it is a view of the ledger, not a second set of records."}
            action={movementVariant ? <button className="btn-primary" onClick={() => setMovementVariant(null)}>Show all movements</button> : undefined}
          />
        ) : (
          <div className="space-y-6">
            {movementVariant && (
              <div className="border border-neutral-200 px-4 py-2.5 flex items-center justify-between gap-3 bg-neutral-50/50">
                <span className="text-xs font-medium text-black">
                  Showing movements of one variant
                </span>
                <button onClick={() => setMovementVariant(null)} className="text-xs font-medium text-black hover:opacity-60">
                  Clear
                </button>
              </div>
            )}
            {moveDateGroups.map(([date, items]) => (
              <div key={date}>
                {/* date group header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-bold text-black">{fmtDate(date)}</span>
                  <div className="flex-1 border-b border-neutral-200" />
                </div>

                {/* one table per movement */}
                <div className="space-y-3">
                  {items.map((m) => {
                    const prodName = m.productId ? products.find((p) => p.id === m.productId)?.name : undefined;
                    const cat = m.categoryId ? categories.find((c) => c.id === m.categoryId) : undefined;
                    const defs = defsFor({ productId: m.productId, categoryId: m.categoryId, snapshot: m.attributeSnapshot });
                    const attrs = m.attributeSnapshot
                      ? defs.filter((d) => m.attributeSnapshot![d.key]).map((d) => ({ label: d.name, value: m.attributeSnapshot![d.key] }))
                      : [];
                    const isIn = m.type === "PURCHASE_RECEIPT";
                    const refLabel = isIn ? (m.refLabel || "Purchase") : (m.refLabel || "Sale");
                    const refLink = m.purchaseId ? `/purchases/${m.purchaseId}` : m.saleId ? `/sales/${m.saleId}` : null;
                    return (
                      <div key={m.id} className="hidden md:block border border-neutral-200 bg-white">
                        <div className="grid grid-cols-[84px_minmax(0,2fr)_98px_minmax(0,1fr)_94px] gap-2 px-3 lg:grid-cols-[100px_minmax(0,2fr)_110px_minmax(0,1fr)_110px] lg:gap-3 lg:px-4 py-2 text-[11px] uppercase tracking-widest text-black font-medium border-b border-neutral-200">
                          <span>Type</span>
                          <span>Product</span>
                          <span className="text-right">Quantity</span>
                          <span>Reference</span>
                          <span className="text-right">Stock After</span>
                        </div>
                        <div className="grid grid-cols-[84px_minmax(0,2fr)_98px_minmax(0,1fr)_94px] gap-2 px-3 lg:grid-cols-[100px_minmax(0,2fr)_110px_minmax(0,1fr)_110px] lg:gap-3 lg:px-4 py-3">
                          <span className="self-center">
                            <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${isIn ? "text-black bg-neutral-100 border-neutral-200" : "text-[#a12b1f] bg-[#fdf1ef] border-[#f0d2cc]"}`}>
                              {isIn ? "Purchase" : "Sale"}
                            </span>
                          </span>
                          <div className="min-w-0 self-center">
                            <span className="block font-medium text-xs text-black truncate">{prodName ?? "—"}</span>
                            {cat && <span className="block text-[11px] text-black truncate">{cat.name}</span>}
                            {attrs.map((a, i) => (
                              <span key={i} className="block text-[11px] text-black truncate">
                                {a.label}: {a.value}
                              </span>
                            ))}
                          </div>
                          <span className={`text-right text-xs font-semibold tabular-nums self-center ${m.qty > 0 ? "text-black" : "text-[#a12b1f]"}`}>
                            {m.qty > 0 ? "+" : "−"}{fmtQtyWithUnit(Math.abs(m.qty), m.unit)}
                          </span>
                          <span className="text-xs self-center">
                            {refLink ? (
                              <Link href={refLink} className="font-medium text-black underline underline-offset-2 hover:opacity-60">{refLabel}</Link>
                            ) : (
                              <span className="text-black">{refLabel}</span>
                            )}
                          </span>
                          <span className="text-right text-xs font-medium tabular-nums text-black self-center">
                            {fmtQtyWithUnit(m.after, m.unit)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* mobile — one card per movement */}
                <div className="md:hidden space-y-3">
                  {items.map((m) => {
                    const prodName = m.productId ? products.find((p) => p.id === m.productId)?.name : undefined;
                    const cat = m.categoryId ? categories.find((c) => c.id === m.categoryId) : undefined;
                    const defs = defsFor({ productId: m.productId, categoryId: m.categoryId, snapshot: m.attributeSnapshot });
                    const attrs = m.attributeSnapshot
                      ? defs.filter((d) => m.attributeSnapshot![d.key]).map((d) => ({ label: d.name, value: m.attributeSnapshot![d.key] }))
                      : [];
                    const isIn = m.type === "PURCHASE_RECEIPT";
                    const refLabel = isIn ? (m.refLabel || "Purchase") : (m.refLabel || "Sale");
                    const refLink = m.purchaseId ? `/purchases/${m.purchaseId}` : m.saleId ? `/sales/${m.saleId}` : null;
                    return (
                      <div key={m.id} className="border border-neutral-200 bg-white px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${isIn ? "text-black bg-neutral-100 border-neutral-200" : "text-[#a12b1f] bg-[#fdf1ef] border-[#f0d2cc]"}`}>
                            {isIn ? "Purchase" : "Sale"}
                          </span>
                          <span className="text-[11px] tabular-nums text-black">Stock after: {fmtQtyWithUnit(m.after, m.unit)}</span>
                        </div>
                        <div className="min-w-0 mt-1.5">
                          <span className="block font-medium text-xs text-black truncate">{prodName ?? "—"}</span>
                          {cat && <span className="block text-[11px] text-black truncate">{cat.name}</span>}
                          {attrs.map((a, i) => (
                            <span key={i} className="block text-[11px] text-black truncate">
                              {a.label}: {a.value}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-2">
                          <span className={`text-sm font-semibold tabular-nums ${m.qty > 0 ? "text-black" : "text-[#a12b1f]"}`}>
                            {m.qty > 0 ? "+" : "−"}{fmtQtyWithUnit(Math.abs(m.qty), m.unit)}
                          </span>
                          <div className="text-xs">
                            {refLink ? (
                              <Link href={refLink} className="font-medium text-black underline underline-offset-2">{refLabel}</Link>
                            ) : (
                              <span className="text-black">{refLabel}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ---------------- stock ---------------- */
        <>
          {/* top summary — variants count + per-product totals (never one mixed-unit total) */}
          {filtered.length > 0 && (
            <div className="border border-neutral-200 bg-white p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="block text-[11px] uppercase tracking-widest text-black font-medium">In-stock variants</span>
                <span className="block text-2xl font-bold tabular-nums text-black mt-1">{inStockCount}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                {groups.map((g) => (
                  <div key={g.product}>
                    <span className="block text-[11px] uppercase tracking-widest text-black font-medium">{g.product}</span>
                    <span className="block text-sm font-bold tabular-nums text-black mt-0.5">{fmtQtyWithUnit(g.qty, g.unit)}</span>
                    <span className="block text-[11px] text-black tabular-nums">{fmtMoney(g.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inventoryByVariant.length === 0 ? (
            <EmptyState
              emoji="🏷️"
              title="No stock yet"
              hint="Inventory builds itself as you record purchases and sales."
              action={<Link href="/purchases" className="btn-primary">+ Add Purchase</Link>}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title="No variants match"
              hint="Try a different search term or clear the filters."
              action={<button className="btn-primary" onClick={clearFilters}>Clear filters</button>}
            />
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.product}>
                  {/* product group header */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-bold text-black">{g.product}</span>
                    <span className="text-xs font-medium text-black">{g.rows.length} variant{g.rows.length > 1 ? "s" : ""}</span>
                    <div className="flex-1 border-b border-neutral-200" />
                    <span className="text-sm font-bold text-black tabular-nums">{fmtQtyWithUnit(g.qty, g.unit)}</span>
                    <span className="text-xs font-bold text-black tabular-nums">{fmtMoney(g.value)}</span>
                  </div>

                  <div className="border border-neutral-200 bg-white">
                    {/* desktop header */}
                    <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_112px_120px_50px_40px] gap-2 px-3 md:grid-cols-[minmax(0,2fr)_140px_140px_70px_44px] md:gap-3 md:px-4 py-2 text-[11px] uppercase tracking-widest text-black font-medium border-b border-neutral-200">
                      <span>Product</span>
                      <span className="text-right">Available Stock</span>
                      <span className="text-right">Stock Value</span>
                      <span className="text-right">Lots</span>
                      <span />
                    </div>
                    {g.rows.map((r) => {
                      const lots = lotsOf(r.variantId);
                      const st = statusOf(r);
                      const attrs = attrRows(r);
                      const menu = (
                        <StockMenu
                          items={[
                            { label: "View stock", onClick: () => setDetail(r) },
                            { label: "View lots", onClick: () => setDetail(r) },
                            { label: "View movements", onClick: () => { setTab("movements"); setMovementVariant(r.variantId); } },
                          ]}
                        />
                      );
                      return (
                        <div key={r.variantId}>
                          {/* desktop row */}
                          <div
                            onClick={() => setDetail(r)}
                            className="hidden sm:grid grid-cols-[minmax(0,2fr)_112px_120px_50px_40px] gap-2 px-3 md:grid-cols-[minmax(0,2fr)_140px_140px_70px_44px] md:gap-3 md:px-4 py-3 border-b border-neutral-100 last:border-b-0 cursor-pointer hover:bg-neutral-50 transition-colors"
                          >
                            {/* variant identity: category + every attribute, dynamic */}
                            <div className="min-w-0">
                              <span className="block font-medium text-xs text-black truncate">{r.category || r.shortName}</span>
                              {attrs.map((a, i) => (
                                <span key={i} className="block text-[11px] text-black truncate">
                                  {a.label ? `${a.label}: ${a.value}` : a.value}
                                </span>
                              ))}
                            </div>
                            <div className="self-center text-right">
                              <span className={`block font-semibold text-[13px] tabular-nums ${st === "out" ? "text-[#a12b1f]" : "text-black"}`}>
                                {fmtQtyWithUnit(r.stockQty, r.unit)}
                              </span>
                              <span className={`block text-[11px] ${st === "in" ? "text-black" : "text-[#a12b1f]"}`}>
                                ● {STATUS_LABEL[st]}
                              </span>
                            </div>
                            <span className="self-center text-right text-xs font-medium tabular-nums text-black">
                              {st === "out" ? "—" : fmtMoney(r.stockValue)}
                            </span>
                            <span className="self-center text-right text-xs tabular-nums text-black">{lots.length}</span>
                            <span className="self-center flex justify-end">{menu}</span>
                          </div>

                          {/* mobile card */}
                          <div
                            onClick={() => setDetail(r)}
                            className="sm:hidden px-3 py-3 border-b border-neutral-100 last:border-b-0 cursor-pointer active:bg-neutral-50"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="block font-medium text-xs text-black truncate">{r.category || r.shortName}</span>
                                {attrs.map((a, i) => (
                                  <span key={i} className="block text-[11px] text-black truncate">
                                    {a.label ? `${a.label}: ${a.value}` : a.value}
                                  </span>
                                ))}
                              </div>
                              {menu}
                            </div>
                            <div className="flex items-end justify-between gap-3 mt-2.5">
                              <div>
                                <span className={`block font-semibold text-sm tabular-nums ${st === "out" ? "text-[#a12b1f]" : "text-black"}`}>
                                  {fmtQtyWithUnit(r.stockQty, r.unit)}
                                </span>
                                <span className={`block text-[11px] ${st === "in" ? "text-black" : "text-[#a12b1f]"}`}>
                                  ● {STATUS_LABEL[st]}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[11px] uppercase tracking-widest font-medium text-black">Stock Value</span>
                                <span className="block text-xs font-medium tabular-nums text-black">
                                  {st === "out" ? "—" : fmtMoney(r.stockValue)}
                                </span>
                                <span className="block text-[11px] tabular-nums text-black mt-0.5">{lots.length} lot{lots.length === 1 ? "" : "s"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============ Variant detail modal ============ */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? [detail.product, detail.category].filter(Boolean).join(" · ") : "Variant"}
        size="lg"
      >
        {detail && (() => {
          const r = detail;
          const lots = lotsOf(r.variantId);
          const moves = movementsOf(r.variantId);
          const st = statusOf(r);
          const attrs = attrRows(r);
          return (
            <div>
              {/* identity */}
              <div className="border border-neutral-200 mb-4">
                <div className="px-4 py-3 border-b border-neutral-200">
                  {attrs.length > 0 ? (
                    attrs.map((a, i) => (
                      <span key={i} className="block text-xs text-black">
                        {a.label ? `${a.label}: ${a.value}` : a.value}
                      </span>
                    ))
                  ) : (
                    <span className="block text-xs text-black">{r.shortName}</span>
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-xs uppercase tracking-widest font-medium text-black">Available Stock</span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-xl font-bold tabular-nums text-black">{fmtQtyWithUnit(r.stockQty, r.unit)}</span>
                    <span className={`text-[11px] ${st === "in" ? "text-black" : "text-[#a12b1f]"}`}>● {STATUS_LABEL[st]}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 border-t border-neutral-200">
                  <span className="text-xs uppercase tracking-widest font-medium text-black">Lots</span>
                  <span className="text-xs font-bold tabular-nums text-black">{lots.length} active lot{lots.length === 1 ? "" : "s"}</span>
                </div>
              </div>

              {/* lots */}
              <p className="text-[11px] uppercase tracking-widest font-medium text-black mb-2">Lots</p>
              <div className="border border-neutral-200 mb-4">
                {lots.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-black">No stock left — all lots of this variant are sold.</p>
                ) : (
                  lots.map((l) => {
                    const purchased = purchases.find((p) => p.id === l.purchaseId)?.qty;
                    return (
                      <div key={l.purchaseId} className="px-4 py-3 border-b border-neutral-100 last:border-b-0">
                        <div className="flex justify-between items-center gap-3">
                          <span className="text-xs font-bold text-black font-mono">
                            {l.lotNumber || l.heatNumber || l.batchNumber || "Lot"}
                          </span>
                          <span className="text-xs font-medium tabular-nums text-black">{fmtQtyWithUnit(l.remainingQty, l.unit)} left</span>
                        </div>
                        <div className="flex justify-between items-center gap-3 mt-1 text-[11px] text-black">
                          <span>Supplier: {l.supplierName}</span>
                          <span>{fmtDate(l.purchasedAt)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-3 mt-0.5 text-[11px] text-black">
                          <span>{purchased !== undefined ? `Purchased: ${fmtQtyWithUnit(purchased, l.unit)}` : "—"}</span>
                          <span>Landed: {fmtRateWithUnit(l.landedPerUnit)}</span>
                        </div>
                        {(l.warehouseId || l.locationId) && (
                          <p className="text-[11px] text-black mt-0.5">
                            {[whName(l.warehouseId), locName(l.locationId)].filter(Boolean).join(" / ")}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* recent movements */}
              <p className="text-[11px] uppercase tracking-widest font-medium text-black mb-2">Recent Movements</p>
              <div className="border border-neutral-200">
                {moves.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-black">No movements recorded yet.</p>
                ) : (
                  moves.map((m) => (
                    <div key={m.id} className="flex justify-between items-center gap-3 px-4 py-2.5 border-b border-neutral-100 last:border-b-0">
                      <span className={`text-sm font-semibold tabular-nums ${m.qty > 0 ? "text-black" : "text-[#a12b1f]"}`}>
                        {m.qty > 0 ? "+" : "−"}{fmtQtyWithUnit(Math.abs(m.qty), m.unit)}
                      </span>
                      <span className="text-xs text-black">{m.type === "PURCHASE_RECEIPT" ? "Purchase" : m.type === "SALE" ? "Sale" : m.type}</span>
                      <span className="text-xs text-black tabular-nums">{fmtDate(m.date)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </Page>
  );
}
