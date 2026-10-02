"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useStore, purchaseTotal, steelAmount } from "@/lib/store";
import { BusyButton, Page, PageTitle, Modal, ConfirmModal, useToggle, EmptyState, RowActionsMenu, InlineFormError } from "@/components/ui";
import { userFacingError } from "@/lib/user-error";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { dateInIsoRange } from "@/lib/date-range-filter";
import { useUiPreferences } from "@/lib/preferences";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate, fmtDateTime, fmtDateWithRecordedTime, perUnitLabel } from "@/lib/format";
import { productUsesCategories, resolveDefs } from "@/lib/catalogue";
import NewPurchaseModal from "@/components/purchases/NewPurchaseModal";
import { usePurchaseDraft } from "@/components/purchases/usePurchaseDraft";
import {
  duePurchaseParentIds,
  purchaseParentId,
  purchaseTotals,
} from "@/lib/purchase-utils";
import type { AttributeDef, Purchase } from "@/lib/types";

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
  return (
    <RowActionsMenu
      items={[
        ...(onPay ? [{ label: "Pay", onClick: onPay }] : []),
        { label: "View details", onClick: onView },
        { label: "Delete", onClick: onDelete, danger: true },
      ]}
    />
  );
}

const emptyIconClass = "w-7 h-7";

function EmptyIconBox({ children }: { children: React.ReactNode }) {
  return (
    <svg className={emptyIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/* section wrapper for the add-purchase form */
function PurchaseFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold text-neutral-900">{title}</h3>
        {description ? (
          <p className="text-[12px] text-neutral-500 mt-1 leading-relaxed">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function PurchasesPage() {
  const {
    purchases,
    suppliers,
    products,
    categories,
    attributeDefs,
    warehouses,
    locations,
    sales,
    addPurchase,
    deletePurchase,
    addPayment,
    isPending,
  } = useStore();
  const activeSuppliers = suppliers.filter((supplier) => supplier.active !== false);
  const purchaseDraft = usePurchaseDraft();
  const { prefs } = useUiPreferences();
  const { open, onOpen, onClose } = useToggle();
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState(activeSuppliers[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "dues">("all");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "dues") {
      setTab("dues");
    }
  }, []);
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payError, setPayError] = useState("");
  const [formError, setFormError] = useState("");
  const [savingPurchase, setSavingPurchase] = useState(false);
  const savingPurchaseRef = useRef(false);
  const [savingPay, setSavingPay] = useState(false);
  const savingPayRef = useRef(false);
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);

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

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;
  const numVal = (v: number) => (v === 0 ? "" : v);
  const openPay = (id: string) => { setPayId(id); setPayAmount(0); setPayError(""); };
  const closePay = () => { setPayId(null); setPayError(""); };
  const totalsOf = (p: Purchase) => purchaseTotals(p, purchases);
  const remainingOf = (p: Purchase) => totalsOf(p).remaining;
  const dueParentIds = useMemo(() => duePurchaseParentIds(purchases), [purchases]);
  const duePurchases = useMemo(
    () =>
      purchases.filter((p) => dueParentIds.includes(purchaseParentId(p))),
    [purchases, dueParentIds],
  );
  const totalDue = useMemo(
    () =>
      dueParentIds.reduce((sum, pid) => {
        const row = purchases.find((p) => purchaseParentId(p) === pid);
        return row ? sum + purchaseTotals(row, purchases).remaining : sum;
      }, 0),
    [dueParentIds, purchases],
  );

  const closeAddModal = () => {
    onClose();
    purchaseDraft.resetForm();
    setFormError("");
  };

  const openAdd = () => {
    purchaseDraft.resetForm();
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setSupplierId(activeSuppliers[0]?.id ?? "");
    setFormError("");
    onOpen();
  };

  const submitNewPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPurchaseRef.current || !purchaseDraft.canSave || isPending("purchase:create")) return;
    savingPurchaseRef.current = true;
    setSavingPurchase(true);
    setFormError("");
    try {
      const result = await purchaseDraft.buildCreateInput(purchaseDate, supplierId);
      if ("error" in result) {
        setFormError(result.error);
        return;
      }
      const id = await addPurchase(result.doc);
      closeAddModal();
      setSelectedId(id);
    } catch (reason) {
      setFormError(userFacingError(reason, "Could not save this purchase."));
    } finally {
      savingPurchaseRef.current = false;
      setSavingPurchase(false);
    }
  };

  const confirmDeletePurchase = async () => {
    if (!deleteTarget) return;
    const p = deleteTarget;
    await deletePurchase(p.id);
    if (selectedId === p.id) setSelectedId(null);
    if (payId === p.id) setPayId(null);
    setDeleteTarget(null);
  };

  // Search + date-range filter (applies to All Purchases and Payment Dues)
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
  const matchesDate = (p: Purchase) => dateInIsoRange(p.date, dateRange);
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

  const selected =
    purchases.find((p) => p.id === selectedId) ??
    purchases.find((p) => purchaseParentId(p) === selectedId) ??
    null;

  const warehouseName = (id?: string) => warehouses.find((w) => w.id === id)?.name;
  const locationName = (id?: string) => locations.find((l) => l.id === id)?.name;

  return (
    <Page>
      <PageTitle
        title="Purchases"
        sub="Stock bought from suppliers, including delivery and other costs"
      />

      {/* filters + add */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search supplier, product, brand…"
          className="w-full min-w-0 sm:flex-1 sm:min-w-[200px] !py-2.5"
          aria-label="Search purchases"
        />
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
          placeholder="All dates"
          ariaLabel="Filter purchases by date range"
          className="w-full sm:w-auto"
        />
        <button type="button" className="btn-primary w-full sm:w-auto shrink-0 !py-2.5" onClick={openAdd}>
          + Add purchase
        </button>
      </div>

      <div className="flex gap-4 sm:gap-6 border-b border-neutral-200 mb-5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          ["all", "All Purchases"],
          ["dues", `Payment Dues${totalDue > 0 ? ` (${dueParentIds.length})` : ""}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`shrink-0 pb-2.5 px-0.5 text-xs uppercase tracking-widest border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === key ? "border-neutral-900 text-neutral-900 font-semibold" : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "all" && (
        purchases.length === 0 ? (
          <EmptyState
            emoji=""
            icon={
              <EmptyIconBox>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </EmptyIconBox>
            }
            title="No purchases yet"
            hint={activeSuppliers.length === 0 ? "Add a mill / supplier first, then record your first purchase." : "Record your first purchase — date, supplier, and rate is all you need."}
            action={<button type="button" className="btn-primary !py-2.5" onClick={openAdd}>Add purchase</button>}
          />
        ) : filteredPurchases.length === 0 ? (
          <EmptyState
            emoji=""
            icon={
              <EmptyIconBox>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </EmptyIconBox>
            }
            title="No purchases match"
            hint="Try a different search term or pick another date range."
          />
        ) : (
          <div className="space-y-8">
            {purchaseDateGroups.map((g) => (
              <div key={g.date}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-sm font-semibold text-neutral-900">{fmtDate(g.date)}</span>
                  <span className="text-[11px] text-black tabular-nums">
                    {g.rows.length} purchase{g.rows.length === 1 ? "" : "s"} · {fmtMoney(g.dayTotal)}
                  </span>
                  <div className="flex-1 border-b border-neutral-200" />
                </div>

                <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
                <div className="mb-3 hidden md:grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_100px_108px_108px_44px] gap-3 px-4 py-1 text-[10px] uppercase tracking-widest text-neutral-500 font-medium items-center">
                  <span>Supplier</span>
                  <span>Product</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Buy rate</span>
                  <span className="text-right">Sell rate</span>
                  <span className="sr-only">Actions</span>
                </div>

                <div className="hidden md:flex md:flex-col md:gap-3">
                  {g.rows.map((r) => (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedId(r.id);
                      }}
                      className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
                    >
                      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_100px_108px_108px_44px] gap-3 px-4 py-3.5 items-start">
                        <span className="block min-w-0">
                          <span className="block text-[13px] font-medium text-black truncate">
                            {supplierName(r.supplierId)}
                          </span>
                          <span className="block text-[11px] text-black tabular-nums mt-0.5">
                            Total {fmtMoney(steelAmount(r))}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <Identity
                            item={r.item}
                            productName={productNameOf(r)}
                            categoryName={catNameOf(r)}
                            snapshot={r.attributeSnapshot}
                            defs={defsOfPurchase(r)}
                            spec={r.spec}
                            quality={r.quality}
                          />
                        </span>
                        <span className="text-right text-[13px] tabular-nums text-black">
                          {fmtQtyWithUnit(r.qty, r.unit)}
                        </span>
                        <span className="text-right text-[13px] tabular-nums text-black">
                          {fmtRateWithUnit(r.rate, r.unit)}
                        </span>
                        <span className="text-right text-[13px] tabular-nums text-black">
                          {r.sellRate ? fmtRateWithUnit(r.sellRate, r.unit) : "—"}
                        </span>
                        <span className="flex justify-end pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <RowMenu onView={() => setSelectedId(r.id)} onDelete={() => setDeleteTarget(r)} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 md:hidden">
                  {g.rows.map((r) => (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(r.id)}
                      className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm active:bg-neutral-50"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-neutral-900 truncate">
                            {supplierName(r.supplierId)}
                          </p>
                          <p className="text-[11px] text-black tabular-nums mt-0.5">
                            Total {fmtMoney(steelAmount(r))}
                          </p>
                        </div>
                        <RowMenu onView={() => setSelectedId(r.id)} onDelete={() => setDeleteTarget(r)} />
                      </div>
                      <Identity
                        item={r.item}
                        productName={productNameOf(r)}
                        categoryName={catNameOf(r)}
                        snapshot={r.attributeSnapshot}
                        defs={defsOfPurchase(r)}
                        spec={r.spec}
                        quality={r.quality}
                      />
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] border-t border-neutral-100 pt-3">
                        <div>
                          <dt className="text-black uppercase tracking-wide text-[9px]">Qty</dt>
                          <dd className="font-medium tabular-nums text-neutral-900 mt-0.5">{fmtQtyWithUnit(r.qty, r.unit)}</dd>
                        </div>
                        <div>
                          <dt className="text-black uppercase tracking-wide text-[9px]">Buy</dt>
                          <dd className="font-medium tabular-nums text-neutral-900 mt-0.5">{fmtRateWithUnit(r.rate, r.unit)}</dd>
                        </div>
                        <div>
                          <dt className="text-black uppercase tracking-wide text-[9px]">Sell</dt>
                          <dd className="font-medium tabular-nums text-neutral-900 mt-0.5">
                            {r.sellRate ? fmtRateWithUnit(r.sellRate, r.unit) : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
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
              <EmptyState
                emoji=""
                compact
                icon={
                  <EmptyIconBox>
                    <path d="M20 6L9 17l-5-5" />
                  </EmptyIconBox>
                }
                title="No pending dues"
                hint="Every purchase is fully paid to the mill."
              />
            </div>
          ) : filteredDues.length === 0 ? (
            <EmptyState
              emoji=""
              icon={
                <EmptyIconBox>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </EmptyIconBox>
              }
              title="No dues match"
              hint="Try a different search term or pick another month / year."
            />
          ) : (
            <div className="space-y-8">
              {dueDateGroups.map((g) => (
                <div key={g.date}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-sm font-semibold text-neutral-900">{fmtDate(g.date)}</span>
                    <div className="flex-1 border-b border-neutral-200" />
                  </div>

                  <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
                  <div className="mb-3 hidden md:grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_100px_120px_44px] gap-3 px-4 py-1 text-[10px] uppercase tracking-widest text-neutral-500 font-medium items-center">
                    <span>Supplier</span>
                    <span>Product</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Due</span>
                    <span className="sr-only">Actions</span>
                  </div>

                  <div className="hidden md:flex md:flex-col md:gap-3">
                    {g.rows.map((r) => (
                      <div
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openPay(r.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") openPay(r.id);
                        }}
                        className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
                      >
                        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_100px_120px_44px] gap-3 px-4 py-3.5 items-start">
                          <span className="block min-w-0 text-[13px] font-medium text-black truncate">
                            {supplierName(r.supplierId)}
                          </span>
                          <span className="min-w-0">
                            <Identity
                              item={r.item}
                              productName={productNameOf(r)}
                              categoryName={catNameOf(r)}
                              snapshot={r.attributeSnapshot}
                              defs={defsOfPurchase(r)}
                              spec={r.spec}
                              quality={r.quality}
                            />
                          </span>
                          <span className="text-right text-[13px] tabular-nums text-black">
                            {fmtQtyWithUnit(r.qty, r.unit)}
                          </span>
                          <span className="text-right text-[15px] font-bold tabular-nums text-[#a12b1f]">
                            {fmtMoney(remainingOf(r))}
                          </span>
                          <span className="flex justify-end pt-0.5" onClick={(e) => e.stopPropagation()}>
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

                  <div className="flex flex-col gap-3 md:hidden">
                    {g.rows.map((r) => (
                      <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-neutral-900 truncate">
                              {supplierName(r.supplierId)}
                            </p>
                            <p className="text-[15px] font-bold text-[#a12b1f] tabular-nums mt-1">
                              Due {fmtMoney(remainingOf(r))}
                            </p>
                          </div>
                          <RowMenu
                            onPay={() => openPay(r.id)}
                            onView={() => setSelectedId(r.id)}
                            onDelete={() => setDeleteTarget(r)}
                          />
                        </div>
                        <Identity
                          item={r.item}
                          productName={productNameOf(r)}
                          categoryName={catNameOf(r)}
                          snapshot={r.attributeSnapshot}
                          defs={defsOfPurchase(r)}
                          spec={r.spec}
                          quality={r.quality}
                        />
                        <p className="mt-3 pt-3 border-t border-neutral-100 text-[11px] text-black tabular-nums">
                          Paid {fmtMoney(r.paid ?? 0)} of {fmtMoney(steelAmount(r))}
                          {r.lastPaidAt ? ` · Last ${fmtDate(r.lastPaidAt)}` : ""}
                        </p>
                        <button
                          type="button"
                          className="btn-primary w-full mt-3 !py-2.5 text-xs"
                          onClick={() => openPay(r.id)}
                        >
                          Pay supplier
                        </button>
                      </div>
                    ))}
                  </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <NewPurchaseModal
        open={open}
        onClose={closeAddModal}
        onSubmit={submitNewPurchase}
        purchaseDate={purchaseDate}
        setPurchaseDate={setPurchaseDate}
        supplierId={supplierId}
        setSupplierId={setSupplierId}
        suppliers={activeSuppliers}
        api={purchaseDraft}
        formError={formError || undefined}
        showOptionalDetails={prefs.showOptionalDetails}
        submitting={savingPurchase || isPending("purchase:create")}
      />

      {/* ============ Purchase Details Modal ============ */}
      <Modal
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected ? supplierName(selected.supplierId) : "Purchase details"}
        subtitle={
          selected
            ? `${fmtDateWithRecordedTime(selected.date, selected.createdAt)} · ${productNameOf(selected) || selected.item}`
            : undefined
        }
        size="3xl"
        footer={
          selected ? (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
              {(() => {
                const rem = Math.max(0, steelAmount(selected) - (selected.paid ?? 0));
                return rem > 0 ? (
                  <button
                    type="button"
                    className="btn-primary w-full sm:w-auto !py-2.5 text-sm"
                    onClick={() => {
                      setSelectedId(null);
                      openPay(selected.id);
                    }}
                  >
                    Pay due {fmtMoney(rem)}
                  </button>
                ) : null;
              })()}
              <button
                type="button"
                onClick={() => setDeleteTarget(selected)}
                className="btn-ghost w-full sm:w-auto !py-2.5 text-sm text-[#a12b1f]"
              >
                Delete purchase
              </button>
              <button
                type="button"
                className="btn-primary w-full sm:w-auto !py-2.5 text-sm"
                onClick={() => setSelectedId(null)}
              >
                Continue
              </button>
            </div>
          ) : undefined
        }
      >
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
          const detailRows: { label: string; value: string; emphasis?: boolean }[] = [
            { label: "Purchase date", value: fmtDateWithRecordedTime(p.date, p.createdAt) },
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
            { label: "Landed Cost" + perUnit, value: fmtMoney(costPerUnit), emphasis: true },
            { label: "Transport (total)", value: fmtMoney(p.transport) },
            { label: "Loading (total)", value: fmtMoney(p.loadingCharges ?? 0) },
            { label: "Labour (total)", value: fmtMoney(p.labourCharges ?? 0) },
            { label: "Other Expenses (total)", value: fmtMoney(p.otherCost) },
            { label: "Total Payable to Mill", value: fmtMoney(payable), emphasis: true },
            { label: "Already Paid", value: fmtMoney(paid) },
            { label: "Remaining Due", value: fmtMoney(remaining) },
            { label: "Your Selling Price", value: usedSell ? fmtRateWithUnit(usedSell, p.unit) : "—" },
            { label: "Profit" + perUnit, value: fmtMoney(profitPerUnit), emphasis: true },
          ];

          const renderDetailRow = (r: (typeof detailRows)[number]) => (
            <div
              key={r.label}
              className={`flex justify-between gap-4 px-4 py-3 border-b border-neutral-100 last:border-b-0 text-sm ${
                r.emphasis ? "border-t border-neutral-200 font-semibold" : ""
              }`}
            >
              <span className="text-black shrink-0">{r.label}</span>
              <span className="text-black text-right font-medium tabular-nums">{r.value}</span>
            </div>
          );

          return (
            <div className="space-y-5">
              <div className="rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wider text-black">
                  Identity
                </div>
                {detailRows.slice(0, detailRows.findIndex((r) => r.label === "Quantity")).map(renderDetailRow)}
              </div>
              <div className="rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wider text-black">
                  Costs & pricing
                </div>
                {detailRows
                  .slice(
                    detailRows.findIndex((r) => r.label === "Quantity"),
                    detailRows.findIndex((r) => r.label === "Total Payable to Mill"),
                  )
                  .map(renderDetailRow)}
              </div>
              <div className="rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wider text-black">
                  Payment & profit
                </div>
                {detailRows.slice(detailRows.findIndex((r) => r.label === "Total Payable to Mill")).map(renderDetailRow)}
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
        loading={deleteTarget ? isPending(`purchase:delete:${purchaseParentId(deleteTarget)}`) : false}
      >
        {deleteTarget && (() => {
          const p = deleteTarget;
          const due = remainingOf(p);
          const otherPurchases = purchases.some((x) => x.variantId === p.variantId && x.id !== p.id) ||
            (p.variantId ? false : purchases.some((x) => x.item === p.item && x.id !== p.id));
          const soldAny = sales.some((s) => s.lines.some((l) => (p.variantId ? l.variantId === p.variantId : l.item === p.item)));
          const soldFrom = sales.reduce(
            (a, s) => a + s.lines.filter((l) => l.purchaseId === purchaseParentId(p)).reduce((x, l) => x + l.qty, 0),
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
      <Modal
        open={!!payId}
        onClose={closePay}
        title="Pay supplier"
        subtitle={
          payId
            ? (() => {
                const p = purchases.find((x) => x.id === payId);
                return p ? `${supplierName(p.supplierId)} · ${fmtDate(p.date)}` : undefined;
              })()
            : undefined
        }
        size="lg"
        footer={
          payId ? (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 w-full">
              <button type="button" className="btn-ghost w-full sm:w-auto !py-2.5" onClick={closePay}>
                Cancel
              </button>
              <BusyButton
                type="submit"
                form="pay-supplier-form"
                loading={savingPay || isPending("payment:create")}
                className="w-full sm:w-auto !py-2.5"
              >
                Record payment
              </BusyButton>
            </div>
          ) : undefined
        }
      >
        {(() => {
          const p = purchases.find((x) => x.id === payId);
          if (!p) return null;
          const { goods: total, paid, remaining: rem } = totalsOf(p);
          const history = p.paymentHistory ?? [];
          return (
            <form
              id="pay-supplier-form"
              noValidate
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (savingPayRef.current || isPending("payment:create")) return;
                const amt = Number(payAmount) || 0;
                if (amt <= 0) {
                  setPayError("Enter the amount you are paying to the mill.");
                  return;
                }
                if (amt > rem + 0.001) {
                  setPayError(
                    `Amount cannot exceed the remaining due of ${fmtMoney(rem)} (${fmtMoney(total)} payable, ${fmtMoney(paid)} already paid).`,
                  );
                  return;
                }
                setPayError("");
                savingPayRef.current = true;
                setSavingPay(true);
                const today = new Date().toISOString().slice(0, 10);
                try {
                  await addPayment({
                    date: today,
                    type: "supplier",
                    partyId: p.supplierId,
                    purchaseId: purchaseParentId(p),
                    amount: amt,
                    method: "Cash",
                    note: `Payment on ${p.item} purchase`,
                  });
                  closePay();
                } catch (reason) {
                  setPayError(userFacingError(reason, "Could not record this payment."));
                } finally {
                  savingPayRef.current = false;
                  setSavingPay(false);
                }
              }}
            >
              <PurchaseFormSection title="Purchase" description="Amount owed on this stock line.">
                <div className="rounded-lg border border-neutral-100 bg-neutral-50/80 divide-y divide-neutral-100">
                  <div className="flex justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-neutral-500 shrink-0">Product</span>
                    <span className="text-neutral-900 font-medium text-right truncate">{productNameOf(p) || p.item}</span>
                  </div>
                  <div className="flex justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-neutral-500">Total payable to mill</span>
                    <span className="tabular-nums font-medium">{fmtMoney(total)}</span>
                  </div>
                  <div className="flex justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-neutral-500">Already paid</span>
                    <span className="tabular-nums font-medium text-[#2e6b2e]">{fmtMoney(paid)}</span>
                  </div>
                  <div className="flex justify-between gap-3 px-4 py-3 text-sm bg-white">
                    <span className="text-neutral-700 font-medium">Remaining due</span>
                    <span className="tabular-nums font-bold text-[#a12b1f]">{fmtMoney(rem)}</span>
                  </div>
                </div>
              </PurchaseFormSection>

              {history.length > 0 ? (
                <PurchaseFormSection title="Payment history" description="Previous payments recorded on this purchase.">
                  <div className="rounded-lg border border-neutral-100 overflow-hidden">
                    {[...history].reverse().map((h, i) => (
                      <div
                        key={i}
                        className="flex justify-between gap-3 px-4 py-3 border-b border-neutral-100 last:border-b-0 text-sm"
                      >
                        <span className="text-neutral-500 tabular-nums">{fmtDateTime(h.date)}</span>
                        <span className="tabular-nums font-medium">{fmtMoney(h.amount)}</span>
                      </div>
                    ))}
                  </div>
                </PurchaseFormSection>
              ) : null}

              <PurchaseFormSection title="This payment" description="Cash paid to the mill today is recorded against this purchase.">
                <div>
                  <div className="flex items-end justify-between gap-3 mb-2">
                    <label htmlFor="pay-supplier-amount" className="!mb-0">
                      Amount to pay
                    </label>
                    {rem > 0 ? (
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-black hover:text-neutral-900 underline-offset-2 hover:underline min-h-[44px] px-1 -my-2"
                        onClick={() => {
                          setPayAmount(rem);
                          setPayError("");
                        }}
                      >
                        Pay full {fmtMoney(rem)}
                      </button>
                    ) : null}
                  </div>
                  <input
                    id="pay-supplier-amount"
                    type="number"
                    min="0"
                    step="any"
                    max={rem}
                    inputMode="decimal"
                    placeholder="0"
                    value={numVal(payAmount)}
                    onChange={(e) => {
                      setPayAmount(Number(e.target.value));
                      setPayError("");
                    }}
                    required
                    className="!py-2.5 text-base sm:text-sm"
                  />
                </div>
                {payError ? (
                  <div role="alert" className="rounded-lg border border-[#f0d2cc] bg-[#fdf1ef] text-[#a12b1f] text-[13px] px-4 py-3">
                    {payError}
                  </div>
                ) : null}
              </PurchaseFormSection>
            </form>
          );
        })()}
      </Modal>
    </Page>
  );
}
