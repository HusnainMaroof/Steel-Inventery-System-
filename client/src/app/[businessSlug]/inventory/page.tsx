"use client";
import { BusinessLink } from "@/components/BusinessLink";
import { useState, useMemo } from "react";
import { useStore, type VariantStockRow } from "@/lib/store";
import { CustomSelect, EmptyState, Modal, Page, PageTitle, RowActionsMenu, SearchBar } from "@/components/ui";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Package, Search, Tag } from "lucide-react";
import { dateInIsoRange } from "@/lib/date-range-filter";
import { fmtQtyWithUnit, fmtRateWithUnit, fmtMoney, fmtDate } from "@/lib/format";
import { productUsesCategories, resolveDefs, attrsValuesLine } from "@/lib/catalogue";
import { purchaseParentId } from "@/lib/purchase-utils";
import Decimal from "decimal.js";
import { toDecimal } from "../../../lib/decimal";

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
  const [moveRange, setMoveRange] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  const [detail, setDetail] = useState<VariantStockRow | null>(null);

  const defsFor = (opts: { productId?: string; categoryId?: string; snapshot?: Record<string, string> }) =>
    resolveDefs(attributeDefs, opts);
  const supplierName = (id?: string) => suppliers.find((s) => s.id === id)?.name ?? "";
  const whName = (id?: string) => warehouses.find((w) => w.id === id)?.name ?? "";
  const locName = (id?: string) => locations.find((l) => l.id === id)?.name ?? "";
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
        value: rows.reduce((a, r) => a.plus(toDecimal(r.stockValue)), new Decimal(0)).toNumber(),
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
    !!(moveRange.from || moveRange.to);

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
    if (moveRange.from || moveRange.to) {
      moves = moves.filter((m) => dateInIsoRange(m.date, moveRange));
    }
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
  }, [movesWithRunning, search, productFilter, moveType, moveRange, movementVariant]);

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
    setMoveRange({ from: null, to: null });
    setMovementVariant(null);
  };

  const categoryOptions = productFilter === "all"
    ? categories
    : categories.filter((c) => c.productId === productFilter);

  return (
    <Page>
      <PageTitle title="Inventory" />

      {/* tab switcher */}
      <div role="tablist" className="flex gap-6 border-b border-[#E5E5E5] mb-6">
        {([
          ["stock", "Stock"],
          ["movements", "Movements"],
        ] as const).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setMovementVariant(null); }} className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key ? "border-ink text-ink" : "border-transparent text-[#171717]/70 hover:text-[#171717]"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* one toolbar: search + filters */}
      <div className="mb-6 flex flex-col gap-2.5 rounded-2xl border border-[#E5E5E5] bg-white p-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchBar
          value={search}
          onSearch={setSearch}
          placeholder={tab === "stock" ? "Search product, variant, lot or supplier" : "Search movements"}
          ariaLabel="Search products"
          className="min-w-[240px] flex-1"
        />
        <CustomSelect
          value={productFilter}
          onChange={(v) => { setProductFilter(v); setCategoryFilter("all"); }}
          ariaLabel="Filter by product"
          className="w-full sm:w-56"
          options={[
            { value: "all", label: "All Products" },
            ...products.filter((p) => p.active !== false).map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        {tab === "stock" ? (
          <>
            {showCategoryFilter && (
              <CustomSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                ariaLabel="Filter by category"
                className="w-full sm:w-52"
                options={[
                  { value: "all", label: "All Categories" },
                  ...categoryOptions.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            )}
            <CustomSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "all" | StockStatus)}
              ariaLabel="Filter by stock status"
              className="w-full sm:w-44"
              options={[
                { value: "all", label: "All Status" },
                { value: "in", label: "In Stock" },
                { value: "low", label: "Low Stock" },
                { value: "out", label: "Out of Stock" },
              ]}
            />
          </>
        ) : (
          <>
            <CustomSelect
              value={moveType}
              onChange={setMoveType}
              ariaLabel="Filter by movement type"
              className="w-full sm:w-52"
              options={[
                { value: "all", label: "All Movement Types" },
                { value: "PURCHASE_RECEIPT", label: "Purchase" },
                { value: "SALE", label: "Sale" },
              ]}
            />
            <DateRangePicker
              from={moveRange.from}
              to={moveRange.to}
              onChange={setMoveRange}
              placeholder="All dates"
              ariaLabel="Filter movements by date range"
              className="w-full sm:w-auto"
            />
          </>
        )}
        {hasFilters && (
          <button onClick={clearFilters} className="btn-ghost whitespace-nowrap">
            Clear
          </button>
        )}
      </div>

      {tab === "movements" ? (
        /* ---------------- movement journal — grouped by date, one table per movement ---------------- */
        filteredMoves.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={movementVariant ? "No movements for this variant" : "No movements yet"}
            hint={movementVariant ? undefined : "Every purchase receipt and sale appears here automatically — it is a view of the ledger, not a second set of records."}
            action={movementVariant ? <button className="btn-primary" onClick={() => setMovementVariant(null)}>Show all movements</button> : undefined}
          />
        ) : (
          <div className="space-y-6">
            {movementVariant && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5E5E5] bg-white px-4 py-3">
                <span className="text-[13px] font-semibold text-[#171717]">
                  Showing movements of one variant
                </span>
                <button onClick={() => setMovementVariant(null)} className="text-[13px] font-medium text-[#171717] hover:opacity-60">
                  Clear
                </button>
              </div>
            )}
            {moveDateGroups.map(([date, items]) => (
              <div key={date}>
                {/* date group header */}
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[15px] font-bold text-[#171717]">{fmtDate(date)}</span>
                  <div className="flex-1 border-b border-[#E5E5E5]" />
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
                      <div key={m.id} className="hidden overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white md:block">
                        <div className="grid grid-cols-[84px_minmax(0,2fr)_98px_minmax(0,1fr)_94px] gap-2 border-b border-[#E5E5E5] bg-white px-3 py-2 text-[13px] font-semibold normal-case tracking-normal text-[#171717] lg:grid-cols-[100px_minmax(0,2fr)_110px_minmax(0,1fr)_110px] lg:gap-3 lg:px-4">
                          <span>Type</span>
                          <span>Product</span>
                          <span className="text-right">Quantity</span>
                          <span>Reference</span>
                          <span className="text-right">Stock After</span>
                        </div>
                        <div className="grid grid-cols-[84px_minmax(0,2fr)_98px_minmax(0,1fr)_94px] gap-2 px-3 py-3 transition-colors hover:bg-[#FBFBFA] lg:grid-cols-[100px_minmax(0,2fr)_110px_minmax(0,1fr)_110px] lg:gap-3 lg:px-4">
                          <span className="self-center">
                            <span className={`rounded border px-2 py-0.5 text-[12px] font-semibold ${isIn ? "border-[#E5E5E5] bg-[#E5E5E5] text-[#171717]" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
                              {isIn ? "Purchase" : "Sale"}
                            </span>
                          </span>
                          <div className="min-w-0 self-center">
                            <span className="block truncate text-[13px] font-semibold text-[#171717]">{prodName ?? "-"}</span>
                            {cat && <span className="block truncate text-[13px] text-[#171717]/70">{cat.name}</span>}
                            {attrs.map((a, i) => (
                              <span key={i} className="block truncate text-[13px] text-[#171717]/70">
                                {a.label}: {a.value}
                              </span>
                            ))}
                          </div>
                          <span className={`self-center text-right text-[13px] font-semibold tabular-nums ${m.qty > 0 ? "text-[#171717]" : "text-destructive"}`}>
                            {m.qty > 0 ? "+" : "−"}{fmtQtyWithUnit(Math.abs(m.qty), m.unit)}
                          </span>
                          <span className="self-center text-[13px]">
                            {refLink ? (
                              <BusinessLink href={refLink} className="font-medium text-[#171717] underline underline-offset-2 hover:opacity-60">{refLabel}</BusinessLink>
                            ) : (
                              <span className="text-[#171717]">{refLabel}</span>
                            )}
                          </span>
                          <span className="self-center text-right text-[13px] font-medium tabular-nums text-[#171717]">
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
                      <div key={m.id} className="rounded-2xl border border-[#E5E5E5] bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded border px-2 py-0.5 text-[12px] font-semibold ${isIn ? "border-[#E5E5E5] bg-[#E5E5E5] text-[#171717]" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
                            {isIn ? "Purchase" : "Sale"}
                          </span>
                          <span className="text-[12px] tabular-nums text-[#171717]/70">Stock after: {fmtQtyWithUnit(m.after, m.unit)}</span>
                        </div>
                        <div className="mt-1.5 min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-[#171717]">{prodName ?? "-"}</span>
                          {cat && <span className="block truncate text-[13px] text-[#171717]/70">{cat.name}</span>}
                          {attrs.map((a, i) => (
                            <span key={i} className="block truncate text-[13px] text-[#171717]/70">
                              {a.label}: {a.value}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className={`text-sm font-semibold tabular-nums ${m.qty > 0 ? "text-[#171717]" : "text-destructive"}`}>
                            {m.qty > 0 ? "+" : "−"}{fmtQtyWithUnit(Math.abs(m.qty), m.unit)}
                          </span>
                          <div className="text-[13px]">
                            {refLink ? (
                              <BusinessLink href={refLink} className="font-medium text-[#171717] underline underline-offset-2">{refLabel}</BusinessLink>
                            ) : (
                              <span className="text-[#171717]">{refLabel}</span>
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
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E5E5E5] bg-white p-5">
              <div>
                <span className="block text-[14px] font-semibold text-[#171717]">In-stock variants</span>
                <span className="mt-1 block text-[24px] font-bold tabular-nums text-[#171717]">{inStockCount}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                {groups.map((g) => (
                  <div key={g.product}>
                    <span className="block text-[14px] font-semibold text-[#171717]">{g.product}</span>
                    <span className="mt-0.5 block text-[15px] font-bold tabular-nums text-[#171717]">{fmtQtyWithUnit(g.qty, g.unit)}</span>
                    <span className="block text-[13px] tabular-nums text-[#171717]/70">{fmtMoney(g.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inventoryByVariant.length === 0 ? (
          <EmptyState
            icon={<Tag />}
            title="No stock yet"
            hint="Inventory builds itself as you record purchases and sales."
            action={<BusinessLink href="/purchases" hideWhenBlocked className="btn-primary">+ Add Purchase</BusinessLink>}
            />
          ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title="No variants match"
            hint="Try a different search term or clear the filters."
            action={<button className="btn-primary" onClick={clearFilters}>Clear filters</button>}
            />
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.product}>
                  {/* product group header */}
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[15px] font-bold text-[#171717]">{g.product}</span>
                    <span className="text-[13px] text-[#171717]/70">{g.rows.length} variant{g.rows.length > 1 ? "s" : ""}</span>
                    <div className="min-w-[2rem] flex-1 border-b border-[#E5E5E5]" />
                    <span className="text-[15px] font-bold tabular-nums text-[#171717]">{fmtQtyWithUnit(g.qty, g.unit)}</span>
                    <span className="text-[13px] tabular-nums text-[#171717]/70">{fmtMoney(g.value)}</span>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white">
                    {/* desktop header */}
                    <div className="hidden grid-cols-[minmax(0,2fr)_112px_120px_50px_40px] gap-2 border-b border-[#E5E5E5] bg-white px-3 py-2 text-[13px] font-semibold normal-case tracking-normal text-[#171717] sm:grid md:grid-cols-[minmax(0,2fr)_140px_140px_70px_44px] md:gap-3 md:px-4">
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
                        <RowActionsMenu
                          items={[
                            { label: "View stock", onClick: () => setDetail(r) },
                            { label: "View lots", onClick: () => setDetail(r) },
                            { label: "View movements", onClick: () => { setTab("movements"); setMovementVariant(r.variantId); } },
                          ]}
                          buttonClassName="h-10 w-10"
                        />
                      );
                      return (
                        <div key={r.variantId}>
                          {/* desktop row */}
                          <div
                            onClick={() => setDetail(r)}
                            className="hidden cursor-pointer grid-cols-[minmax(0,2fr)_112px_120px_50px_40px] gap-2 border-b border-[#E5E5E5] px-3 py-3 transition-colors last:border-b-0 hover:bg-[#FBFBFA] sm:grid md:grid-cols-[minmax(0,2fr)_140px_140px_70px_44px] md:gap-3 md:px-4"
                          >
                            {/* variant identity: category header + every attribute, dynamic */}
                            <div className="min-w-0">
                              {r.category ? (
                                <span className="block truncate text-sm font-semibold text-[#171717]">{r.category}</span>
                              ) : attrs.length === 0 ? (
                                <span className="block truncate text-sm font-semibold text-[#171717]">{r.shortName}</span>
                              ) : null}
                              {attrs.map((a, i) => (
                                <span key={i} className="block truncate text-[13px] text-[#171717]/70">
                                  {a.label ? `${a.label}: ${a.value}` : a.value}
                                </span>
                              ))}
                            </div>
                            <div className="self-center text-right">
                              <span className={`block text-sm font-semibold tabular-nums ${st === "out" ? "text-destructive" : "text-[#171717]"}`}>
                                {fmtQtyWithUnit(r.stockQty, r.unit)}
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${st === "in" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                                <span className={`inline-block h-1 w-1 rounded-full ${st === "in" ? "bg-success" : "bg-destructive"}`} />
                                {STATUS_LABEL[st]}
                              </span>
                            </div>
                            <span className="self-center text-right text-[13px] font-medium tabular-nums text-[#171717]">
                              {st === "out" ? "-" : fmtMoney(r.stockValue)}
                            </span>
                            <span className="self-center text-right text-[13px] tabular-nums text-[#171717]">{lots.length}</span>
                            <span className="flex justify-end self-center">{menu}</span>
                          </div>

                          {/* mobile card */}
                          <div
                            onClick={() => setDetail(r)}
                            className="cursor-pointer border-b border-[#E5E5E5] px-4 py-4 transition-colors last:border-b-0 active:bg-[#F8F8F7] sm:hidden"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                {r.category ? (
                                  <span className="block truncate text-sm font-semibold text-[#171717]">{r.category}</span>
                                ) : attrs.length === 0 ? (
                                  <span className="block truncate text-sm font-semibold text-[#171717]">{r.shortName}</span>
                                ) : null}
                                {attrs.map((a, i) => (
                                  <span key={i} className="block truncate text-[13px] text-[#171717]/70">
                                    {a.label ? `${a.label}: ${a.value}` : a.value}
                                  </span>
                                ))}
                              </div>
                              {menu}
                            </div>
                            <div className="mt-2.5 flex items-end justify-between gap-3">
                              <div>
                                <span className={`block text-sm font-semibold tabular-nums ${st === "out" ? "text-destructive" : "text-[#171717]"}`}>
                                  {fmtQtyWithUnit(r.stockQty, r.unit)}
                                </span>
                                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${st === "in" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                                  <span className={`inline-block h-1 w-1 rounded-full ${st === "in" ? "bg-success" : "bg-destructive"}`} />
                                  {STATUS_LABEL[st]}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[12px] font-semibold text-[#171717]/70">Stock Value</span>
                                <span className="block text-[13px] font-semibold tabular-nums text-[#171717]">
                                  {st === "out" ? "-" : fmtMoney(r.stockValue)}
                                </span>
                                <span className="mt-0.5 block text-[12px] tabular-nums text-[#171717]/70">{lots.length} lot{lots.length === 1 ? "" : "s"}</span>
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
              <div className="mb-4 overflow-hidden rounded-2xl border border-[#E5E5E5]">
                <div className="border-b border-[#E5E5E5] px-4 py-3">
                  {attrs.length > 0 ? (
                    attrs.map((a, i) => (
                      <span key={i} className="block text-[13px] text-[#171717]">
                        {a.label ? `${a.label}: ${a.value}` : a.value}
                      </span>
                    ))
                  ) : (
                    <span className="block text-[13px] text-[#171717]">{r.shortName}</span>
                  )}
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[14px] font-semibold text-[#171717]">Available Stock</span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-xl font-bold tabular-nums text-[#171717]">{fmtQtyWithUnit(r.stockQty, r.unit)}</span>
                    <span className={`text-[12px] font-medium ${st === "in" ? "text-[#171717]" : "text-destructive"}`}>● {STATUS_LABEL[st]}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-[#E5E5E5] px-4 py-3">
                  <span className="text-[14px] font-semibold text-[#171717]">Lots</span>
                  <span className="text-[13px] font-bold tabular-nums text-[#171717]">{lots.length} active lot{lots.length === 1 ? "" : "s"}</span>
                </div>
              </div>

              {/* lots */}
              <p className="mb-2 text-[16px] font-bold text-[#171717]">Lots</p>
              <div className="mb-4 overflow-hidden rounded-2xl border border-[#E5E5E5]">
                {lots.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-[#171717]/70">No stock left, all lots of this variant are sold.</p>
                ) : (
                  lots.map((l) => {
                    const purchased = purchases
                      .filter((p) => purchaseParentId(p) === l.purchaseId)
                      .reduce((sum, p) => sum + p.qty, 0);
                    return (
                      <div key={l.purchaseId} className="border-b border-[#E5E5E5] px-4 py-3 last:border-b-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[13px] font-bold text-[#171717]">
                            {l.lotNumber || l.heatNumber || l.batchNumber || "Lot"}
                          </span>
                          <span className="text-[13px] font-medium tabular-nums text-[#171717]">{fmtQtyWithUnit(l.remainingQty, l.unit)} left</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-[12px] text-[#171717]/70">
                          <span>Supplier: {l.supplierName}</span>
                          <span>{fmtDate(l.purchasedAt)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-3 text-[12px] text-[#171717]/70">
                          <span>{purchased !== undefined ? `Purchased: ${fmtQtyWithUnit(purchased, l.unit)}` : "-"}</span>
                          <span>Landed: {fmtRateWithUnit(l.landedPerUnit)}</span>
                        </div>
                        {(l.warehouseId || l.locationId) && (
                          <p className="mt-0.5 text-[12px] text-[#171717]/70">
                            {[whName(l.warehouseId), locName(l.locationId)].filter(Boolean).join(" / ")}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* recent movements */}
              <p className="mb-2 text-[16px] font-bold text-[#171717]">Recent Movements</p>
              <div className="overflow-hidden rounded-2xl border border-[#E5E5E5]">
                {moves.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-[#171717]/70">No movements recorded yet.</p>
                ) : (
                  moves.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 border-b border-[#E5E5E5] px-4 py-2.5 last:border-b-0">
                      <span className={`text-sm font-semibold tabular-nums ${m.qty > 0 ? "text-[#171717]" : "text-destructive"}`}>
                        {m.qty > 0 ? "+" : "−"}{fmtQtyWithUnit(Math.abs(m.qty), m.unit)}
                      </span>
                      <span className="text-[13px] text-[#171717]/70">{m.type === "PURCHASE_RECEIPT" ? "Purchase" : m.type === "SALE" ? "Sale" : m.type}</span>
                      <span className="text-[13px] tabular-nums text-[#171717]/70">{fmtDate(m.date)}</span>
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
