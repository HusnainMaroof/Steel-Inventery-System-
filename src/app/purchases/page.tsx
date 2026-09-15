"use client";

import { useState, useMemo } from "react";
import { useStore, purchaseTotal, steelAmount } from "@/lib/store";
import { Page, PageTitle, Modal, ConfirmModal, useToggle, EmptyState, OptionalSection } from "@/components/ui";
import { useUiPreferences } from "@/lib/preferences";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate, fmtDateTime, qtyUnitLabel, perUnitLabel } from "@/lib/format";
import { AttributeFields, validateAttributes } from "@/components/catalogue/AttributeFields";
import { productUsesCategories, resolveDefs, scopedDefs } from "@/lib/catalogue";
import type { AttributeDef, AttributeOption, Purchase } from "@/lib/types";

/* structured identity of a purchase line — rendered from the stored
   hierarchy, never the concatenated shortName:
     Product name        (e.g. Cement)
     Category name       (e.g. Grey Cement) — only when the product uses categories
     Label: value        (one line per attribute, e.g. Company: DG Khan)
   Legacy records without a snapshot fall back to spec/quality lines. */
function Identity({
  item,
  productName,
  categoryName,
  snapshot,
  defs,
  spec,
  quality,
}: {
  item?: string;
  productName?: string;
  categoryName?: string;
  snapshot?: Record<string, string>;
  defs: AttributeDef[];
  spec?: string;
  quality?: string;
}) {
  const attrRows: { label: string; value: string }[] = snapshot
    ? defs
        .filter((d) => snapshot[d.key])
        .map((d) => ({ label: d.name, value: snapshot[d.key] }))
    : [
        ...(spec ? [{ label: "Spec", value: spec }] : []),
        ...(quality ? [{ label: "Quality", value: quality }] : []),
      ];
  const top = productName ?? item;
  if (!top && !categoryName && attrRows.length === 0) return null;
  return (
    <span className="block min-w-0">
      {top ? <span className="block font-medium text-xs text-black truncate">{top}</span> : null}
      {categoryName ? <span className="block text-[11px] text-black truncate">{categoryName}</span> : null}
      {attrRows.map((r) => (
        <span key={r.label} className="block text-[11px] text-black truncate">
          {r.label}: {r.value}
        </span>
      ))}
    </span>
  );
}

/* three-dot row menu — optional Pay, View opens the popup, Delete confirms */
function RowMenu({ onView, onPay, onDelete }: { onView: () => void; onPay?: () => void; onDelete: () => void }) {
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
          <div className="absolute right-0 top-9 z-30 w-40 bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
            {onPay && (
              <button
                type="button"
                onClick={() => { setOpen(false); onPay(); }}
                className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-black hover:bg-neutral-100 transition-colors"
              >
                Pay
              </button>
            )}
            <button
              type="button"
              onClick={() => { setOpen(false); onView(); }}
              className={`w-full text-left px-3.5 py-2 text-[13px] text-black hover:bg-neutral-100 transition-colors ${onPay ? "border-t border-neutral-100" : ""}`}
            >
              View details
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full text-left px-3.5 py-2 text-[13px] text-black hover:bg-neutral-100 border-t border-neutral-100 transition-colors"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </span>
  );
}

export default function PurchasesPage() {
  const {
    purchases,
    suppliers,
    products,
    categories,
    attributeDefs,
    attributeOptions,
    warehouses,
    locations,
    sales,
    addPurchase,
    updatePurchase,
    deletePurchase,
    addPayment,
    ensureVariant,
  } = useStore();
  const { open, onOpen, onClose } = useToggle();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "dues">("all");
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payError, setPayError] = useState("");
  const [formError, setFormError] = useState("");
  const [query, setQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const { prefs } = useUiPreferences();
  const [showLot, setShowLot] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    supplierId: suppliers[0]?.id ?? "",
    productId: products[0]?.id ?? "",
    categoryId: "",
    attrs: {} as Record<string, string>,
    lotNumber: "",
    heatNumber: "",
    batchNumber: "",
    warehouseId: "",
    locationId: "",
    qty: 0,
    rate: 0,
    loading: 0,
    transport: 0,
    labour: 0,
    otherCost: 0,
    sellRate: 0,
    paidNow: 0,
  });

  const product = products.find((p) => p.id === form.productId && p.active !== false) ?? products.find((p) => p.active !== false);
  const productUnit = product?.unit ?? "kg";
  const usesCats = productUsesCategories(product);
  const catsOfProduct = usesCats ? categories.filter((c) => c.productId === product?.id && c.active) : [];
  const category = usesCats
    ? (categories.find((c) => c.id === form.categoryId) ?? catsOfProduct[0])
    : undefined;
  const liveDefs = product
    ? scopedDefs(attributeDefs, product.id, usesCats ? category?.id : undefined).filter((d) => d.active)
    : [];
  const attrErrors = validateAttributes(liveDefs, form.attrs);

  const productOfPurchase = (p: Purchase) => {
    if (p.product) {
      const byName = products.find((x) => x.name === p.product);
      if (byName) return byName;
    }
    if (p.categoryId) {
      const cat = categories.find((c) => c.id === p.categoryId);
      if (cat) return products.find((x) => x.id === cat.productId);
    }
    return undefined;
  };
  const catNameOf = (p: Purchase) => {
    const prod = productOfPurchase(p);
    if (!productUsesCategories(prod) || !p.categoryId) return undefined;
    return categories.find((c) => c.id === p.categoryId)?.name;
  };
  const productNameOf = (p: Purchase) => productOfPurchase(p)?.name ?? p.product;
  const defsOfPurchase = (p: Purchase) =>
    resolveDefs(attributeDefs, {
      productId: productOfPurchase(p)?.id,
      categoryId: p.categoryId,
      snapshot: p.attributeSnapshot,
    });

  const defsOptions = useMemo(() => {
    const m: Record<string, AttributeOption[]> = {};
    for (const o of attributeOptions) (m[o.attributeDefId] ??= []).push(o);
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.sortOrder - b.sortOrder);
    return m;
  }, [attributeOptions]);
  const qtyLabel = qtyUnitLabel(productUnit);
  const perLabel = perUnitLabel(productUnit);
  const totalStock = form.qty * form.rate;
  const totalCharges = form.loading + form.transport + form.labour + form.otherCost;
  const totalCost = totalStock + totalCharges;
  const landedPerUnit = form.qty > 0 ? totalCost / form.qty : 0;
  const marginPerUnit = form.sellRate > 0 ? form.sellRate - landedPerUnit : 0;
  const warehouse = warehouses.find((w) => w.id === form.warehouseId && w.active);
  const whLocations = locations.filter((l) => l.warehouseId === form.warehouseId && l.active);
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;
  const numVal = (v: number) => (v === 0 ? "" : v);
  const openPay = (id: string) => { setPayId(id); setPayAmount(0); setPayError(""); };
  const closePay = () => { setPayId(null); setPayError(""); };
  const remainingOf = (p: Purchase) => Math.max(0, steelAmount(p) - (p.paid ?? 0));
  const duePurchases = purchases.filter((p) => remainingOf(p) > 0);
  const totalDue = duePurchases.reduce((a, p) => a + remainingOf(p), 0);

  const openAdd = () => {
    setFormError("");
    setShowLot(prefs.showOptionalDetails);
    onOpen();
  };

  const resetMoney = () =>
    setForm((f) => ({
      ...f,
      attrs: {},
      lotNumber: "",
      heatNumber: "",
      batchNumber: "",
      warehouseId: "",
      locationId: "",
      qty: 0,
      rate: 0,
      loading: 0,
      transport: 0,
      labour: 0,
      otherCost: 0,
      sellRate: 0,
      paidNow: 0,
    }));

  const onProductChange = (productId: string) => {
    const cats = categories.filter((c) => c.productId === productId && c.active);
    setForm((f) => ({ ...f, productId, categoryId: cats[0]?.id ?? "", attrs: {} }));
  };
  const onCategoryChange = (categoryId: string) => setForm((f) => ({ ...f, categoryId, attrs: {} }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const paidNow = Number(form.paidNow) || 0;
    if (paidNow > totalStock + 0.001) {
      setFormError(`Amount paid (${fmtMoney(paidNow)}) can't be more than this purchase's total of ${fmtMoney(totalStock)}.`);
      return;
    }
    if (!form.supplierId) return setFormError("Pick the supplier you bought from.");
    if (!product) return setFormError("Pick a product.");
    if (usesCats && !category) return setFormError("Pick a category — add one under Products if this product has none yet.");
    const errors = validateAttributes(liveDefs, form.attrs);
    if (Object.keys(errors).length > 0) return setFormError(Object.values(errors)[0]);
    setFormError("");
    const variant = ensureVariant(product.id, usesCats ? category?.id : undefined, form.attrs);
    addPurchase({
      date: form.date,
      supplierId: form.supplierId,
      product: product.name,
      item: variant.shortName,
      categoryId: usesCats ? category?.id : undefined,
      variantId: variant.id,
      attributeSnapshot: variant.attributes,
      lotNumber: form.lotNumber.trim() || undefined,
      heatNumber: form.heatNumber.trim() || undefined,
      batchNumber: form.batchNumber.trim() || undefined,
      warehouseId: form.warehouseId || undefined,
      locationId: form.locationId || undefined,
      qty: Number(form.qty),
      unit: productUnit,
      rate: Number(form.rate),
      transport: Number(form.transport),
      loadingCharges: Number(form.loading) || undefined,
      labourCharges: Number(form.labour) || undefined,
      otherCost: Number(form.otherCost),
      sellRate: Number(form.sellRate) || undefined,
      paid: paidNow,
      lastPaidAt: form.date,
      lastPaidAmount: paidNow,
      paymentHistory: paidNow > 0 ? [{ date: new Date().toISOString(), amount: paidNow }] : [],
    });
    onClose();
    resetMoney();
  };

  const confirmDeletePurchase = () => {
    if (!deleteTarget) return;
    const p = deleteTarget;
    deletePurchase(p.id);
    if (selectedId === p.id) setSelectedId(null);
    if (payId === p.id) setPayId(null);
    setDeleteTarget(null);
  };

  // Search + month/year filter (applies to All Purchases and Payment Dues)
  const yearOptions = Array.from(
    new Set([...purchases.map((p) => p.date.slice(0, 4)), String(new Date().getFullYear())])
  ).sort((a, b) => b.localeCompare(a));
  const matchesQuery = (p: Purchase) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const catName = catNameOf(p) ?? "";
    const prodName = productNameOf(p) ?? "";
    const attrs = p.attributeSnapshot ? Object.values(p.attributeSnapshot).join(" ") : [p.spec, p.quality].filter(Boolean).join(" ");
    return [supplierName(p.supplierId), prodName, catName, p.item, attrs, p.lotNumber ?? "", p.heatNumber ?? "", p.batchNumber ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q);
  };
  const matchesDate = (p: Purchase) => {
    if (filterMonth !== "all" && p.date.slice(5, 7) !== filterMonth) return false;
    if (filterYear !== "all" && p.date.slice(0, 4) !== filterYear) return false;
    return true;
  };
  const filteredPurchases = purchases.filter((p) => matchesQuery(p) && matchesDate(p));
  const filteredDues = duePurchases.filter((p) => matchesQuery(p) && matchesDate(p));

  // Date-grouped purchases
  const purchaseDateGroups = useMemo(() => {
    const sorted = [...filteredPurchases].sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, Purchase[]>();
    for (const p of sorted) {
      const list = map.get(p.date) ?? [];
      list.push(p);
      map.set(p.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        rows: items,
        dayTotal: items.reduce((a, p) => a + steelAmount(p), 0),
      }));
  }, [filteredPurchases]);

  const dueDateGroups = useMemo(() => {
    const sorted = [...filteredDues].sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, Purchase[]>();
    for (const p of sorted) {
      const list = map.get(p.date) ?? [];
      list.push(p);
      map.set(p.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({ date, rows: items }));
  }, [filteredDues]); // eslint-disable-line react-hooks/preserve-manual-memoization

  const selected = purchases.find((p) => p.id === selectedId) ?? null;

  const warehouseName = (id?: string) => warehouses.find((w) => w.id === id)?.name;
  const locationName = (id?: string) => locations.find((l) => l.id === id)?.name;

  return (
    <Page>
      <PageTitle
        title="Purchases"
        sub="Stock bought from suppliers, including delivery and other costs"
      />

      {/* one row: search + month/year filters + add */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search supplier, product, brand…"
          className="flex-1 min-w-[200px]"
          aria-label="Search purchases"
        />
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="!w-auto"
          aria-label="Filter by month"
        >
          <option value="all">All months</option>
          {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m, i) => (
            <option key={m} value={m}>{new Date(2000, i, 1).toLocaleDateString("en-GB", { month: "long" })}</option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="!w-auto"
          aria-label="Filter by year"
        >
          <option value="all">All years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button className="btn-primary shrink-0" onClick={openAdd}>+ Add Purchase</button>
      </div>

      <div className="flex gap-6 border-b border-neutral-200 mb-4">
        {([
          ["all", "All Purchases"],
          ["dues", `Payment Dues${totalDue > 0 ? ` (${duePurchases.length})` : ""}`],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`pb-2 text-xs uppercase tracking-widest border-b-2 -mb-px transition-colors ${tab === key ? "border-black text-black font-bold" : "border-transparent text-black font-normal hover:opacity-60"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "all" && (
        purchases.length === 0 ? (
          <EmptyState emoji="🚚" title="No purchases yet" hint={suppliers.length === 0 ? "Add a mill / supplier first, then your first purchase will feel right at home." : "Record your first purchase — date, supplier and rate is all it takes."} action={<button className="btn-primary" onClick={openAdd}>+ Add Purchase</button>} />
        ) : filteredPurchases.length === 0 ? (
          <EmptyState emoji="🔍" title="No purchases match" hint="Try a different search term or pick another date range." />
        ) : (
          <div className="space-y-6">
            {purchaseDateGroups.map((g) => (
              <div key={g.date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-bold text-black">{fmtDate(g.date)}</span>
                  <div className="flex-1 border-b border-neutral-200" />
                </div>

                {/* one table per purchase — each keeps its own amount */}
                <div className="space-y-3">
                  {g.rows.map((r) => (
                    <div key={r.id} className="hidden sm:block border border-neutral-200 bg-white">
                      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_110px_120px_130px_48px] gap-3 px-4 py-2 text-[11px] uppercase tracking-widest text-black font-medium border-b border-neutral-200">
                        <span>Supplier</span>
                        <span>Product</span>
                        <span className="text-right">Quantity</span>
                        <span className="text-right">Buying</span>
                        <span className="text-right">Selling</span>
                        <span />
                      </div>
                      <div
                        onClick={() => setSelectedId(r.id)}
                        className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_110px_120px_130px_48px] gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors"
                      >
                        <span className="block min-w-0 self-center">
                          <span className="block text-xs font-medium text-black truncate">{supplierName(r.supplierId)}</span>
                          <span className="block text-[11px] font-bold text-black tabular-nums truncate">Total: {fmtMoney(steelAmount(r))}</span>
                        </span>
                        <Identity
                          item={r.item}
                          productName={productNameOf(r)}
                          categoryName={catNameOf(r)}
                          snapshot={r.attributeSnapshot}
                          defs={defsOfPurchase(r)}
                          spec={r.spec}
                          quality={r.quality}
                        />
                        <span className="self-center text-right text-xs tabular-nums text-black">{fmtQtyWithUnit(r.qty, r.unit)}</span>
                        <span className="self-center text-right text-xs tabular-nums text-black">{fmtRateWithUnit(r.rate, r.unit)}</span>
                        <span className="self-center text-right text-xs tabular-nums text-black">
                          {r.sellRate ? fmtRateWithUnit(r.sellRate, r.unit) : "—"}
                        </span>
                        <span className="self-center flex justify-end">
                          <RowMenu
                            onView={() => setSelectedId(r.id)}
                            onDelete={() => setDeleteTarget(r)}
                          />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile cards — one card per purchase */}
                <div className="sm:hidden space-y-3">
                  {g.rows.map((r) => (
                    <div key={r.id} onClick={() => setSelectedId(r.id)} className="border border-neutral-200 bg-white p-3 cursor-pointer active:bg-neutral-50">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <Identity
                          item={r.item}
                          productName={productNameOf(r)}
                          categoryName={catNameOf(r)}
                          snapshot={r.attributeSnapshot}
                          defs={defsOfPurchase(r)}
                          spec={r.spec}
                          quality={r.quality}
                        />
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="font-medium text-sm tabular-nums text-black">{fmtQtyWithUnit(r.qty, r.unit)}</span>
                          <RowMenu
                            onView={() => setSelectedId(r.id)}
                            onDelete={() => setDeleteTarget(r)}
                          />
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5 text-xs text-black">
                        <span className="tabular-nums">Buy {fmtRateWithUnit(r.rate, r.unit)}</span>
                        <span className="tabular-nums font-medium">
                          {r.sellRate ? `Sell ${fmtRateWithUnit(r.sellRate, r.unit)}` : "No sell price"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "dues" && (
        <div>
          {totalDue > 0 && (
            <div className="border border-neutral-200 p-4 mb-5 flex justify-between items-center">
              <span className="text-xs uppercase tracking-widest text-black font-medium">Total Outstanding to Suppliers</span>
              <span className="font-bold tabular-nums text-lg text-[#a12b1f]">{fmtMoney(totalDue)}</span>
            </div>
          )}
          {duePurchases.length === 0 ? (
            <div className="border border-dashed border-neutral-300">
              <EmptyState emoji="🎉" compact title="No pending dues" hint="Every purchase is fully paid — the mills are smiling today." />
            </div>
          ) : filteredDues.length === 0 ? (
            <EmptyState emoji="🔍" title="No dues match" hint="Try a different search term or pick another month / year." />
          ) : (
            <div className="space-y-6">
              {dueDateGroups.map((g) => (
                <div key={g.date}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold text-black">{fmtDate(g.date)}</span>
                    <div className="flex-1 border-b border-neutral-200" />
                  </div>

                  {/* one table per due purchase */}
                  <div className="space-y-3">
                    {g.rows.map((r) => (
                      <div key={r.id} className="hidden sm:block border border-neutral-200 bg-white">
                        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_110px_130px_150px] gap-3 px-4 py-2 text-[11px] uppercase tracking-widest text-black font-medium border-b border-neutral-200">
                          <span>Supplier</span>
                          <span>Product</span>
                          <span className="text-right">Quantity</span>
                          <span className="text-right">Remaining</span>
                          <span />
                        </div>
                        <div
                          onClick={() => { openPay(r.id); }}
                          className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_110px_130px_150px] gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors"
                        >
                          <span className="block min-w-0 self-center">
                            <span className="block text-xs font-medium text-black truncate">{supplierName(r.supplierId)}</span>
                            <span className="block text-[11px] font-bold text-black tabular-nums truncate">Total: {fmtMoney(steelAmount(r))}</span>
                          </span>
                        <Identity
                          item={r.item}
                          productName={productNameOf(r)}
                          categoryName={catNameOf(r)}
                          snapshot={r.attributeSnapshot}
                          defs={defsOfPurchase(r)}
                          spec={r.spec}
                          quality={r.quality}
                        />
                          <span className="self-center text-right text-xs tabular-nums text-black">{fmtQtyWithUnit(r.qty, r.unit)}</span>
                          <span className="self-center text-right font-bold text-xs text-[#a12b1f] tabular-nums">{fmtMoney(remainingOf(r))}</span>
                          <span className="self-center flex justify-end">
                            <RowMenu
                              onPay={() => openPay(r.id)}
                              onView={() => setSelectedId(r.id)}
                              onDelete={() => setDeleteTarget(r)}
                            />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mobile cards — one card per due purchase */}
                  <div className="sm:hidden space-y-3">
                    {g.rows.map((r) => (
                      <div key={r.id} className="border border-neutral-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                        <Identity
                          item={r.item}
                          productName={productNameOf(r)}
                          categoryName={catNameOf(r)}
                          snapshot={r.attributeSnapshot}
                          defs={defsOfPurchase(r)}
                          spec={r.spec}
                          quality={r.quality}
                        />
                          <span className="flex items-center gap-1 shrink-0">
                            <span className="font-bold text-sm text-[#a12b1f] tabular-nums">Due {fmtMoney(remainingOf(r))}</span>
                            <RowMenu
                              onPay={() => openPay(r.id)}
                              onView={() => setSelectedId(r.id)}
                              onDelete={() => setDeleteTarget(r)}
                            />
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1.5 text-xs text-black">
                          <span className="tabular-nums">Paid {fmtMoney(r.paid ?? 0)} of {fmtMoney(steelAmount(r))}</span>
                          <span className="tabular-nums shrink-0">{r.lastPaidAt ? `Last ${fmtDate(r.lastPaidAt)}` : "No payments yet"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ Add Purchase Modal ============ */}
      <Modal
        open={open}
        onClose={() => { onClose(); setFormError(""); }}
        title="Add Purchase"
        subtitle="Record stock from a supplier — inventory updates automatically"
        full
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => { onClose(); setFormError(""); }}>Cancel</button>
            <button type="submit" form="purchase-form" className="btn-primary">Save Purchase</button>
          </div>
        }
      >
        <form id="purchase-form" onSubmit={submit}>
          {formError && (
            <div role="alert" className="border border-red-200 bg-red-50 text-red-700 text-[13px] px-4 py-3 rounded-lg mb-5">{formError}</div>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 xl:gap-8 items-start">
            {/* left — identity & quantities */}
            <div className="space-y-5 min-w-0">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
                <div>
                  <label>Supplier</label>
                  <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
                    <option value="" disabled>Select supplier…</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label>Product</label>
                  <select value={product?.id ?? ""} onChange={(e) => onProductChange(e.target.value)} required>
                    <option value="" disabled>Select product…</option>
                    {products.filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {usesCats && (
                  <div>
                    <label>Category</label>
                    <select value={category?.id ?? ""} onChange={(e) => onCategoryChange(e.target.value)} required>
                      <option value="" disabled>Select category…</option>
                      {catsOfProduct.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {liveDefs.length > 0 && (
                <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/50">
                  <p className="text-[12px] font-medium text-neutral-600 mb-3">Attributes</p>
                  <AttributeFields
                    defs={liveDefs}
                    value={form.attrs}
                    onChange={(patch) => setForm((f) => ({ ...f, attrs: { ...f.attrs, ...patch } }))}
                    optionsOf={(defId) => defsOptions[defId] ?? []}
                    requiredError={Object.keys(attrErrors).length ? attrErrors : undefined}
                  />
                </div>
              )}

              <OptionalSection
                title="Lot & location details"
                hint="Optional — heat, batch, warehouse for traceability in Inventory"
                open={showLot}
                onToggle={() => setShowLot((s) => !s)}
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label>Lot number</label><input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} placeholder="e.g. LOT-001" /></div>
                  <div><label>Heat number</label><input value={form.heatNumber} onChange={(e) => setForm({ ...form, heatNumber: e.target.value })} placeholder="e.g. H92831" /></div>
                  <div><label>Batch number</label><input value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} placeholder="e.g. LC-77342" /></div>
                  {warehouses.length > 0 && (
                    <>
                      <div>
                        <label>Warehouse</label>
                        <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value, locationId: "" })}>
                          <option value="">—</option>
                          {warehouses.filter((w) => w.active !== false).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Location</label>
                        <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} disabled={!warehouse}>
                          <option value="">—</option>
                          {whLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </OptionalSection>

              <div className="grid sm:grid-cols-2 gap-4">
                <div><label>Quantity ({qtyLabel})</label><input type="number" min="0.1" step="any" placeholder="0" value={numVal(form.qty)} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} required /></div>
                <div><label>Buying Price ({perLabel})</label><input type="number" min="0" placeholder="0" value={numVal(form.rate)} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} required /></div>
              </div>

              <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/50">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-[12px] font-medium text-neutral-600">Charges</p>
                  <span className="text-[11px] text-neutral-400">Optional — added to landed cost</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label>Loading Charges</label><input type="number" min="0" step="any" placeholder="0" value={numVal(form.loading)} onChange={(e) => setForm({ ...form, loading: Number(e.target.value) })} /></div>
                  <div><label>Transport Charges</label><input type="number" min="0" step="any" placeholder="0" value={numVal(form.transport)} onChange={(e) => setForm({ ...form, transport: Number(e.target.value) })} /></div>
                  <div><label>Labour Cost</label><input type="number" min="0" step="any" placeholder="0" value={numVal(form.labour)} onChange={(e) => setForm({ ...form, labour: Number(e.target.value) })} /></div>
                  <div><label>Other Expenses</label><input type="number" min="0" step="any" placeholder="0" value={numVal(form.otherCost)} onChange={(e) => setForm({ ...form, otherCost: Number(e.target.value) })} /></div>
                </div>
                {totalCharges > 0 && (
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-200 text-sm">
                    <span className="text-neutral-500">Total charges</span>
                    <span className="font-semibold tabular-nums">{fmtMoney(totalCharges)}</span>
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div><label>Your Selling Price ({perLabel})</label><input type="number" min="0" placeholder="0" value={numVal(form.sellRate)} onChange={(e) => setForm({ ...form, sellRate: Number(e.target.value) })} /></div>
                <div><label>Paid Now (to supplier)</label><input type="number" min="0" placeholder="0" value={numVal(form.paidNow)} onChange={(e) => setForm({ ...form, paidNow: Number(e.target.value) })} /></div>
              </div>
            </div>

            {/* right — summary (sticky on desktop) */}
            <div className="xl:sticky xl:top-0 space-y-3">
              <p className="text-[12px] font-medium text-neutral-500 uppercase tracking-wider">Summary</p>
              <div className="border border-neutral-200 rounded-lg p-4 space-y-3 bg-white">
                <div className="flex justify-between items-start gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="block text-neutral-500">Total amount</span>
                    <span className="block text-[12px] text-neutral-400 mt-0.5 tabular-nums">
                      {fmtQtyWithUnit(form.qty || 0, productUnit)} × {fmtMoney(form.rate)}{perLabel}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums shrink-0">{fmtMoney(totalStock)}</span>
                </div>
                <div className="flex justify-between items-start gap-3 text-sm border-t border-neutral-100 pt-3">
                  <div className="min-w-0">
                    <span className="block text-neutral-500">Landed cost {perLabel}</span>
                    <span className="block text-[12px] text-neutral-400 mt-0.5">buying + charges</span>
                  </div>
                  <span className="font-semibold tabular-nums shrink-0">{fmtMoney(landedPerUnit)}</span>
                </div>
                {form.sellRate > 0 && marginPerUnit > 0 && (
                  <div className="rounded-lg border border-[#cfe3cd] bg-[#f0f7ef] px-3.5 py-3 flex justify-between items-center gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-[#2e6b2e]">Expected profit {perLabel}</p>
                      <p className="text-[11px] text-[#4a7c48] mt-0.5">Selling above landed cost</p>
                    </div>
                    <span className="text-[15px] font-bold tabular-nums text-[#2e6b2e] shrink-0">{fmtMoney(marginPerUnit)}</span>
                  </div>
                )}
                {form.sellRate > 0 && marginPerUnit < 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 flex justify-between items-center gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-red-700">Loss per unit {perLabel}</p>
                      <p className="text-[11px] text-red-600/80 mt-0.5">Sell price is below landed cost</p>
                    </div>
                    <span className="text-[15px] font-bold tabular-nums text-red-700 shrink-0">{fmtMoney(marginPerUnit)}</span>
                  </div>
                )}
                {form.sellRate > 0 && marginPerUnit === 0 && (
                  <div className="flex justify-between items-start gap-3 text-sm border-t border-neutral-100 pt-3">
                    <span className="text-neutral-500">Expected profit {perLabel}</span>
                    <span className="font-semibold tabular-nums text-neutral-400 shrink-0">{fmtMoney(0)}</span>
                  </div>
                )}
                <div className={`flex justify-between items-center gap-3 text-sm px-3 py-3 -mx-1 rounded-lg mt-2 ${
                  Math.max(0, totalStock - Number(form.paidNow || 0)) === 0 && totalStock > 0
                    ? "bg-[#f0f7ef] border border-[#cfe3cd] text-[#2e6b2e]"
                    : "bg-[#171717] text-white"
                }`}>
                  <div>
                    <span className={`block text-[11px] uppercase tracking-wider ${Math.max(0, totalStock - Number(form.paidNow || 0)) === 0 && totalStock > 0 ? "text-[#4a7c48]" : "text-neutral-400"}`}>
                      {Math.max(0, totalStock - Number(form.paidNow || 0)) === 0 && totalStock > 0 ? "Fully paid" : "Due to supplier"}
                    </span>
                    <span className={`block text-[11px] mt-0.5 ${Math.max(0, totalStock - Number(form.paidNow || 0)) === 0 && totalStock > 0 ? "text-[#4a7c48]/80" : "text-neutral-500"}`}>
                      {Math.max(0, totalStock - Number(form.paidNow || 0)) === 0 && totalStock > 0 ? "Nothing owed to mill" : "after paid now"}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums">{fmtMoney(Math.max(0, totalStock - Number(form.paidNow || 0)))}</span>
                </div>
              </div>
              {!prefs.showOptionalDetails && (
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Tip: enable &quot;Show optional details&quot; on the Products page to open lot fields automatically.
                </p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ============ Purchase Details Modal ============ */}
      <Modal open={!!selected} onClose={() => setSelectedId(null)} title={selected ? `Purchase · ${selected.item}` : "Purchase Details"} size="3xl">
        {selected && (() => {
          const p = selected;
          const total = purchaseTotal(p);
          const costPerUnit = p.qty > 0 ? total / p.qty : 0;
          const transportShare = p.qty > 0 ? p.transport / p.qty : 0;
          const loadingShare = p.qty > 0 ? (p.loadingCharges ?? 0) / p.qty : 0;
          const labourShare = p.qty > 0 ? (p.labourCharges ?? 0) / p.qty : 0;
          const otherShare = p.qty > 0 ? p.otherCost / p.qty : 0;
          const usedSell = p.sellRate ?? 0;
          const perUnit = perUnitLabel(p.unit);
          const profitPerUnit = usedSell > 0 ? usedSell - costPerUnit : 0;
          const payable = steelAmount(p);
          const paid = p.paid ?? 0;
          const remaining = Math.max(0, payable - paid);
          const defs = defsOfPurchase(p);
          const catName = catNameOf(p);
          const detailRows: { label: string; value: string; strong?: boolean; tone?: "green" | "red" }[] = [
            { label: "Purchase Date", value: fmtDate(p.date) },
            { label: "Supplier", value: supplierName(p.supplierId) },
            { label: "Product", value: productNameOf(p) || "—" },
            ...(catName ? [{ label: "Category", value: catName }] : []),
            ...(p.attributeSnapshot
              ? defs.filter((d) => p.attributeSnapshot![d.key]).map((d) => ({ label: d.name, value: p.attributeSnapshot![d.key] }))
              : [
                  ...(p.spec ? [{ label: "Spec", value: p.spec }] : []),
                  { label: "Quality", value: p.quality || "—" },
                ]),
            ...(p.lotNumber || p.heatNumber || p.batchNumber
              ? [{ label: "Lot / Heat / Batch", value: [p.lotNumber, p.heatNumber, p.batchNumber].filter(Boolean).join(" / ") }]
              : []),
            ...(warehouseName(p.warehouseId)
              ? [{ label: "Warehouse", value: `${warehouseName(p.warehouseId)}${locationName(p.locationId) ? " / " + locationName(p.locationId) : ""}` }]
              : []),
            { label: "Quantity", value: fmtQtyWithUnit(p.qty, p.unit) },
            { label: "Buying Price" + perUnit, value: fmtMoney(p.rate) },
            { label: "+ Transport" + perUnit, value: p.transport > 0 ? fmtMoney(transportShare) : "—" },
            { label: "+ Loading" + perUnit, value: (p.loadingCharges ?? 0) > 0 ? fmtMoney(loadingShare) : "—" },
            { label: "+ Labour" + perUnit, value: (p.labourCharges ?? 0) > 0 ? fmtMoney(labourShare) : "—" },
            { label: "+ Other Expenses" + perUnit, value: p.otherCost > 0 ? fmtMoney(otherShare) : "—" },
            { label: "Landed Cost" + perUnit, value: fmtMoney(costPerUnit), strong: true },
            { label: "Transport (total)", value: fmtMoney(p.transport) },
            { label: "Loading (total)", value: fmtMoney(p.loadingCharges ?? 0) },
            { label: "Labour (total)", value: fmtMoney(p.labourCharges ?? 0) },
            { label: "Other Expenses (total)", value: fmtMoney(p.otherCost) },
            { label: "Total Payable to Mill", value: fmtMoney(payable), strong: true },
            { label: "Already Paid", value: fmtMoney(paid), tone: "green" },
            { label: "Remaining Due", value: fmtMoney(remaining), tone: remaining > 0 ? "red" : undefined },
            { label: "Your Selling Price", value: usedSell ? fmtRateWithUnit(usedSell, p.unit) : "—" },
            { label: "Profit" + perUnit, value: fmtMoney(profitPerUnit), strong: true },
          ];
          return (
            <div>
              {detailRows.map((r) => (
                <div key={r.label} className={`flex justify-between items-center gap-4 px-4 py-3 border-b border-neutral-200 last:border-b-0 ${r.strong ? "bg-black text-white" : ""}`}>
                  <span className={`text-xs uppercase tracking-widest font-medium ${r.strong ? "" : "text-black"}`}>{r.label}</span>
                  <span className={`tabular-nums text-right shrink-0 font-medium ${r.strong ? "" : r.tone === "green" ? "text-[#2e6b2e]" : r.tone === "red" ? "text-[#a12b1f]" : "text-black"}`}>{r.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center gap-4 mt-4">
                <p className="text-xs text-black leading-relaxed max-w-md">Landed cost = buying price + transport + other expenses, spread per unit. Profit = Your Selling Price − Landed Cost.</p>
                <div className="flex items-center gap-2 shrink-0">
                  {remaining > 0 && (
                    <button
                      onClick={() => { setSelectedId(null); openPay(p.id); }}
                      className="btn-primary !py-1.5 !px-4 text-xs"
                    >
                      Pay Due
                    </button>
                  )}
                  <button onClick={() => setDeleteTarget(p)} className="btn-ghost !py-1.5 !px-4 text-xs text-[#a12b1f] shadow-md hover:shadow-lg">Delete</button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Delete Purchase Confirm Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeletePurchase}
        title="Delete this purchase?"
        confirmLabel="Delete Purchase"
      >
        {deleteTarget && (() => {
          const p = deleteTarget;
          const due = remainingOf(p);
          const otherPurchases = purchases.some((x) => x.variantId === p.variantId && x.id !== p.id) ||
            (p.variantId ? false : purchases.some((x) => x.item === p.item && x.id !== p.id));
          const soldAny = sales.some((s) => s.lines.some((l) => (p.variantId ? l.variantId === p.variantId : l.item === p.item)));
          const soldFrom = sales.reduce(
            (a, s) => a + s.lines.filter((l) => l.purchaseId === p.id).reduce((x, l) => x + l.qty, 0),
            0
          );
          const vanishes = !otherPurchases && !soldAny;
          return (
            <>
              <div className="border border-neutral-200 mb-5">
                <div className="flex justify-between items-center gap-3 py-2.5 px-4 border-b border-neutral-200">
                  <span className="text-sm text-neutral-500 truncate">{p.item}</span>
                  <span className="font-medium text-sm tabular-nums shrink-0">{fmtQtyWithUnit(p.qty, p.unit)}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Supplier</span>
                  <span className="tabular-nums">{supplierName(p.supplierId)}</span>
                </div>
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Purchase date</span>
                  <span className="tabular-nums">{fmtDate(p.date)}</span>
                </div>
                {due > 0 && (
                  <div className="flex justify-between py-2 px-4 text-xs">
                    <span className="text-neutral-500">Unpaid to mill</span>
                    <span className="tabular-nums font-medium text-[#a12b1f]">{fmtMoney(due)}</span>
                  </div>
                )}
              </div>
              <div className="border border-red-200 bg-red-50 p-4">
                <p className="text-[11px] uppercase tracking-widest text-red-700 font-medium mb-2">Deleting changes your numbers</p>
                <ul className="text-xs text-neutral-700 space-y-1.5 list-disc pl-4">
                  <li>
                    <span className="font-medium text-neutral-900">Mill dues:</span>{" "}
                    {due > 0
                      ? `the unpaid ${fmtMoney(due)} to the mill is cleared, so the dues shown on your dashboard fall.`
                      : "this purchase was fully paid, so no due changes."}
                  </li>
                  <li>
                    <span className="font-medium text-neutral-900">Stock:</span>{" "}
                    the {fmtQtyWithUnit(p.qty, p.unit)} it added leaves inventory
                    {vanishes ? ` — nothing else references ${p.item}, so it disappears from the Inventory page` : ""}.
                  </li>
                  {soldFrom > 0 && (
                    <li>
                      <span className="font-medium text-neutral-900">Profit:</span>{" "}
                      {fmtQtyWithUnit(soldFrom, p.unit)} of it is already sold — those sales are re-costed from your other stock, so past profit figures shift.
                    </li>
                  )}
                  <li>
                    <span className="font-medium text-neutral-900">Records:</span> this purchase and its payment history are permanently removed.
                  </li>
                </ul>
                <p className="text-[11px] font-semibold text-red-700 mt-2.5">
                  Stock, mill dues, profit and reports all update across the app. This cannot be undone.
                </p>
              </div>
            </>
          );
        })()}
      </ConfirmModal>

      {/* Pay Due Modal */}
      <Modal open={!!payId} onClose={closePay} title="Pay Supplier" size="lg">
        {(() => {
          const p = purchases.find((x) => x.id === payId);
          if (!p) return null;
          const total = steelAmount(p);
          const paid = p.paid ?? 0;
          const rem = Math.max(0, total - paid);
          const history = p.paymentHistory ?? (paid > 0 ? [{ date: p.date + "T00:00:00", amount: paid }] : []);
          return (
            <form noValidate onSubmit={(e) => { e.preventDefault(); const amt = Number(payAmount) || 0; if (amt <= 0) { setPayError("Enter the amount you're paying to the mill."); return; } if (amt > rem + 0.001) { setPayError(`You can't pay more than the remaining due of ${fmtMoney(rem)} — ${fmtMoney(total)} is payable and ${fmtMoney(paid)} is already paid.`); return; } setPayError(""); const today = new Date().toISOString().slice(0, 10); updatePurchase(p.id, { paid: paid + amt, lastPaidAt: today, lastPaidAmount: amt, paymentHistory: [...(p.paymentHistory ?? []), { date: new Date().toISOString(), amount: amt }] }); addPayment({ date: today, type: "supplier", partyId: p.supplierId, amount: amt, method: "Cash", note: `Payment on ${p.item} purchase` }); closePay(); }}>
              <div className="mb-4">
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm"><span className="text-neutral-500">{p.item} · {supplierName(p.supplierId)}</span><span className="tabular-nums">{fmtDate(p.date)}</span></div>
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm"><span className="text-neutral-500">Total Payable to Mill</span><span className="tabular-nums">{fmtMoney(total)}</span></div>
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm"><span className="text-neutral-500">Already Paid</span><span className="tabular-nums">{fmtMoney(paid)}</span></div>
                <div className="flex justify-between py-2 border-b border-neutral-200 text-sm"><span className="text-neutral-500">Remaining Due</span><span className="tabular-nums">{fmtMoney(rem)}</span></div>
              </div>
              {history.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Payment History</p>
                  {[...history].reverse().map((h, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-dashed border-neutral-200 last:border-b-0 text-sm">
                      <span className="text-neutral-500 tabular-nums">{fmtDateTime(h.date)}</span>
                      <span className="tabular-nums font-medium">{fmtMoney(h.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <label>Amount to Pay</label>
              <input type="number" min="0" max={rem} placeholder="0" value={numVal(payAmount)} onChange={(e) => { setPayAmount(Number(e.target.value)); setPayError(""); }} required />
              {payError && (
                <div className="border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2 mt-3">{payError}</div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" className="btn-ghost" onClick={closePay}>Cancel</button>
                <button type="submit" className="btn-primary">Record Payment</button>
              </div>
            </form>
          );
        })()}
      </Modal>
    </Page>
  );
}
