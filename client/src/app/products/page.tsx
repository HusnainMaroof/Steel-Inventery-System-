"use client";

import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { AttributeDef, AttributeOption, Product, ProductCategory, Variant } from "@/lib/types";
import { attrsValuesLine, scopedDefs } from "@/lib/catalogue";
import { PRODUCT_TEMPLATES, type ProductTemplate } from "@/lib/templates";
import { ConfirmModal, EmptyState, Modal, Page, PageTitle } from "@/components/ui";
import { useUiPreferences } from "@/lib/preferences";

const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "kg", label: "KG" },
  { value: "bag", label: "Bags" },
  { value: "liter", label: "Liters" },
  { value: "box", label: "Boxes" },
  { value: "piece", label: "Pieces" },
  { value: "meter", label: "Meters" },
  { value: "roll", label: "Rolls" },
  { value: "sack", label: "Sacks" },
  { value: "dozen", label: "Dozen" },
];

const unitLabel = (u: string) => UNIT_OPTIONS.find((x) => x.value === u)?.label ?? u.toUpperCase();

const TYPE_LABEL: Record<AttributeDef["type"], string> = {
  text: "Text",
  number: "Number",
  select: "Dropdown",
  boolean: "Yes / No",
  date: "Date",
  measurement: "Measurement",
};

const ATTR_TYPES: AttributeDef["type"][] = ["select", "text", "number", "measurement", "boolean", "date"];

type View =
  | { level: "products" }
  | { level: "product"; productId: string }
  | { level: "category"; productId: string; categoryId: string };

const I = {
  grip: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
    </svg>
  ),
  chev: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  chevUp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  off: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18.36 6.64a9 9 0 11-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  ),
  on: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18.36 6.64a9 9 0 11-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  dots: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  ),
};

function IconBtn({
  onClick,
  title,
  children,
  danger = false,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-md border border-transparent transition-colors ${
        danger
          ? "text-neutral-400 hover:text-[#a12b1f] hover:bg-[#faf5f2] hover:border-[#f0e2de]"
          : "text-neutral-400 hover:text-black hover:bg-neutral-50 hover:border-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${active ? "text-neutral-600" : "text-neutral-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-600" : "bg-neutral-300"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RowMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Actions"
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-md text-neutral-400 hover:text-black hover:bg-neutral-100"
      >
        {I.dots}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-30 w-40 bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
            {items.map((it, i) => (
              <button
                key={it.label}
                type="button"
                onClick={() => { setOpen(false); it.onClick(); }}
                className={`w-full text-left px-3.5 py-2 text-[13px] hover:bg-neutral-100 ${
                  it.danger ? "text-[#a12b1f]" : "text-black"
                } ${i > 0 ? "border-t border-neutral-100" : ""}`}
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

export default function ProductsPage() {
  const {
    products,
    categories,
    attributeDefs,
    attributeOptions,
    variants,
    warehouses,
    locations,
    purchases,
    sales,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    renameCategory,
    setCategoryActive,
    deleteCategory,
    addProductFromTemplate,
    addAttribute,
    patchAttribute,
    deleteAttribute,
    reorderAttributes,
    addOption,
    patchOption,
    deleteOption,
    reorderOptions,
    isOptionUsed,
    isAttributeUsed,
    addWarehouse,
    renameWarehouse,
    setWarehouseActive,
    addLocation,
    renameLocation,
    setLocationActive,
    setVariantShortName,
    setVariantActive,
    deleteVariant,
  } = useStore();

  const [view, setView] = useState<View>({ level: "products" });
  const [showInactive, setShowInactive] = useState(false);
  const [showWh, setShowWh] = useState(false);
  const [openLoc, setOpenLoc] = useState<string | null>(null);
  const [openWhAdd, setOpenWhAdd] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [attrModal, setAttrModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ kind: "product" | "category"; id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "product"; p: Product }
    | { kind: "category"; c: ProductCategory }
    | { kind: "variant"; v: Variant }
    | { kind: "attribute"; d: AttributeDef }
    | null
  >(null);
  const { prefs, setPref } = useUiPreferences();

  const activeProducts = products.filter((p) => p.active !== false);
  const inactiveProducts = products.filter((p) => p.active === false);

  const product =
    view.level === "product" || view.level === "category"
      ? products.find((p) => p.id === view.productId)
      : undefined;
  const category =
    view.level === "category" ? categories.find((c) => c.id === view.categoryId) : undefined;

  const catsOf = (pid: string) => categories.filter((c) => c.productId === pid);
  const defsOf = (productId: string, categoryId?: string) => scopedDefs(attributeDefs, productId, categoryId);
  const optionsOf = (did: string) =>
    attributeOptions.filter((o) => o.attributeDefId === did).sort((a, b) => a.sortOrder - b.sortOrder);
  const variantsOfCategory = (cid?: string) => variants.filter((v) => v.categoryId === cid);
  const variantsOfProduct = (pid: string) =>
    variants.filter((v) => v.productId === pid || catsOf(pid).some((c) => c.id === v.categoryId));

  const usedVariant = (id: string) =>
    purchases.some((p) => p.variantId === id) || sales.some((s) => s.lines.some((l) => l.variantId === id));
  const usedProduct = (id: string) => {
    const name = products.find((p) => p.id === id)?.name;
    return (
      (name && purchases.some((p) => p.product === name)) ||
      variantsOfProduct(id).some((v) => usedVariant(v.id))
    );
  };
  const usedCategory = (id: string) => variantsOfCategory(id).some((v) => usedVariant(v.id));

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "product") {
      deleteProduct(deleteTarget.p.id);
      setView({ level: "products" });
    } else if (deleteTarget.kind === "category") {
      deleteCategory(deleteTarget.c.id);
      setView({ level: "product", productId: deleteTarget.c.productId });
    } else if (deleteTarget.kind === "variant") {
      deleteVariant(deleteTarget.v.id);
    } else {
      deleteAttribute(deleteTarget.d.id);
    }
    setDeleteTarget(null);
  };

  const usesCats = product?.usesCategories === true;
  const attrScopeCategoryId = view.level === "category" ? view.categoryId : undefined;
  const configuringAttrs =
    view.level === "category" || (view.level === "product" && product && !usesCats);

  return (
    <Page>
      <PageTitle
        title="Products"
        sub="Configure the catalogue — purchases, sales and inventory follow it"
        action={
          view.level === "products" ? (
            <button type="button" className="btn-primary !py-2 !px-3.5 text-[13px]" onClick={() => setProductModal(true)}>
              Add Product
            </button>
          ) : view.level === "product" && usesCats ? (
            <button type="button" className="btn-primary !py-2 !px-3.5 text-[13px]" onClick={() => setItemModal(true)}>
              Add Category
            </button>
          ) : configuringAttrs ? (
            <button type="button" className="btn-primary !py-2 !px-3.5 text-[13px]" onClick={() => setAttrModal(true)}>
              Add Attribute
            </button>
          ) : null
        }
      />

      {view.level !== "products" && (
        <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-neutral-400 mb-5">
          <button type="button" onClick={() => setView({ level: "products" })} className="hover:text-black">
            Products
          </button>
          <span>/</span>
          {product && view.level === "product" && (
            <span className="text-neutral-800 font-medium">{product.name}</span>
          )}
          {product && view.level === "category" && (
            <>
              <button type="button" onClick={() => setView({ level: "product", productId: product.id })} className="hover:text-black">
                {product.name}
              </button>
              <span>/</span>
              <span className="text-neutral-800 font-medium">{category?.name}</span>
            </>
          )}
        </nav>
      )}

      {view.level === "products" && (
        <>
          <div className="panel px-4 py-3.5 mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-neutral-800">Purchase &amp; sale forms</p>
              <p className="text-[12px] text-neutral-400 mt-0.5 leading-snug">
                Optional fields — lot numbers, heat/batch, warehouse, and source lots in sales
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer !mb-0 !normal-case shrink-0">
              <span className="text-[13px] text-neutral-600">Show optional details</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.showOptionalDetails}
                onClick={() => setPref("showOptionalDetails", !prefs.showOptionalDetails)}
                className={`relative w-11 h-6 rounded-full transition-colors ${prefs.showOptionalDetails ? "bg-[#171717]" : "bg-neutral-200"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    prefs.showOptionalDetails ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </label>
          </div>

          {activeProducts.length === 0 ? (
            <EmptyState
              title="No products yet"
              hint="Add a product from scratch, or start from a template. The same engine then serves steel, cement, paint or anything else."
            />
          ) : (
            <div className="panel overflow-hidden mb-5">
              <div className="px-4 py-3 border-b border-neutral-100">
                <p className="text-[10px] uppercase tracking-widest text-neutral-400">Products</p>
              </div>
              <div className="divide-y divide-neutral-100">
                {activeProducts.map((p) => {
                  const nCats = catsOf(p.id).length;
                  const nAttrs = defsOf(p.id).filter((d) => d.active).length;
                  const structure = p.usesCategories
                    ? `${nCats} ${nCats === 1 ? "Category" : "Categories"}`
                    : `${nAttrs} ${nAttrs === 1 ? "Attribute" : "Attributes"}`;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setView({ level: "product", productId: p.id })}
                      className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-neutral-50 transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-neutral-900">{p.name}</span>
                        <span className="block text-[12px] text-neutral-400 mt-0.5">
                          {structure}
                          {p.description ? ` · ${p.description}` : ""}
                          {` · ${unitLabel(p.unit)}`}
                        </span>
                      </span>
                      <span className="text-neutral-300">{I.chev}</span>
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50">
                <button
                  type="button"
                  onClick={() => setProductModal(true)}
                  className="text-[13px] font-medium text-neutral-700 hover:text-black"
                >
                  + Add Product
                </button>
              </div>
            </div>
          )}

          {inactiveProducts.length > 0 && (
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setShowInactive((s) => !s)}
                className="text-[12px] text-neutral-400 hover:text-neutral-700 flex items-center gap-1.5"
              >
                <span className={`transition-transform ${showInactive ? "rotate-90" : ""}`}>▸</span>
                {inactiveProducts.length} inactive product{inactiveProducts.length === 1 ? "" : "s"}
              </button>
              {showInactive && (
                <div className="panel overflow-hidden mt-2 divide-y divide-neutral-100">
                  {inactiveProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setView({ level: "product", productId: p.id })}
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-[13px] text-neutral-400 hover:bg-neutral-50"
                    >
                      <span>{p.name}</span>
                      <StatusPill active={false} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {view.level === "product" && product && usesCats && (
        <ProductCategoriesView
          product={product}
          categories={catsOf(product.id)}
          defsOf={(cid) => defsOf(product.id, cid)}
          usedCategory={usedCategory}
          usedProduct={usedProduct(product.id)}
          onOpenCategory={(id) => setView({ level: "category", productId: product.id, categoryId: id })}
          onRenameProduct={() => setRenameTarget({ kind: "product", id: product.id, name: product.name })}
          onRenameCategory={(c) => setRenameTarget({ kind: "category", id: c.id, name: c.name })}
          onToggleProduct={() => updateProduct(product.id, { active: product.active === false })}
          onDeleteProduct={() => setDeleteTarget({ kind: "product", p: product })}
          onToggleCategory={(c) => setCategoryActive(c.id, !c.active)}
          onDeleteCategory={(c) => setDeleteTarget({ kind: "category", c })}
          onChangeUnit={(unit) => updateProduct(product.id, { unit })}
          onAddCategory={() => setItemModal(true)}
        />
      )}

      {view.level === "product" && product && !usesCats && (
        <>
          <ProductHeader
            product={product}
            usedProduct={usedProduct(product.id)}
            onRenameProduct={() => setRenameTarget({ kind: "product", id: product.id, name: product.name })}
            onToggleProduct={() => updateProduct(product.id, { active: product.active === false })}
            onDeleteProduct={() => setDeleteTarget({ kind: "product", p: product })}
            onChangeUnit={(unit) => updateProduct(product.id, { unit })}
          />
          <AttributesConfigureView
            heading={product.name}
            productName={product.name}
            hideHeading
            defs={defsOf(product.id)}
            optionsOf={optionsOf}
            variants={variantsOfProduct(product.id)}
            usedVariant={usedVariant}
            isOptionUsed={isOptionUsed}
            isAttributeUsed={isAttributeUsed}
            onAddAttribute={() => setAttrModal(true)}
            onReorder={(ids) => reorderAttributes(product.id, undefined, ids)}
            onToggleAttr={(d) => patchAttribute(d.id, { active: !d.active })}
            onDeleteAttr={(d) => {
              if (isAttributeUsed(d.id)) patchAttribute(d.id, { active: false });
              else setDeleteTarget({ kind: "attribute", d });
            }}
            onAddOption={(defId, label) => addOption(defId, label)}
            onPatchOption={(id, patch) => patchOption(id, patch)}
            onDeleteOption={(id) => {
              if (!deleteOption(id)) patchOption(id, { active: false });
            }}
            onReorderOptions={(defId, ids) => reorderOptions(defId, ids)}
            onRenameVariant={(v, n) => setVariantShortName(v.id, n)}
            onToggleVariant={(v) => setVariantActive(v.id, !v.active)}
            onDeleteVariant={(v) => setDeleteTarget({ kind: "variant", v })}
          />
        </>
      )}

      {view.level === "category" && product && category && (
        <AttributesConfigureView
          heading={category.name}
          productName={product.name}
          description={category.description}
          inactive={category.active === false}
          onRename={() => setRenameTarget({ kind: "category", id: category.id, name: category.name })}
          onToggle={() => setCategoryActive(category.id, !category.active)}
          defs={defsOf(product.id, category.id)}
          optionsOf={optionsOf}
          variants={variantsOfCategory(category.id)}
          usedVariant={usedVariant}
          isOptionUsed={isOptionUsed}
          isAttributeUsed={isAttributeUsed}
          onAddAttribute={() => setAttrModal(true)}
          onReorder={(ids) => reorderAttributes(product.id, category.id, ids)}
          onToggleAttr={(d) => patchAttribute(d.id, { active: !d.active })}
          onDeleteAttr={(d) => {
            if (isAttributeUsed(d.id)) patchAttribute(d.id, { active: false });
            else setDeleteTarget({ kind: "attribute", d });
          }}
          onAddOption={(defId, label) => addOption(defId, label)}
          onPatchOption={(id, patch) => patchOption(id, patch)}
          onDeleteOption={(id) => {
            if (!deleteOption(id)) patchOption(id, { active: false });
          }}
          onReorderOptions={(defId, ids) => reorderOptions(defId, ids)}
          onRenameVariant={(v, n) => setVariantShortName(v.id, n)}
          onToggleVariant={(v) => setVariantActive(v.id, !v.active)}
          onDeleteVariant={(v) => setDeleteTarget({ kind: "variant", v })}
        />
      )}

      {/* warehouses — control-center footer, not product-specific */}
      {view.level === "products" && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowWh((s) => !s)}
            className="w-full panel px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-neutral-50/80 transition-colors"
          >
            <div>
              <p className="text-[13px] font-semibold text-neutral-700">Warehouses & locations</p>
              <p className="text-[12px] text-neutral-400 mt-0.5">Optional — for lot traceability in Inventory</p>
            </div>
            <span className={`text-neutral-400 transition-transform ${showWh ? "rotate-180" : ""}`}>{I.chev}</span>
          </button>
          {showWh && (
            <WarehousePanel
              warehouses={warehouses}
              locations={locations}
              openLoc={openLoc}
              setOpenLoc={setOpenLoc}
              openWhAdd={openWhAdd}
              setOpenWhAdd={setOpenWhAdd}
              addWarehouse={addWarehouse}
              renameWarehouse={renameWarehouse}
              setWarehouseActive={setWarehouseActive}
              addLocation={addLocation}
              renameLocation={renameLocation}
              setLocationActive={setLocationActive}
            />
          )}
        </div>
      )}

      {productModal && (
        <AddProductModal
          existingNames={products.map((p) => p.name)}
          onClose={() => setProductModal(false)}
          onScratch={(name, unit, description, usesCategories) => {
            const id = addProduct(name, unit, description, usesCategories);
            setProductModal(false);
            if (id) setView({ level: "product", productId: id });
          }}
          onTemplate={(t) => {
            const existing = products.find((p) => p.name.toLowerCase() === t.product.name.toLowerCase());
            if (existing) {
              setProductModal(false);
              setView({ level: "product", productId: existing.id });
              return;
            }
            const id = addProductFromTemplate(t);
            setProductModal(false);
            if (id) setView({ level: "product", productId: id });
          }}
        />
      )}

      {itemModal && product && (
        <AddCategoryModal
          productName={product.name}
          onClose={() => setItemModal(false)}
          onAdd={(name, description, active) => {
            const id = addCategory(product.id, name, description);
            if (id && !active) setCategoryActive(id, false);
            setItemModal(false);
            if (id) setView({ level: "category", productId: product.id, categoryId: id });
          }}
        />
      )}

      {attrModal && product && configuringAttrs && (
        <AddAttributeModal
          scopeName={view.level === "category" ? (category?.name ?? product.name) : product.name}
          onClose={() => setAttrModal(false)}
          onAdd={(def) => {
            addAttribute(product.id, attrScopeCategoryId, def);
            setAttrModal(false);
          }}
        />
      )}

      {renameTarget && (
        <RenameModal
          title={renameTarget.kind === "product" ? "Rename product" : "Rename category"}
          value={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onSave={(n) => {
            if (renameTarget.kind === "product") updateProduct(renameTarget.id, { name: n });
            else renameCategory(renameTarget.id, n);
            setRenameTarget(null);
          }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={
          deleteTarget?.kind === "product"
            ? `Delete "${deleteTarget.p.name}"?`
            : deleteTarget?.kind === "category"
              ? `Delete "${deleteTarget.c.name}"?`
              : deleteTarget?.kind === "variant"
                ? `Delete variant "${deleteTarget.v.shortName}"?`
                : deleteTarget
                  ? `Delete attribute "${deleteTarget.d.name}"?`
                  : ""
        }
        confirmLabel="Delete"
      >
        {deleteTarget?.kind === "product" && (
          <p className="text-sm text-neutral-700 leading-relaxed">
            <span className="font-semibold">{deleteTarget.p.name}</span> and everything under it — categories, attributes, options and variants —
            are removed. Only offered when nothing in the ledger references it.
          </p>
        )}
        {deleteTarget?.kind === "category" && (
          <p className="text-sm text-neutral-700 leading-relaxed">
            Category <span className="font-semibold">{deleteTarget.c.name}</span> and its attributes, options and unused variants are removed.
            Historical purchases and sales are left untouched — so this is only offered when none reference it.
          </p>
        )}
        {deleteTarget?.kind === "variant" && (
          <p className="text-sm text-neutral-700 leading-relaxed">
            Variant <span className="font-semibold">{deleteTarget.v.shortName}</span> is unused, so it leaves the catalogue.
          </p>
        )}
        {deleteTarget?.kind === "attribute" && (
          <p className="text-sm text-neutral-700 leading-relaxed">
            Attribute <span className="font-semibold">{deleteTarget.d.name}</span> has never been used in stock, so it can be removed.
          </p>
        )}
      </ConfirmModal>
    </Page>
  );
}

function ProductHeader({
  product,
  usedProduct,
  onRenameProduct,
  onToggleProduct,
  onDeleteProduct,
  onChangeUnit,
}: {
  product: Product;
  usedProduct: boolean;
  onRenameProduct: () => void;
  onToggleProduct: () => void;
  onDeleteProduct: () => void;
  onChangeUnit: (u: string) => void;
}) {
  return (
    <div className="panel px-4 py-3 mb-5 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-semibold">{product.name}</p>
        <p className="text-[12px] text-neutral-400 mt-0.5">
          Base unit {unitLabel(product.unit)}
          {product.description ? ` · ${product.description}` : ""}
          {product.active === false && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-[#a12b1f]">Inactive</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <label className="!mb-0 flex items-center gap-2 !normal-case !text-[13px] text-neutral-600">
          <span className="text-neutral-400">Unit</span>
          <select
            value={product.unit}
            onChange={(e) => onChangeUnit(e.target.value)}
            className="!w-auto !py-1.5 !px-2 !text-[13px] min-w-[5rem]"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </label>
        <IconBtn onClick={onRenameProduct} title="Rename product">{I.edit}</IconBtn>
        {product.active === false ? (
          <button type="button" onClick={onToggleProduct} className="btn-ghost !py-1.5 !px-3 text-xs">Reactivate</button>
        ) : usedProduct ? (
          <button type="button" onClick={onToggleProduct} className="btn-ghost !py-1.5 !px-3 text-xs text-neutral-500">Deactivate</button>
        ) : (
          <button type="button" onClick={onDeleteProduct} className="btn-ghost !py-1.5 !px-3 text-xs text-[#a12b1f]">Delete</button>
        )}
      </div>
    </div>
  );
}

function ProductCategoriesView({
  product,
  categories,
  defsOf,
  usedCategory,
  usedProduct,
  onOpenCategory,
  onRenameProduct,
  onRenameCategory,
  onToggleProduct,
  onDeleteProduct,
  onToggleCategory,
  onDeleteCategory,
  onChangeUnit,
  onAddCategory,
}: {
  product: Product;
  categories: ProductCategory[];
  defsOf: (id: string) => AttributeDef[];
  usedCategory: (id: string) => boolean;
  usedProduct: boolean;
  onOpenCategory: (id: string) => void;
  onRenameProduct: () => void;
  onRenameCategory: (c: ProductCategory) => void;
  onToggleProduct: () => void;
  onDeleteProduct: () => void;
  onToggleCategory: (c: ProductCategory) => void;
  onDeleteCategory: (c: ProductCategory) => void;
  onChangeUnit: (u: string) => void;
  onAddCategory: () => void;
}) {
  return (
    <>
      <ProductHeader
        product={product}
        usedProduct={usedProduct}
        onRenameProduct={onRenameProduct}
        onToggleProduct={onToggleProduct}
        onDeleteProduct={onDeleteProduct}
        onChangeUnit={onChangeUnit}
      />

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-[13px] font-semibold">Categories</p>
          <span className="text-[11px] tabular-nums text-neutral-400 bg-neutral-50 border border-neutral-100 rounded px-1.5 py-0.5">
            {categories.length}
          </span>
        </div>
        {categories.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] text-neutral-400 mb-4">None yet — add whatever this product is split into.</p>
            <button type="button" onClick={onAddCategory} className="btn-primary !py-2 !px-4 text-[13px]">Add Category</button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {categories.map((c) => {
              const nDefs = defsOf(c.id).filter((d) => d.active).length;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${c.active ? "" : "opacity-55 bg-neutral-50/50"}`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenCategory(c.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block text-[14px] font-medium">{c.name}</span>
                    <span className="block text-[12px] text-neutral-400 mt-0.5">
                      {nDefs} {nDefs === 1 ? "Attribute" : "Attributes"}
                      {c.description ? ` · ${c.description}` : ""}
                    </span>
                  </button>
                  <StatusPill active={c.active} />
                  <RowMenu
                    items={[
                      { label: "Configure", onClick: () => onOpenCategory(c.id) },
                      { label: "Rename", onClick: () => onRenameCategory(c) },
                      { label: c.active ? "Deactivate" : "Reactivate", onClick: () => onToggleCategory(c) },
                      ...(usedCategory(c.id) ? [] : [{ label: "Delete", onClick: () => onDeleteCategory(c), danger: true }]),
                    ]}
                  />
                </div>
              );
            })}
          </div>
        )}
        {categories.length > 0 && (
          <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50">
            <button type="button" onClick={onAddCategory} className="text-[13px] font-medium text-neutral-700 hover:text-black">
              + Add Category
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function AttributesConfigureView({
  heading,
  productName,
  description,
  inactive,
  hideHeading,
  defs,
  optionsOf,
  variants,
  usedVariant,
  isOptionUsed,
  isAttributeUsed,
  onRename,
  onToggle,
  onAddAttribute,
  onReorder,
  onToggleAttr,
  onDeleteAttr,
  onAddOption,
  onPatchOption,
  onDeleteOption,
  onReorderOptions,
  onRenameVariant,
  onToggleVariant,
  onDeleteVariant,
}: {
  heading: string;
  productName: string;
  description?: string;
  inactive?: boolean;
  hideHeading?: boolean;
  defs: AttributeDef[];
  optionsOf: (id: string) => AttributeOption[];
  variants: Variant[];
  usedVariant: (id: string) => boolean;
  isOptionUsed: (id: string) => boolean;
  isAttributeUsed: (id: string) => boolean;
  onRename?: () => void;
  onToggle?: () => void;
  onAddAttribute: () => void;
  onReorder: (ids: string[]) => void;
  onToggleAttr: (d: AttributeDef) => void;
  onDeleteAttr: (d: AttributeDef) => void;
  onAddOption: (defId: string, label: string) => void;
  onPatchOption: (id: string, patch: Partial<AttributeOption>) => void;
  onDeleteOption: (id: string) => void;
  onReorderOptions: (defId: string, ids: string[]) => void;
  onRenameVariant: (v: Variant, n: string) => void;
  onToggleVariant: (v: Variant) => void;
  onDeleteVariant: (v: Variant) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  const onDrop = (overId: string) => {
    if (!dragId || dragId === overId) return;
    const ids = defs.map((d) => d.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    onReorder(ids);
    setDragId(null);
  };

  return (
    <>
      {!hideHeading && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-neutral-400">{productName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-[17px] font-semibold truncate">{heading}</h2>
              {inactive && (
                <span className="text-[10px] uppercase tracking-wider text-neutral-400">deactivated</span>
              )}
              {onRename && <IconBtn onClick={onRename} title="Rename category">{I.edit}</IconBtn>}
            </div>
            {description && <p className="text-[12px] text-neutral-400 mt-0.5">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onAddAttribute} className="btn-primary !py-2 !px-3.5 text-[13px]">
              Add Attribute
            </button>
            {onToggle && (inactive ? (
              <button type="button" onClick={onToggle} className="btn-ghost !py-2 !px-3.5 text-[13px]">Reactivate</button>
            ) : (
              <button type="button" onClick={onToggle} className="btn-ghost !py-2 !px-3.5 text-[13px] text-neutral-500">Deactivate</button>
            ))}
          </div>
        </div>
      )}

      <div className="panel overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-neutral-100">
          <p className="text-[13px] font-semibold">Attributes</p>
          <p className="text-[12px] text-neutral-400 mt-0.5">
            Drag to change the order on purchase, sale and invoice screens. Identity of stock does not change.
          </p>
        </div>
        {defs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] text-neutral-400 mb-4">No attributes yet — e.g. Size, Grade, Brand.</p>
            <button type="button" onClick={onAddAttribute} className="btn-primary !py-2 !px-4 text-[13px]">
              Add first attribute
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {defs.map((d) => (
              <div
                key={d.id}
                draggable
                onDragStart={() => setDragId(d.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(d.id)}
                onDragEnd={() => setDragId(null)}
                className={dragId === d.id ? "opacity-40" : ""}
              >
                <AttrCard
                  def={d}
                  options={optionsOf(d.id)}
                  used={isAttributeUsed(d.id)}
                  isOptionUsed={isOptionUsed}
                  onToggle={() => onToggleAttr(d)}
                  onDelete={() => onDeleteAttr(d)}
                  onAddOption={(label) => onAddOption(d.id, label)}
                  onPatchOption={onPatchOption}
                  onDeleteOption={onDeleteOption}
                  onReorderOptions={(ids) => onReorderOptions(d.id, ids)}
                />
              </div>
            ))}
          </div>
        )}
        {defs.length > 0 && (
          <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50">
            <button type="button" onClick={onAddAttribute} className="text-[13px] font-medium text-neutral-700 hover:text-black">
              + Add Attribute
            </button>
          </div>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100">
          <p className="text-[13px] font-semibold">Variants</p>
          <p className="text-[12px] text-neutral-400 mt-0.5">
            Created automatically when stock is bought or sold — not added here by hand.
          </p>
        </div>
        {variants.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] text-neutral-400 max-w-md mx-auto leading-relaxed">
              None yet. The first purchase of {heading} with these attributes creates one.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {variants.map((v) => (
              <VariantRow
                key={v.id}
                v={v}
                attrsLine={attrsValuesLine(defs, v.attributes)}
                used={usedVariant(v.id)}
                onRename={(n) => onRenameVariant(v, n)}
                onToggle={() => onToggleVariant(v)}
                onDelete={() => onDeleteVariant(v)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function AttrCard({
  def,
  options,
  used,
  isOptionUsed,
  onToggle,
  onDelete,
  onAddOption,
  onPatchOption,
  onDeleteOption,
  onReorderOptions,
}: {
  def: AttributeDef;
  options: AttributeOption[];
  used: boolean;
  isOptionUsed: (id: string) => boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAddOption: (label: string) => void;
  onPatchOption: (id: string, patch: Partial<AttributeOption>) => void;
  onDeleteOption: (id: string) => void;
  onReorderOptions: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(def.type === "select");
  const [editingOpt, setEditingOpt] = useState<string | null>(null);
  const [optDraft, setOptDraft] = useState("");
  const [newOpt, setNewOpt] = useState("");
  const [optDrag, setOptDrag] = useState<string | null>(null);
  const activeOptions = options.filter((o) => o.active);

  const dropOpt = (overId: string) => {
    if (!optDrag || optDrag === overId) return;
    const ids = options.map((o) => o.id);
    const from = ids.indexOf(optDrag);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, optDrag);
    onReorderOptions(ids);
    setOptDrag(null);
  };

  return (
    <div className={`px-4 py-3 ${def.active ? "" : "opacity-55 bg-neutral-50/50"}`}>
      <div className="flex items-start gap-3">
        <span
          className="mt-1 text-neutral-300 cursor-grab active:cursor-grabbing shrink-0"
          title="Drag to reorder"
          aria-hidden
        >
          {I.grip}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-[14px] font-medium leading-tight">
              {def.name}
              {def.required && <span className="text-[#a12b1f] ml-0.5">*</span>}
            </p>
            <span className="text-[10px] uppercase tracking-wider font-medium text-neutral-400 bg-neutral-50 border border-neutral-100 rounded px-1.5 py-0.5">
              {TYPE_LABEL[def.type]}
              {def.unit ? ` · ${def.unit}` : ""}
              {def.required ? " · Required" : ""}
            </span>
          </div>
          <p className="text-[12px] text-neutral-400 mt-1 leading-snug">
            {def.active
              ? def.type === "select"
                ? `${activeOptions.length} ${activeOptions.length === 1 ? "option" : "options"}`
                : TYPE_LABEL[def.type]
              : "Deactivated — hidden from buying & selling"}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {def.type === "select" && (
            <IconBtn onClick={() => setOpen((o) => !o)} title={open ? "Hide options" : "Show options"}>
              {open ? I.chevUp : I.chev}
            </IconBtn>
          )}
          <IconBtn onClick={onToggle} title={def.active ? "Deactivate" : "Reactivate"} danger={!def.active}>
            {def.active ? I.off : I.on}
          </IconBtn>
          {!used && (
            <IconBtn onClick={onDelete} title="Delete attribute" danger>{I.trash}</IconBtn>
          )}
        </div>
      </div>

      {open && def.type === "select" && (
        <div className="mt-3 pt-3 border-t border-neutral-100 ml-7">
          {options.map((o) => (
            <div
              key={o.id}
              draggable
              onDragStart={() => setOptDrag(o.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOpt(o.id)}
              className={`flex items-center gap-2 py-1.5 ${o.active ? "" : "opacity-50"} ${optDrag === o.id ? "opacity-40" : ""}`}
            >
              <span className="text-neutral-300 cursor-grab shrink-0">{I.grip}</span>
              {editingOpt === o.id ? (
                <form
                  className="flex-1 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (optDraft.trim()) onPatchOption(o.id, { label: optDraft.trim() });
                    setEditingOpt(null);
                  }}
                >
                  <input
                    value={optDraft}
                    onChange={(e) => setOptDraft(e.target.value)}
                    className="!py-1 text-[13px] flex-1"
                    autoFocus
                  />
                  <button type="submit" className="btn-primary !py-1 !px-2.5 text-xs">Save</button>
                </form>
              ) : (
                <>
                  <span className={`flex-1 text-[13px] ${o.active ? "text-neutral-800" : "line-through text-neutral-400"}`}>
                    {o.label}
                  </span>
                  <StatusPill active={o.active} />
                  <button
                    type="button"
                    className="text-[12px] text-neutral-400 hover:text-black px-1.5 py-1"
                    onClick={() => { setEditingOpt(o.id); setOptDraft(o.label); }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="text-[12px] text-neutral-400 hover:text-black px-1.5 py-1"
                    onClick={() => onPatchOption(o.id, { active: !o.active })}
                  >
                    {o.active ? "Deactivate" : "Reactivate"}
                  </button>
                  {!isOptionUsed(o.id) && (
                    <button
                      type="button"
                      className="text-[12px] text-neutral-400 hover:text-[#a12b1f] px-1.5 py-1"
                      onClick={() => onDeleteOption(o.id)}
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          <form
            className="flex items-center gap-2 mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newOpt.trim()) return;
              onAddOption(newOpt.trim());
              setNewOpt("");
            }}
          >
            <input
              value={newOpt}
              onChange={(e) => setNewOpt(e.target.value)}
              placeholder="New option"
              className="!py-1.5 text-[13px] flex-1"
            />
            <button type="submit" className="btn-primary !py-1.5 !px-3 text-xs shrink-0">Add Option</button>
          </form>
        </div>
      )}
    </div>
  );
}

function VariantRow({
  v,
  attrsLine,
  used,
  onRename,
  onToggle,
  onDelete,
}: {
  v: Variant;
  attrsLine: string;
  used: boolean;
  onRename: (n: string) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v.shortName);
  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${v.active ? "" : "opacity-55 bg-neutral-50/50"}`}>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex items-center gap-2 max-w-sm"
            onSubmit={(e) => { e.preventDefault(); onRename(draft); setEditing(false); }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} className="!py-1.5 text-[13px] flex-1" />
            <button type="submit" className="btn-primary !py-1.5 !px-3 text-xs">Save</button>
          </form>
        ) : (
          <>
            <p className="text-[14px] font-medium leading-tight">{v.shortName}</p>
            {attrsLine && <p className="text-[12px] text-neutral-400 mt-0.5 leading-snug">{attrsLine}</p>}
            {used && <p className="text-[11px] text-neutral-300 mt-1">Used in purchases or sales</p>}
          </>
        )}
      </div>
      {!editing && (
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn onClick={() => { setDraft(v.shortName); setEditing(true); }} title="Rename">{I.edit}</IconBtn>
          <IconBtn onClick={onToggle} title={v.active ? "Deactivate" : "Reactivate"} danger={!v.active}>
            {v.active ? I.off : I.on}
          </IconBtn>
          {!used && <IconBtn onClick={onDelete} title="Delete (unused)" danger>{I.trash}</IconBtn>}
        </div>
      )}
    </div>
  );
}

function AddProductModal({
  existingNames,
  onClose,
  onScratch,
  onTemplate,
}: {
  existingNames: string[];
  onClose: () => void;
  onScratch: (name: string, unit: string, description: string | undefined, usesCategories: boolean) => void;
  onTemplate: (t: ProductTemplate) => void;
}) {
  const [mode, setMode] = useState<"scratch" | "template">("scratch");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [description, setDescription] = useState("");
  const [usesCategories, setUsesCategories] = useState(false);
  const [tplId, setTplId] = useState(PRODUCT_TEMPLATES[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const taken = (n: string) => existingNames.some((x) => x.toLowerCase() === n.trim().toLowerCase());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "template") {
      const t = PRODUCT_TEMPLATES.find((x) => x.id === tplId);
      if (!t) return setError("Pick a template.");
      if (taken(t.product.name)) return setError(`${t.product.name} already exists — open it from the list instead.`);
      onTemplate(t);
      return;
    }
    if (!name.trim()) return setError("Give the product a name.");
    if (taken(name)) return setError("A product with that name already exists.");
    onScratch(name.trim(), unit, description.trim() || undefined, usesCategories);
  };

  return (
    <Modal open onClose={onClose} title="Create Product">
      {error && (
        <div role="alert" className="text-[13px] font-medium text-[#a12b1f] bg-[#faf5f2] border border-[#f0e2de] rounded-md px-3.5 py-2.5 mb-5">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {(["scratch", "template"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className={`px-3 py-2.5 rounded-lg border text-[13px] font-medium ${
                mode === m ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {m === "scratch" ? "Start from scratch" : "Use template"}
            </button>
          ))}
        </div>

        {mode === "scratch" ? (
          <>
            <div>
              <label htmlFor="prod-name">Product Name</label>
              <input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cement" autoFocus />
            </div>
            <div>
              <label htmlFor="prod-unit">Base Unit</label>
              <select id="prod-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[13px] font-medium text-neutral-800 mb-2">Product Structure</p>
              <div className="space-y-2">
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer !normal-case !mb-0 ${
                  !usesCategories ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
                }`}>
                  <input
                    type="radio"
                    name="structure"
                    checked={!usesCategories}
                    onChange={() => setUsesCategories(false)}
                    className="!w-4 !h-4 mt-0.5"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-neutral-900">Product → Attributes</span>
                    <span className="block text-[12px] text-neutral-400 mt-0.5">No category. Attributes belong to the product — e.g. Steel.</span>
                  </span>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer !normal-case !mb-0 ${
                  usesCategories ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
                }`}>
                  <input
                    type="radio"
                    name="structure"
                    checked={usesCategories}
                    onChange={() => setUsesCategories(true)}
                    className="!w-4 !h-4 mt-0.5"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-neutral-900">Product → Categories → Attributes</span>
                    <span className="block text-[12px] text-neutral-400 mt-0.5">Each category can have its own attributes — e.g. Cement.</span>
                  </span>
                </label>
              </div>
            </div>
            <div>
              <label htmlFor="prod-desc">Description</label>
              <input id="prod-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {PRODUCT_TEMPLATES.map((t) => (
              <label
                key={t.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer !normal-case !mb-0 ${
                  tplId === t.id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  checked={tplId === t.id}
                  onChange={() => setTplId(t.id)}
                  className="!w-4 !h-4 mt-0.5"
                />
                <span>
                  <span className="block text-[13px] font-medium text-neutral-900">{t.label}</span>
                  <span className="block text-[12px] text-neutral-400 mt-0.5">
                    {t.product.name} · {unitLabel(t.product.unit)} ·{" "}
                    {t.usesCategories
                      ? `${t.categories?.length ?? 0} ${(t.categories?.length ?? 0) === 1 ? "category" : "categories"}`
                      : `${t.attributes?.length ?? 0} ${(t.attributes?.length ?? 0) === 1 ? "attribute" : "attributes"}`}
                  </span>
                </span>
              </label>
            ))}
            <p className="text-[12px] text-neutral-400 leading-relaxed">
              A template is only a shortcut. Everything it creates stays editable.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">{mode === "scratch" ? "Continue" : "Save Product"}</button>
        </div>
      </form>
    </Modal>
  );
}

function AddCategoryModal({
  productName,
  onClose,
  onAdd,
}: {
  productName: string;
  onClose: () => void;
  onAdd: (name: string, description: string | undefined, active: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open onClose={onClose} title={`Add Category — ${productName}`}>
      {error && (
        <div role="alert" className="text-[13px] font-medium text-[#a12b1f] bg-[#faf5f2] border border-[#f0e2de] rounded-md px-3.5 py-2.5 mb-5">
          {error}
        </div>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setError("Give the category a name.");
          onAdd(name.trim(), description.trim() || undefined, active);
        }}
      >
        <div>
          <label htmlFor="cat-name">Category Name</label>
          <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Grey Cement" autoFocus />
        </div>
        <div>
          <label htmlFor="cat-desc">Description</label>
          <input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer !normal-case !text-[13px] text-neutral-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="!w-4 !h-4" />
          Active
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function AddAttributeModal({
  scopeName,
  onClose,
  onAdd,
}: {
  scopeName: string;
  onClose: () => void;
  onAdd: (def: { name: string; type: AttributeDef["type"]; required: boolean; unit?: string; options?: string[] }) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AttributeDef["type"]>("select");
  const [required, setRequired] = useState(true);
  const [unit, setUnit] = useState("");
  const [options, setOptions] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const opts = options.map((s) => s.trim()).filter(Boolean);
    if (!name.trim()) return setError("Give the attribute a name.");
    if (type === "select" && opts.length === 0) return setError("A dropdown needs at least one option.");
    onAdd({ name: name.trim(), type, required, unit: unit.trim() || undefined, options: type === "select" ? opts : undefined });
  };

  return (
    <Modal open onClose={onClose} title={`Add Attribute — ${scopeName}`}>
      {error && (
        <div role="alert" className="text-[13px] font-medium text-[#a12b1f] bg-[#faf5f2] border border-[#f0e2de] rounded-md px-3.5 py-2.5 mb-5">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="attr-name">Name</label>
          <input id="attr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Quality" autoFocus />
        </div>
        <div>
          <label htmlFor="attr-type">Input Type</label>
          <select id="attr-type" value={type} onChange={(e) => setType(e.target.value as AttributeDef["type"])}>
            {ATTR_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        {(type === "number" || type === "measurement") && (
          <div>
            <label htmlFor="attr-unit">Unit {type === "measurement" ? "(e.g. ft)" : "(optional)"}</label>
            <input id="attr-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={type === "measurement" ? "ft" : "e.g. mm"} />
          </div>
        )}
        {type === "select" && (
          <div>
            <label>Options</label>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={o}
                    onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={i === 0 ? "40 Grade" : "Add option"}
                    className="flex-1"
                  />
                  {options.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost !px-2.5 text-neutral-400"
                      onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-[13px] font-medium text-neutral-600 hover:text-black"
                onClick={() => setOptions((prev) => [...prev, ""])}
              >
                + Add Option
              </button>
            </div>
          </div>
        )}
        <label className="flex items-center gap-2.5 cursor-pointer !normal-case !text-[13px] text-neutral-700">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="!w-4 !h-4" />
          Required
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save Attribute</button>
        </div>
      </form>
    </Modal>
  );
}

function RenameModal({
  title,
  value,
  onClose,
  onSave,
}: {
  title: string;
  value: string;
  onClose: () => void;
  onSave: (n: string) => void;
}) {
  const [name, setName] = useState(value);
  return (
    <Modal open onClose={onClose} title={title}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function WarehousePanel({
  warehouses,
  locations,
  openLoc,
  setOpenLoc,
  openWhAdd,
  setOpenWhAdd,
  addWarehouse,
  renameWarehouse,
  setWarehouseActive,
  addLocation,
  renameLocation,
  setLocationActive,
}: {
  warehouses: { id: string; name: string; active: boolean }[];
  locations: { id: string; warehouseId: string; name: string; active: boolean }[];
  openLoc: string | null;
  setOpenLoc: (id: string | null) => void;
  openWhAdd: boolean;
  setOpenWhAdd: (v: boolean) => void;
  addWarehouse: (n: string) => void;
  renameWarehouse: (id: string, n: string) => void;
  setWarehouseActive: (id: string, a: boolean) => void;
  addLocation: (wid: string, n: string) => void;
  renameLocation: (id: string, n: string) => void;
  setLocationActive: (id: string, a: boolean) => void;
}) {
  return (
    <div className="panel mt-2 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 flex flex-wrap items-start justify-between gap-3">
        <p className="text-[12px] text-neutral-500 leading-relaxed max-w-2xl">
          A <span className="font-medium text-neutral-700">warehouse</span> is where you store goods.
          A <span className="font-medium text-neutral-700">location</span> is a spot inside it.
          Pick one when recording a purchase — it shows on that lot in Inventory.
        </p>
        {warehouses.length > 0 && !openWhAdd && (
          <button
            type="button"
            onClick={() => setOpenWhAdd(true)}
            className="shrink-0 text-[12px] font-medium text-neutral-600 hover:text-black px-2.5 py-1.5 rounded-md border border-neutral-200 hover:border-neutral-300 bg-white"
          >
            + Warehouse
          </button>
        )}
      </div>
      {warehouses.length === 0 ? (
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <p className="text-[13px] text-neutral-400">No warehouses yet</p>
          <form
            className="w-full max-w-sm flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = (e.currentTarget.elements.namedItem("wh") as HTMLInputElement).value.trim();
              if (v) addWarehouse(v);
              e.currentTarget.reset();
            }}
          >
            <input name="wh" placeholder="e.g. Main Yard" className="flex-1 !py-1.5 text-[13px]" />
            <button type="submit" className="btn-primary !py-1.5 !px-3 text-xs">Add warehouse</button>
          </form>
        </div>
      ) : (
        <>
          {openWhAdd && (
            <form
              className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = (e.currentTarget.elements.namedItem("wh") as HTMLInputElement).value.trim();
                if (v) addWarehouse(v);
                setOpenWhAdd(false);
              }}
            >
              <input name="wh" placeholder="New warehouse name" className="flex-1 !py-1.5 text-[13px]" autoFocus />
              <button type="submit" className="btn-primary !py-1.5 !px-3 text-xs">Add</button>
            </form>
          )}
          <div className="divide-y divide-neutral-100">
            {warehouses.map((w) => {
              const wLocs = locations.filter((l) => l.warehouseId === w.id);
              return (
                <div key={w.id} className={`px-4 py-4 ${w.active ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={w.name}
                      aria-label={`Rename ${w.name}`}
                      onBlur={(e) => e.target.value.trim() && e.target.value !== w.name && renameWarehouse(w.id, e.target.value.trim())}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="flex-1 !p-0 !border-none !bg-transparent !shadow-none !text-[14px] !font-semibold"
                    />
                    <IconBtn onClick={() => setWarehouseActive(w.id, !w.active)} title={w.active ? "Deactivate warehouse" : "Reactivate warehouse"} danger>
                      {w.active ? I.off : I.on}
                    </IconBtn>
                    {openLoc !== w.id && (
                      <button
                        type="button"
                        onClick={() => setOpenLoc(w.id)}
                        className="shrink-0 text-[12px] font-medium text-neutral-500 hover:text-black px-2.5 py-1.5 rounded-md border border-neutral-200 bg-white"
                      >
                        + Location
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {wLocs.filter((l) => l.active).map((l) => (
                      <span key={l.id} className="inline-flex items-center gap-1 border border-neutral-200 rounded-md px-2.5 py-1 text-[12px] bg-white">
                        <input
                          defaultValue={l.name}
                          onBlur={(e) => e.target.value.trim() && e.target.value !== l.name && renameLocation(l.id, e.target.value.trim())}
                          className="!p-0 !border-none !bg-transparent !shadow-none !text-[12px] !w-24"
                        />
                        <button type="button" onClick={() => setLocationActive(l.id, false)} className="text-neutral-300 hover:text-[#a12b1f] w-5 h-5">×</button>
                      </span>
                    ))}
                    {wLocs.filter((l) => !l.active).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLocationActive(l.id, true)}
                        className="text-[12px] text-neutral-300 line-through hover:text-neutral-600 border border-dashed border-neutral-200 rounded-md px-2.5 py-1"
                      >
                        {l.name}
                      </button>
                    ))}
                    {openLoc === w.id && (
                      <form
                        className="flex gap-2 w-56"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const v = (e.currentTarget.elements.namedItem("loc") as HTMLInputElement).value.trim();
                          if (v) addLocation(w.id, v);
                          setOpenLoc(null);
                        }}
                      >
                        <input name="loc" placeholder="e.g. Yard A" className="flex-1 !py-1 text-[12px]" autoFocus />
                        <button type="submit" className="btn-primary !py-1 !px-2 text-xs">Add</button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
