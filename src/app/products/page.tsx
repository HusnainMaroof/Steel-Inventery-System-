"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import type { Product, ProductItem, Quality } from "@/lib/types";
import { Page, PageTitle, Stagger, StaggerItem, EmptyState } from "@/components/ui";

function AddForm({
  placeholder,
  onAdd,
  extra,
}: {
  placeholder: string;
  onAdd: (value: string) => void;
  extra?: React.ReactNode;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex gap-2 mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAdd(value.trim());
        setValue("");
      }}
    >
      {extra}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      <button type="submit" className="btn-primary !py-2 !px-4 text-xs">
        + Add
      </button>
    </form>
  );
}

function ListCard({
  title,
  sub,
  count,
  children,
}: {
  title: string;
  sub: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-200 bg-white p-5 h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-xs uppercase tracking-widest font-medium">{title}</h2>
          <p className="text-xs text-neutral-500 mt-1">{sub}</p>
        </div>
        <span className="text-xs text-neutral-400 tabular-nums">{count} total</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

const UNIT_OPTIONS = ["kg", "bag", "piece", "dozen", "box", "roll", "sack"];

/* add-product form with an extra Unit field (name + unit are both required) */
function ProductAddForm({
  onAdd,
}: {
  onAdd: (name: string, unit: string) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  return (
    <form
      className="flex gap-2 mt-4"
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
      <button type="submit" className="btn-primary !py-2 !px-4 text-xs">
        + Add
      </button>
    </form>
  );
}

/* inline unit editor used on each product row */
function UnitSelect({
  unit,
  onChange,
  dark = false,
}: {
  unit: string;
  onChange: (unit: string) => void;
  dark?: boolean;
}) {
  return (
    <select
      value={unit}
      onChange={(e) => onChange(e.target.value)}
      title="Unit of measure"
      className={`!w-20 !py-1 !px-1.5 text-[11px] shrink-0 ml-2 border rounded ${
        dark
          ? "!bg-black !text-white !border-neutral-600"
          : "!bg-transparent !border-neutral-300 text-neutral-500"
      }`}
    >
      {UNIT_OPTIONS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
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
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id ?? "");

  const removeProduct = (p: Product) => {
    const itemCount = productItems.filter((i) => i.productId === p.id).length;
    const usedInPurchases = purchases.filter((x) => x.product === p.name).length;
    if (
      window.confirm(
        `Delete product "${p.name}"?` +
          (itemCount > 0 ? `\n\nIts ${itemCount} item(s) will also be deleted.` : "") +
          (usedInPurchases > 0
            ? `\n\n${usedInPurchases} existing purchase(s) reference this product — they keep their data, but new purchases can no longer use it.`
            : "")
      )
    ) {
      deleteProduct(p.id);
      if (selectedProduct === p.id)
        setSelectedProduct(products.find((x) => x.id !== p.id)?.id ?? "");
    }
  };

  const removeItem = (item: ProductItem) => {
    const usedInPurchases = purchases.filter((x) => x.item === item.name).length;
    const usedInSales = sales.filter((s) =>
      s.lines.some((l) => l.item === item.name)
    ).length;
    if (
      window.confirm(
        `Delete item "${item.name}"?` +
          (usedInPurchases + usedInSales > 0
            ? `\n\nIt is used in ${usedInPurchases} purchase(s) and ${usedInSales} sale(s) — those records keep their data, but the item won't be selectable anymore.`
            : "")
      )
    ) {
      deleteProductItem(item.id);
    }
  };

  const removeQuality = (q: Quality) => {
    const usedInPurchases = purchases.filter((x) => x.quality === q.name).length;
    if (
      window.confirm(
        `Delete quality "${q.name}"?` +
          (usedInPurchases > 0
            ? `\n\n${usedInPurchases} existing purchase(s) use this quality — they keep their data, but it won't be selectable anymore.`
            : "")
      )
    ) {
      deleteQuality(q.id);
    }
  };

  return (
    <Page>
      <PageTitle
        title="Products"
        sub="Manage your products, their items and qualities — used when adding purchases and sales"
      />

      <Stagger className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Products */}
        <StaggerItem>
          <ListCard
            title="Products"
            sub="Main categories you trade in"
            count={products.length}
          >
            <div className="space-y-1">
              {products.length === 0 && (
                <EmptyState
                  emoji="🧱"
                  compact
                  title="No products yet"
                  hint="Type a product name below — Rebar, Cement, anything you trade."
                />
              )}
              {products.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center border transition-colors ${
                    selectedProduct === p.id
                      ? "border-black bg-black text-white"
                      : "border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  <button
                    onClick={() => setSelectedProduct(p.id)}
                    className={`flex-1 flex justify-between items-center px-3 py-2.5 text-sm text-left min-w-0 ${
                      selectedProduct === p.id ? "font-medium" : ""
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span
                      className={`text-xs tabular-nums shrink-0 ml-2 ${
                        selectedProduct === p.id ? "text-neutral-300" : "text-neutral-400"
                      }`}
                    >
                      {productItems.filter((i) => i.productId === p.id).length} items
                    </span>
                  </button>
                  <UnitSelect
                    unit={p.unit || "kg"}
                    onChange={(u) => updateProduct(p.id, { unit: u })}
                    dark={selectedProduct === p.id}
                  />
                  <button
                    onClick={() => removeProduct(p)}
                    aria-label={`Delete ${p.name}`}
                    title="Delete product"
                    className={`shrink-0 w-8 h-8 mr-1 flex items-center justify-center text-sm transition-colors ${
                      selectedProduct === p.id
                        ? "text-neutral-300 hover:text-white hover:bg-neutral-800"
                        : "text-neutral-400 hover:text-red-600 hover:bg-red-50"
                    }`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <ProductAddForm onAdd={addProduct} />
          </ListCard>
        </StaggerItem>

        {/* Product Items */}
        <StaggerItem>
          <ListCard
            title="Product Items"
            sub="Specific items under each product"
            count={productItems.length}
          >
            <div className="mb-3">
              <label className="!mb-1">Showing items for</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              {productItems
                .filter((i) => i.productId === selectedProduct)
                .map((i) => (
                  <motion.div
                    key={i.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-between items-center px-3 py-2.5 text-sm border border-neutral-200"
                  >
                    <span className="truncate">{i.name}</span>
                    <span className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-neutral-400">
                        {qualities.length} qualities
                      </span>
                      <button
                        onClick={() => removeItem(i)}
                        aria-label={`Delete ${i.name}`}
                        title="Delete item"
                        className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm"
                      >
                        ✕
                      </button>
                    </span>
                  </motion.div>
                ))}
              {productItems.filter((i) => i.productId === selectedProduct).length === 0 && (
                <EmptyState
                  emoji={selectedProduct ? "📦" : "👈"}
                  compact
                  title={selectedProduct ? "No items yet" : "No product picked yet"}
                  hint={
                    selectedProduct
                      ? "Give this product its first item below."
                      : "Add a product first — its items will live here."
                  }
                />
              )}
            </div>
            <AddForm
              placeholder="New item name (e.g. Rebar 20mm)"
              onAdd={(name) => selectedProduct && addProductItem(selectedProduct, name)}
            />
          </ListCard>
        </StaggerItem>

        {/* Qualities */}
        <StaggerItem>
          <ListCard
            title="Qualities"
            sub="Quality grades available for items"
            count={qualities.length}
          >
            <div className="space-y-1">
              {qualities.length === 0 && (
                <EmptyState
                  emoji="✨"
                  compact
                  title="No qualities yet"
                  hint="Grade A, Grade B — label the grades of your items below."
                />
              )}
              {qualities.map((q) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-between items-center px-3 py-2.5 text-sm border border-neutral-200"
                >
                  <span className="truncate">{q.name}</span>
                  <button
                    onClick={() => removeQuality(q)}
                    aria-label={`Delete ${q.name}`}
                    title="Delete quality"
                    className="shrink-0 w-6 h-6 ml-2 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm"
                  >
                    ✕
                  </button>
                </motion.div>
              ))}
            </div>
            <AddForm placeholder="New quality (e.g. Grade A)" onAdd={addQuality} />
          </ListCard>
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
