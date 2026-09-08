"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Product, ProductItem, Quality } from "@/lib/types";
import { Page, PageTitle, EmptyState, ConfirmModal } from "@/components/ui";

function AddForm({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex gap-2 mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAdd(value.trim());
        setValue("");
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      <button type="submit" className="btn-primary !py-2 !px-4 text-xs shrink-0">
        + Add
      </button>
    </form>
  );
}

/* add-product form with an extra Unit field (name + unit are both required) */
function ProductAddForm({ onAdd }: { onAdd: (name: string, unit: string) => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !unit.trim()) return;
        onAdd(name.trim(), unit.trim());
        setName("");
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New product name (e.g. Rebar)"
        className="flex-1"
      />
      <input
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        list="product-units"
        placeholder="Unit"
        className="!w-24 shrink-0"
      />
      <datalist id="product-units">
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <button type="submit" className="btn-primary !py-2 !px-4 text-xs shrink-0">
        + Add
      </button>
    </form>
  );
}

/* inline unit editor used on each product column header */
function UnitSelect({
  unit,
  onChange,
}: {
  unit: string;
  onChange: (unit: string) => void;
}) {
  return (
    <select
      value={unit}
      onChange={(e) => onChange(e.target.value)}
      title="Unit of measure"
      className="!w-20 !py-1 !px-1.5 text-[11px] shrink-0 border rounded !bg-transparent !border-neutral-300 text-neutral-500"
    >
      {UNIT_OPTIONS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}

const UNIT_OPTIONS = ["kg", "bag", "piece", "dozen", "box", "roll", "sack"];

/* what a product's secondary list means — "Quality" by default,
   "Factory / Mill" for Cement */
function specOf(p: { name: string; specLabel?: string }) {
  const label =
    p.specLabel ??
    (p.name.toLowerCase().includes("cement") ? "Factory / Mill" : "Quality");
  const plural =
    label === "Quality"
      ? "Qualities"
      : `${label.split("/")[0].trim().replace(/y$/i, "ies")}`;
  return { label, plural };
}

/* one small labelled delete button used on item / quality rows */
function MiniDelete({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Delete ${label}`}
      title={`Delete ${label}`}
      className="w-6 h-6 shrink-0 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm rounded"
    >
      ✕
    </button>
  );
}

/* one bordered list of name + delete rows (used for both items and qualities) */
function NameRows<T extends { id: string; name: string }>({
  rows,
  onDelete,
  empty,
}: {
  rows: T[];
  onDelete: (row: T) => void;
  empty: string;
}) {
  if (rows.length === 0)
    return <p className="text-xs text-neutral-400 py-1.5">{empty}</p>;
  return (
    <div className="border border-neutral-200 divide-y divide-neutral-100">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 py-2 pl-3 pr-1.5 text-sm">
          <span className="truncate">{r.name}</span>
          <MiniDelete onClick={() => onDelete(r)} label={r.name} />
        </div>
      ))}
    </div>
  );
}

export default function ProductsPage() {
  const {
    products,
    productItems,
    qualities,
    purchases,
    sales,
    addProduct,
    updateProduct,
    addProductItem,
    addQuality,
    deleteProduct,
    deleteProductItem,
    deleteQuality,
  } = useStore();

  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "product"; p: Product }
    | { kind: "item"; i: ProductItem }
    | { kind: "quality"; q: Quality }
    | null
  >(null);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "product") {
      deleteProduct(deleteTarget.p.id);
    } else if (deleteTarget.kind === "item") {
      deleteProductItem(deleteTarget.i.id);
    } else {
      deleteQuality(deleteTarget.q.id);
    }
    setDeleteTarget(null);
  };

  const delTitle = deleteTarget
    ? deleteTarget.kind === "product"
      ? `Delete product "${deleteTarget.p.name}"?`
      : deleteTarget.kind === "item"
        ? `Delete item "${deleteTarget.i.name}"?`
        : `Delete quality "${deleteTarget.q.name}"?`
    : "";
  const delLabel = deleteTarget
    ? deleteTarget.kind === "product"
      ? "Delete Product"
      : deleteTarget.kind === "item"
        ? "Delete Item"
        : "Delete Quality"
    : "Delete";

  return (
    <Page>
      <PageTitle
        title="Products"
        sub="Manage your catalogue — one column per product, its items and qualities beneath"
      />

      {/* add-product bar */}
      {products.length > 0 && (
        <div className="border border-neutral-200 bg-white p-4 mb-5 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="!mb-1">Add a product</label>
            <ProductAddForm onAdd={addProduct} />
          </div>
          <p className="text-xs text-neutral-400 sm:pb-2.5">
            Each product becomes a column — fill it with items and qualities.
          </p>
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          emoji="🧱"
          title="No products yet"
          hint="Add your first product below — Steel, Wire, Cement — then give it items and qualities."
          action={
            <div className="w-80 max-w-full">
              <ProductAddForm onAdd={addProduct} />
            </div>
          }
        />
      ) : (
        /* product columns: Steel | Wire | Cement — items and qualities as rows */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {products.map((p) => {
            const items = productItems.filter((i) => i.productId === p.id);
            const spec = specOf(p);
            const specIsCustom = spec.label !== "Quality";
            // custom products (Cement) carry factories as spec + grades as qualities
            const specs = specIsCustom ? qualities.filter((q) => q.productId === p.id && q.specOnly) : [];
            const quals = qualities.filter((q) => q.productId === p.id && !q.specOnly);
            const usedInPurchases = purchases.filter((x) => x.product === p.name).length;
            const countText = specIsCustom
              ? `${items.length} item${items.length === 1 ? "" : "s"} · ${specs.length} ${spec.plural.toLowerCase()} · ${quals.length} qualities`
              : `${items.length} item${items.length === 1 ? "" : "s"} · ${quals.length} ${spec.plural.toLowerCase()}`;
            return (
              <div key={p.id} className="border border-neutral-200 bg-white flex flex-col min-w-0">
                {/* column header */}
                <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{p.name}</span>
                    <UnitSelect
                      unit={p.unit || "kg"}
                      onChange={(u) => updateProduct(p.id, { unit: u })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <span className="text-[11px] text-neutral-400 tabular-nums">
                      {countText}
                    </span>
                    <button
                      onClick={() => setDeleteTarget({ kind: "product", p })}
                      aria-label={`Delete ${p.name}`}
                      title="Delete product"
                      className="w-7 h-7 -mr-1 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm rounded"
                    >
                      ✕
                    </button>
                  </div>
                  {usedInPurchases > 0 && (
                    <p className="text-[10px] text-neutral-400 mt-1">{usedInPurchases} purchase{usedInPurchases === 1 ? "" : "s"} use it</p>
                  )}
                </div>

                {/* items of this product */}
                <div className="px-4 pt-4">
                  <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
                    Items — {p.name}
                  </p>
                  <NameRows
                    rows={items}
                    onDelete={(i) => setDeleteTarget({ kind: "item", i })}
                    empty="No items yet."
                  />
                  <AddForm
                    placeholder="New item (e.g. 3 Sutar)"
                    onAdd={(name) => addProductItem(p.id, name)}
                  />
                </div>

                {/* custom products: factory list + quality list side by side */}
                {specIsCustom ? (
                  <div className="px-4 py-4 mt-4 border-t border-neutral-100 flex-1">
                    <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
                      {spec.plural} — {p.name}
                    </p>
                    <NameRows
                      rows={specs}
                      onDelete={(q) => setDeleteTarget({ kind: "quality", q })}
                      empty={`No ${spec.plural.toLowerCase()} yet.`}
                    />
                    <AddForm
                      placeholder={`New ${spec.label.toLowerCase()} (e.g. Lucky Cement)`}
                      onAdd={(name) => addQuality(p.id, name, true)}
                    />

                    <p className="text-[11px] uppercase tracking-widest text-neutral-500 mt-4 mb-2">
                      Qualities — {p.name}
                    </p>
                    <NameRows
                      rows={quals}
                      onDelete={(q) => setDeleteTarget({ kind: "quality", q })}
                      empty="No qualities yet."
                    />
                    <AddForm
                      placeholder="New quality (e.g. 53 OPC)"
                      onAdd={(name) => addQuality(p.id, name)}
                    />
                  </div>
                ) : (
                  <div className="px-4 py-4 mt-4 border-t border-neutral-100 flex-1">
                    <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
                      {spec.plural} — {p.name}
                    </p>
                    <NameRows
                      rows={quals}
                      onDelete={(q) => setDeleteTarget({ kind: "quality", q })}
                      empty={`No ${spec.plural.toLowerCase()} yet.`}
                    />
                    <AddForm
                      placeholder={
                        spec.label === "Quality"
                          ? "New quality (e.g. 60 Grade)"
                          : `New ${spec.label.toLowerCase()} (e.g. Lucky Cement)`
                      }
                      onAdd={(name) => addQuality(p.id, name)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirm Modal — one dialog shaped by what's being deleted */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={delTitle}
        confirmLabel={delLabel}
      >
        {deleteTarget && (() => {
          if (deleteTarget.kind === "product") {
            const t = deleteTarget.p;
            const spec = specOf(t);
            const specIsCustom = spec.label !== "Quality";
            const itemCount = productItems.filter((i) => i.productId === t.id).length;
            const specsCount = specIsCustom ? qualities.filter((q) => q.productId === t.id && q.specOnly).length : 0;
            const qualsCount = qualities.filter((q) => q.productId === t.id && !q.specOnly).length;
            const itemsOf = productItems.filter((i) => i.productId === t.id);
            const usedInPurchases = purchases.filter((x) => x.product === t.name).length;
            return (
              <>
                <div className="border border-neutral-200 mb-5">
                  <div className="flex justify-between items-center gap-3 py-2.5 px-4 border-b border-neutral-200">
                    <span className="text-sm font-medium truncate">{t.name}</span>
                    <span className="text-xs text-neutral-400 shrink-0 tabular-nums">{t.unit || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 px-4 text-xs">
                    <span className="text-neutral-500">Items / {specIsCustom ? "factories / qualities" : "qualities"}</span>
                    <span className="tabular-nums">
                      {itemCount} / {specIsCustom ? `${specsCount} / ${qualsCount}` : qualsCount}
                    </span>
                  </div>
                </div>
                <div className="border border-red-200 bg-red-50 p-4">
                  <p className="text-[11px] uppercase tracking-widest text-red-700 font-medium mb-2">
                    These will be deleted too
                  </p>
                  {itemsOf.length > 0 ? (
                    <ul className="text-xs text-neutral-700 space-y-1 list-disc pl-4 mb-2">
                      {itemsOf.map((i) => (
                        <li key={i.id}>{i.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-neutral-700 mb-2">No items live under it.</p>
                  )}
                  <p className="text-xs text-neutral-600">
                    {specIsCustom
                      ? specsCount + qualsCount > 0
                        ? `Plus ${specsCount} ${spec.plural.toLowerCase()} and ${qualsCount} qualities that belonged to ${t.name}.`
                        : `It has no ${spec.plural.toLowerCase()} or qualities of its own.`
                      : qualsCount > 0
                        ? `Plus ${qualsCount} ${spec.plural.toLowerCase()} that belonged to ${t.name}.`
                        : `It has no ${spec.plural.toLowerCase()} of its own.`}{" "}
                    {usedInPurchases > 0
                      ? `${usedInPurchases} existing purchase${usedInPurchases === 1 ? "" : "s"} keep their data, but nothing new can use this product.`
                      : "No purchases reference it."}
                  </p>
                </div>
              </>
            );
          }
          if (deleteTarget.kind === "item") {
            const t = deleteTarget.i;
            const usedInPurchases = purchases.filter((x) => x.item === t.name).length;
            const usedInSales = sales.filter((s) => s.lines.some((l) => l.item === t.name)).length;
            return (
              <>
                <div className="border border-neutral-200 mb-5">
                  <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                    <span className="text-neutral-500">Product</span>
                    <span className="tabular-nums">{products.find((x) => x.id === t.productId)?.name ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 px-4 text-xs">
                    <span className="text-neutral-500">Used in purchases / sales</span>
                    <span className="tabular-nums">{usedInPurchases} / {usedInSales}</span>
                  </div>
                </div>
                <div className="border border-red-200 bg-red-50 p-4">
                  <p className="text-[11px] uppercase tracking-widest text-red-700 font-medium mb-2">Before you delete</p>
                  <ul className="text-xs text-neutral-700 space-y-1.5 list-disc pl-4">
                    <li>The item is removed from the catalogue.</li>
                    {usedInPurchases + usedInSales > 0 && <li>Old purchases and sales keep their data — the item just will not be selectable anymore.</li>}
                  </ul>
                </div>
              </>
            );
          }
          const t = deleteTarget.q;
          const qSpec = specOf(products.find((x) => x.id === t.productId) ?? { name: "" });
          const qDesc = qSpec.label === "Quality" ? "quality grade" : qSpec.label.toLowerCase();
          const usedInPurchases = purchases.filter((x) => x.quality === t.name).length;
          return (
            <>
              <div className="border border-neutral-200 mb-5">
                <div className="flex justify-between py-2 px-4 border-b border-neutral-200 text-xs">
                  <span className="text-neutral-500">Belongs to</span>
                  <span className="tabular-nums">{products.find((x) => x.id === t.productId)?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between py-2 px-4 text-xs">
                  <span className="text-neutral-500">Used in purchases</span>
                  <span className="tabular-nums">{usedInPurchases}</span>
                </div>
              </div>
              <div className="border border-red-200 bg-red-50 p-4">
                <p className="text-[11px] uppercase tracking-widest text-red-700 font-medium mb-2">Before you delete</p>
                <ul className="text-xs text-neutral-700 space-y-1.5 list-disc pl-4">
                  <li>The {qDesc} is removed from this product.</li>
                  {usedInPurchases > 0 && <li>Old purchases keep their data — the {qDesc} just will not be selectable anymore.</li>}
                </ul>
              </div>
            </>
          );
        })()}
      </ConfirmModal>
    </Page>
  );
}
