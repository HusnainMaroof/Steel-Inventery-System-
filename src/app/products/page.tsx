"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { AttributeDef, Product, Variant } from "@/lib/types";
import { attrsValuesLine } from "@/lib/catalogue";
import { ConfirmModal, EmptyState, Modal, Page, PageTitle } from "@/components/ui";
import { useUiPreferences } from "@/lib/preferences";

const UNIT_OPTIONS = ["kg", "bag", "piece", "dozen", "box", "roll", "sack", "liter", "meter"];

const TYPE_LABEL: Record<AttributeDef["type"], string> = {
  text: "Text",
  number: "Number",
  select: "Dropdown",
  boolean: "Yes / No",
  date: "Date",
  measurement: "Measurement",
};

const TYPE_HINT: Record<AttributeDef["type"], string> = {
  text: "Free text typed when buying or selling.",
  number: "A plain number, typed when buying or selling.",
  select: "",
  boolean: "Yes or No, picked when buying or selling.",
  date: "A date value.",
  measurement: "A number with a unit beside it.",
};

/* ---------- shared micro-components ---------- */

function IconBtn({
  onClick,
  title,
  children,
  danger = false,
  active = false,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-md border transition-colors ${
        active
          ? "border-neutral-300 bg-neutral-100 text-black"
          : danger
            ? "border-transparent text-neutral-400 hover:text-[#a12b1f] hover:bg-[#faf5f2] hover:border-[#f0e2de]"
            : "border-transparent text-neutral-400 hover:text-black hover:bg-neutral-50 hover:border-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

function SectionHead({
  title,
  hint,
  count,
  action,
}: {
  title: string;
  hint?: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-neutral-800">{title}</p>
          {count !== undefined && (
            <span className="text-[11px] tabular-nums font-medium text-neutral-400 bg-neutral-50 border border-neutral-100 rounded px-1.5 py-0.5">
              {count}
            </span>
          )}
        </div>
        {hint && <p className="text-[12px] text-neutral-400 mt-0.5 leading-snug">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

function AddRow({
  placeholder,
  onAdd,
  button = "Add",
  className = "",
  compact = false,
}: {
  placeholder: string;
  onAdd: (v: string) => void;
  button?: string;
  className?: string;
  compact?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className={`flex items-center gap-2 ${className}`}
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
        className={compact ? "!py-1.5 text-[13px] flex-1" : "!py-2 text-[13px] flex-1"}
      />
      <button
        type="submit"
        className={`btn-primary shrink-0 whitespace-nowrap ${compact ? "!py-1.5 !px-3 text-xs" : "!py-2 !px-3.5 text-[13px]"}`}
      >
        {button}
      </button>
    </form>
  );
}

/* svg icons — 14×14, stroke-based */
const I = {
  up: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
  down: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
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
  x: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
};

function AttrRow({
  def,
  options,
  onMove,
  onToggle,
  onAddOption,
  onPatchOption,
}: {
  def: AttributeDef;
  options: { id: string; label: string; active: boolean }[];
  onMove: (dir: -1 | 1) => void;
  onToggle: () => void;
  onAddOption: (label: string) => void;
  onPatchOption: (id: string, active: boolean) => void;
}) {
  const [open, setOpen] = useState(def.type === "select");
  const activeOptions = options.filter((o) => o.active);

  return (
    <div className={`px-4 py-3 ${def.active ? "" : "opacity-55 bg-neutral-50/50"}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-[14px] font-medium leading-tight">
              {def.name}
              {def.required && <span className="text-[#a12b1f] ml-0.5">*</span>}
            </p>
            <span className="text-[10px] uppercase tracking-wider font-medium text-neutral-400 bg-neutral-50 border border-neutral-100 rounded px-1.5 py-0.5">
              {TYPE_LABEL[def.type]}
              {def.unit ? ` · ${def.unit}` : ""}
            </span>
          </div>
          <p className="text-[12px] text-neutral-400 mt-1 leading-snug">
            {def.active ? (
              def.type === "select"
                ? activeOptions.length > 0
                  ? activeOptions.map((o) => o.label).join(" · ")
                  : "No options yet — expand to add"
                : TYPE_HINT[def.type]
            ) : (
              "Deactivated — hidden from buying & selling"
            )}
          </p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {def.active && (
            <>
              <IconBtn onClick={() => onMove(-1)} title="Move up">{I.up}</IconBtn>
              <IconBtn onClick={() => onMove(1)} title="Move down">{I.down}</IconBtn>
              <IconBtn
                onClick={() => setOpen((o) => !o)}
                title={def.type === "select" ? (open ? "Hide options" : "Show options") : "About this type"}
                active={open}
              >
                {def.type === "select" ? (open ? I.chevUp : I.chev) : I.info}
              </IconBtn>
            </>
          )}
          <IconBtn onClick={onToggle} title={def.active ? "Deactivate" : "Reactivate"} danger={!def.active}>
            {def.active ? I.off : I.on}
          </IconBtn>
        </div>
      </div>

      {open && def.type === "select" && (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          {options.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {options.map((o) => (
                <span
                  key={o.id}
                  className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-md text-[12px] border ${
                    o.active
                      ? "bg-white border-neutral-200 text-neutral-700"
                      : "bg-neutral-50 border-neutral-100 text-neutral-300 line-through"
                  }`}
                >
                  {o.label}
                  <button
                    type="button"
                    onClick={() => onPatchOption(o.id, !o.active)}
                    title={o.active ? "Hide option" : "Show option"}
                    aria-label={`Toggle ${o.label}`}
                    className="w-5 h-5 flex items-center justify-center rounded text-neutral-300 hover:text-[#a12b1f] hover:bg-[#faf5f2]"
                  >
                    {I.x}
                  </button>
                </span>
              ))}
            </div>
          )}
          <AddRow placeholder="New option (e.g. 60 Grade)" onAdd={onAddOption} button="Add option" compact />
        </div>
      )}

      {open && def.type !== "select" && (
        <p className="mt-3 pt-3 border-t border-neutral-100 text-[12px] text-neutral-500 leading-relaxed">
          {def.type === "measurement"
            ? `Measured in ${def.unit || "the product unit"} when buying or selling.`
            : TYPE_HINT[def.type]}
        </p>
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

  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${v.active ? "" : "opacity-55 bg-neutral-50/50"}`}>
      <div className="min-w-0 flex-1">
        {editing ? (
          <AddRow
            placeholder={v.shortName}
            onAdd={(n) => { onRename(n); setEditing(false); }}
            button="Save"
            className="max-w-sm"
            compact
          />
        ) : (
          <>
            <p className="text-[14px] font-medium leading-tight">{v.shortName}</p>
            {attrsLine && <p className="text-[12px] text-neutral-400 mt-0.5 leading-snug">{attrsLine}</p>}
            {used && (
              <p className="text-[11px] text-neutral-300 mt-1">Used in purchases or sales</p>
            )}
          </>
        )}
      </div>

      {!editing && (
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn onClick={() => setEditing(true)} title="Rename">{I.edit}</IconBtn>
          <IconBtn onClick={onToggle} title={v.active ? "Deactivate" : "Reactivate"} danger={!v.active}>
            {v.active ? I.off : I.on}
          </IconBtn>
          {!used && (
            <IconBtn onClick={onDelete} title="Delete (unused)" danger>{I.trash}</IconBtn>
          )}
        </div>
      )}
    </div>
  );
}

function RenameField({
  value,
  onSave,
  compact = false,
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <input
      key={value}
      defaultValue={value}
      aria-label={`Rename ${value}`}
      onBlur={(e) => e.target.value.trim() && e.target.value !== value && onSave(e.target.value.trim())}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`${compact ? "!p-0 !border-none !bg-transparent !font-medium !shadow-none" : "!py-1.5 text-sm font-medium"} !text-[13px] ${className}`}
    />
  );
}

/* ---------- main page ---------- */

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
    addAttribute,
    patchAttribute,
    addOption,
    patchOption,
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

  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [renaming, setRenaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [openLoc, setOpenLoc] = useState<string | null>(null);
  const [openWh, setOpenWh] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "product"; p: Product } | { kind: "variant"; v: Variant } | null>(null);
  const [attrModal, setAttrModal] = useState(false);
  const { prefs, setPref } = useUiPreferences();

  const activeProducts = products.filter((p) => p.active !== false);
  const inactiveProducts = products.filter((p) => p.active === false);
  const product = products.find((p) => p.id === productId) ?? activeProducts[0];
  const category = categories.find((c) => c.id === categoryId);

  // keep selection in sync when data loads or product list changes
  useEffect(() => {
    if (products.length === 0) return;
    if (!productId || !products.some((p) => p.id === productId)) {
      const first = products.find((p) => p.active !== false) ?? products[0];
      if (first) setProductId(first.id);
    }
  }, [products, productId]);

  useEffect(() => {
    if (!product) return;
    const cats = categories.filter((c) => c.productId === product.id);
    if (cats.length === 0) {
      setCategoryId(undefined);
      return;
    }
    if (!categoryId || !cats.some((c) => c.id === categoryId)) {
      setCategoryId(cats[0].id);
    }
  }, [product?.id, categories, categoryId, product]);

  const catsOf = (pid: string) => categories.filter((c) => c.productId === pid);
  const defsOf = (cid?: string) => attributeDefs.filter((d) => d.categoryId === cid).sort((a, b) => a.sortOrder - b.sortOrder);
  const optionsOf = (did: string) => attributeOptions.filter((o) => o.attributeDefId === did).sort((a, b) => a.sortOrder - b.sortOrder);
  const variantsOf = (cid?: string) => variants.filter((v) => v.categoryId === cid);

  const usedVariant = (id: string) =>
    purchases.some((p) => p.variantId === id) || sales.some((s) => s.lines.some((l) => l.variantId === id));
  const usedProduct = (id: string) => {
    const name = products.find((p) => p.id === id)?.name;
    return (
      (name && purchases.some((p) => p.product === name)) ||
      catsOf(id).some((c) => variantsOf(c.id).some((v) => usedVariant(v.id)))
    );
  };

  const selectProduct = (id: string) => {
    setProductId(id);
    setRenaming(false);
    const cats = categories.filter((c) => c.productId === id);
    setCategoryId(cats[0]?.id);
  };

  const moveDef = (def: AttributeDef, dir: -1 | 1) => {
    const siblings = defsOf(def.categoryId).filter((d) => d.active);
    const i = siblings.findIndex((d) => d.id === def.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= siblings.length) return;
    patchAttribute(siblings[i].id, { sortOrder: siblings[j].sortOrder });
    patchAttribute(siblings[j].id, { sortOrder: siblings[i].sortOrder });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "product") {
      deleteProduct(deleteTarget.p.id);
      setProductId(undefined);
      setCategoryId(undefined);
    } else {
      deleteVariant(deleteTarget.v.id);
    }
    setDeleteTarget(null);
  };

  const catDefs = category ? defsOf(category.id) : [];
  const catVariants = category ? variantsOf(category.id) : [];

  return (
    <Page>
      <PageTitle title="Products" sub="Configure once — buying & selling then follow the flow" />

      {/* transaction form preferences */}
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

      {/* product picker */}
      <div className="panel p-4 mb-5">
        <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Your products</p>
        <div className="flex flex-wrap items-center gap-2">
          {activeProducts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProduct(p.id)}
              className={`px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all ${
                product?.id === p.id
                  ? "bg-[#171717] text-white shadow-sm"
                  : "bg-neutral-50 border border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:bg-white"
              }`}
            >
              {p.name}
            </button>
          ))}
          <div className="flex-1 min-w-[200px] max-w-sm">
            <AddRow
              placeholder="New product name…"
              onAdd={(n) => {
                const id = addProduct(n, "kg");
                if (id) selectProduct(id);
              }}
              button="Add"
              compact
            />
          </div>
        </div>
        {inactiveProducts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setShowInactive((s) => !s)}
              className="text-[12px] text-neutral-400 hover:text-neutral-700 flex items-center gap-1.5"
            >
              <span className={`transition-transform ${showInactive ? "rotate-90" : ""}`}>▸</span>
              {inactiveProducts.length} inactive product{inactiveProducts.length === 1 ? "" : "s"}
            </button>
            {showInactive && (
              <div className="flex flex-wrap gap-2 mt-2">
                {inactiveProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProduct(p.id)}
                    className={`px-3 py-1.5 text-[12px] rounded-lg border ${
                      product?.id === p.id
                        ? "border-neutral-400 bg-neutral-100 text-neutral-700"
                        : "border-neutral-200 text-neutral-400 hover:border-neutral-300"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!product ? (
        <EmptyState emoji="🧱" title="No products yet" hint="Add your first product above — the same engine then serves steel, cement, paint or anything else." />
      ) : (
        <>
          {/* product toolbar */}
          <div className="panel px-4 py-3 mb-5 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{product.name}</p>
              <p className="text-[12px] text-neutral-400 mt-0.5">
                {category ? category.name : "No category selected"}
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
                  onChange={(e) => updateProduct(product.id, { unit: e.target.value })}
                  className="!w-auto !py-1.5 !px-2 !text-[13px] min-w-[5rem]"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </label>
              {product.active === false ? (
                <button type="button" onClick={() => updateProduct(product.id, { active: true })} className="btn-ghost !py-1.5 !px-3 text-xs">
                  Reactivate
                </button>
              ) : usedProduct(product.id) ? (
                <button type="button" onClick={() => updateProduct(product.id, { active: false })} className="btn-ghost !py-1.5 !px-3 text-xs text-neutral-500">
                  Deactivate
                </button>
              ) : (
                <button type="button" onClick={() => setDeleteTarget({ kind: "product", p: product })} className="btn-ghost !py-1.5 !px-3 text-xs text-[#a12b1f]">
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
            {/* categories rail — sticky while right column scrolls */}
            <div className="panel overflow-hidden lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-6rem)] flex flex-col w-full">
              <SectionHead title="Categories" count={catsOf(product.id).length} />
              {catsOf(product.id).length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[13px] text-neutral-400 mb-4">None yet — add Rebar, Sheets, Grey Cement…</p>
                  <AddRow
                    placeholder="Category name"
                    onAdd={(n) => {
                      const id = addCategory(product.id, n);
                      if (id) setCategoryId(id);
                    }}
                    button="Add category"
                    compact
                  />
                </div>
              ) : (
                <>
                  <div className="divide-y divide-neutral-100 flex-1 min-h-0 overflow-y-auto">
                    {catsOf(product.id).map((c) => {
                      const active = category?.id === c.id;
                      const nDefs = defsOf(c.id).filter((d) => d.active).length;
                      const nVar = variantsOf(c.id).length;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setCategoryId(c.id); setRenaming(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            active
                              ? "bg-[#171717] text-white"
                              : "hover:bg-neutral-50"
                          } ${c.active === false && !active ? "opacity-45" : ""}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-medium truncate">{c.name}</span>
                            <span className={`block text-[11px] tabular-nums mt-0.5 ${active ? "text-neutral-400" : "text-neutral-400"}`}>
                              {nDefs} attribute{nDefs === 1 ? "" : "s"} · {nVar} variant{nVar === 1 ? "" : "s"}
                            </span>
                          </span>
                          {c.active === false && (
                            <span className="text-[9px] uppercase tracking-wider shrink-0 text-neutral-400">off</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50">
                    <AddRow
                      placeholder="New category…"
                      onAdd={(n) => {
                        const id = addCategory(product.id, n);
                        if (id) setCategoryId(id);
                      }}
                      button="Add"
                      compact
                    />
                  </div>
                </>
              )}
            </div>

            {/* stage — scrolls independently; warehouses live here too */}
            <div className="min-w-0 space-y-5 lg:min-h-[50vh]">
              {!category ? (
                <div className="panel px-6 py-12 text-center">
                  <p className="text-[14px] font-medium text-neutral-600">Choose a category</p>
                  <p className="text-[13px] text-neutral-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Pick one on the left — or add one — to shape its attributes and variants.
                  </p>
                </div>
              ) : (
                <>
                  {/* category header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {renaming ? (
                      <AddRow
                        placeholder={category.name}
                        onAdd={(n) => { renameCategory(category.id, n); setRenaming(false); }}
                        button="Save name"
                        className="max-w-xs"
                        compact
                      />
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-[17px] font-semibold truncate">{category.name}</h2>
                        {category.active === false && (
                          <span className="text-[10px] uppercase tracking-wider text-neutral-400 shrink-0">deactivated</span>
                        )}
                        <IconBtn onClick={() => setRenaming(true)} title="Rename category">{I.edit}</IconBtn>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setAttrModal(true)} className="btn-primary !py-2 !px-3.5 text-[13px]">
                        Add attribute
                      </button>
                      {category.active === false ? (
                        <button type="button" onClick={() => setCategoryActive(category.id, true)} className="btn-ghost !py-2 !px-3.5 text-[13px]">
                          Reactivate
                        </button>
                      ) : (
                        <button type="button" onClick={() => setCategoryActive(category.id, false)} className="btn-ghost !py-2 !px-3.5 text-[13px] text-neutral-500">
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* attributes */}
                  <div className="panel overflow-hidden">
                    <SectionHead
                      title="Attributes"
                      hint={`What makes one ${category.name} different — values are filled when buying & selling`}
                      count={catDefs.filter((d) => d.active).length}
                    />
                    {catDefs.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-[13px] text-neutral-400 mb-4">No attributes yet — e.g. Size, Grade, Brand.</p>
                        <button type="button" onClick={() => setAttrModal(true)} className="btn-primary !py-2 !px-4 text-[13px]">
                          Add first attribute
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-100">
                        {catDefs.map((d) => (
                          <AttrRow
                            key={d.id}
                            def={d}
                            options={optionsOf(d.id)}
                            onMove={(dir) => moveDef(d, dir)}
                            onToggle={() => patchAttribute(d.id, { active: !d.active })}
                            onAddOption={(label) => addOption(d.id, label)}
                            onPatchOption={(oid, active) => patchOption(oid, { active })}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* variants */}
                  <div className="panel overflow-hidden">
                    <SectionHead
                      title="Variants"
                      hint="Created automatically when stock is bought or sold — not added here manually"
                      count={catVariants.length}
                    />
                    {catVariants.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-[13px] text-neutral-400 max-w-md mx-auto leading-relaxed">
                          None yet. The first purchase or sale with these attributes creates one — e.g. {category.name} with every value you fill in.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-100">
                        {catVariants.map((v) => (
                          <VariantRow
                            key={v.id}
                            v={v}
                            attrsLine={attrsValuesLine(defsOf(category.id), v.attributes)}
                            used={usedVariant(v.id)}
                            onRename={(n) => setVariantShortName(v.id, n)}
                            onToggle={() => setVariantActive(v.id, !v.active)}
                            onDelete={() => setDeleteTarget({ kind: "variant", v })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* warehouses — right column so categories rail stays sticky */}
              <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              className="w-full panel px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-neutral-50/80 transition-colors"
            >
              <div>
                <p className="text-[13px] font-semibold text-neutral-700">Warehouses & locations</p>
                <p className="text-[12px] text-neutral-400 mt-0.5">Optional — for lot traceability in Inventory</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {warehouses.length > 0 && (
                  <span className="text-[11px] tabular-nums text-neutral-400 bg-neutral-50 border border-neutral-100 rounded px-2 py-0.5">
                    {warehouses.length}
                  </span>
                )}
                <span className={`text-neutral-400 transition-transform ${showSettings ? "rotate-180" : ""}`}>
                  {I.chev}
                </span>
              </div>
            </button>

            {showSettings && (
              <div className="panel mt-2 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 flex flex-wrap items-start justify-between gap-3">
                  <p className="text-[12px] text-neutral-500 leading-relaxed max-w-2xl">
                    A <span className="font-medium text-neutral-700">warehouse</span> is where you store goods (Main Yard).
                    A <span className="font-medium text-neutral-700">location</span> is a spot inside it (Yard A, Rack 01).
                    Pick one when recording a purchase — it shows on that lot in Inventory.
                  </p>
                  {warehouses.length > 0 && !openWh && (
                    <button
                      type="button"
                      onClick={() => setOpenWh(true)}
                      className="shrink-0 text-[12px] font-medium text-neutral-600 hover:text-black px-2.5 py-1.5 rounded-md border border-neutral-200 hover:border-neutral-300 bg-white"
                    >
                      + Warehouse
                    </button>
                  )}
                </div>

                {warehouses.length === 0 ? (
                  <div className="p-6 flex flex-col items-center gap-4 text-center">
                    <p className="text-[13px] text-neutral-400">No warehouses yet</p>
                    <div className="w-full max-w-sm">
                      <AddRow placeholder="e.g. Main Yard" onAdd={addWarehouse} button="Add warehouse" compact />
                    </div>
                  </div>
                ) : (
                  <>
                    {openWh && (
                      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
                        <AddRow
                          placeholder="New warehouse name"
                          onAdd={(n) => { addWarehouse(n); setOpenWh(false); }}
                          button="Add"
                          compact
                        />
                      </div>
                    )}
                    <div className="divide-y divide-neutral-100">
                      {warehouses.map((w) => {
                        const wLocs = locations.filter((l) => l.warehouseId === w.id);
                        return (
                          <div key={w.id} className={`px-4 py-4 ${w.active ? "" : "opacity-50"}`}>
                            <div className="flex items-center gap-2">
                              <RenameField value={w.name} onSave={(n) => renameWarehouse(w.id, n)} className="flex-1 !text-[14px] !font-semibold" />
                              {w.active === false && (
                                <span className="text-[10px] uppercase text-neutral-400 shrink-0">off</span>
                              )}
                              <IconBtn onClick={() => setWarehouseActive(w.id, !w.active)} title={w.active ? "Deactivate warehouse" : "Reactivate warehouse"} danger>
                                {w.active ? I.off : I.on}
                              </IconBtn>
                              {openLoc !== w.id && (
                                <button
                                  type="button"
                                  onClick={() => setOpenLoc(w.id)}
                                  className="shrink-0 text-[12px] font-medium text-neutral-500 hover:text-black px-2.5 py-1.5 rounded-md border border-neutral-200 hover:border-neutral-300 bg-white"
                                >
                                  + Location
                                </button>
                              )}
                            </div>
                            <div className="mt-3 pl-1 flex flex-wrap items-center gap-1.5">
                              {wLocs.filter((l) => l.active).map((l) => (
                                <span key={l.id} className="inline-flex items-center gap-1 border border-neutral-200 rounded-md px-2.5 py-1 text-[12px] text-neutral-700 bg-white">
                                  <RenameField value={l.name} onSave={(n) => renameLocation(l.id, n)} compact />
                                  <button
                                    type="button"
                                    onClick={() => setLocationActive(l.id, false)}
                                    title="Deactivate location"
                                    className="w-5 h-5 flex items-center justify-center rounded text-neutral-300 hover:text-[#a12b1f] hover:bg-[#faf5f2]"
                                  >
                                    {I.x}
                                  </button>
                                </span>
                              ))}
                              {wLocs.filter((l) => !l.active).map((l) => (
                                <button
                                  key={l.id}
                                  type="button"
                                  onClick={() => setLocationActive(l.id, true)}
                                  title={`Reactivate ${l.name}`}
                                  className="text-[12px] text-neutral-300 line-through hover:text-neutral-600 border border-dashed border-neutral-200 rounded-md px-2.5 py-1"
                                >
                                  {l.name}
                                </button>
                              ))}
                              {wLocs.length === 0 && openLoc !== w.id && (
                                <span className="text-[12px] text-neutral-400">No locations yet</span>
                              )}
                              {openLoc === w.id && (
                                <AddRow
                                  placeholder="e.g. Yard A"
                                  onAdd={(n) => { addLocation(w.id, n); setOpenLoc(null); }}
                                  button="Add"
                                  className="w-56"
                                  compact
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
              </div>
            </div>
          </div>
        </>
      )}

      {attrModal && category && (
        <AddAttributeModal
          categoryName={category.name}
          onClose={() => setAttrModal(false)}
          onAdd={(def) => { addAttribute(category.id, def); setAttrModal(false); }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={
          deleteTarget?.kind === "product"
            ? `Delete "${deleteTarget.p.name}"?`
            : deleteTarget
              ? `Delete variant "${deleteTarget.v.shortName}"?`
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
        {deleteTarget?.kind === "variant" && (
          <p className="text-sm text-neutral-700 leading-relaxed">
            Variant <span className="font-semibold">{deleteTarget.v.shortName}</span> is unused, so it leaves the catalogue.
          </p>
        )}
      </ConfirmModal>
    </Page>
  );
}

const ATTR_TYPES: AttributeDef["type"][] = ["select", "text", "number", "measurement", "boolean", "date"];

function AddAttributeModal({
  categoryName,
  onClose,
  onAdd,
}: {
  categoryName: string;
  onClose: () => void;
  onAdd: (def: { name: string; type: AttributeDef["type"]; required: boolean; unit?: string; options?: string[] }) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AttributeDef["type"]>("select");
  const [required, setRequired] = useState(true);
  const [unit, setUnit] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const opts = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!name.trim()) return setError("Give the attribute a name.");
    if (type === "select" && opts.length === 0) return setError("A dropdown needs at least one option — put one per line.");
    onAdd({ name: name.trim(), type, required, unit: unit.trim() || undefined, options: type === "select" ? opts : undefined });
  };

  return (
    <Modal open onClose={onClose} title={`Add attribute — ${categoryName}`}>
      {error && (
        <div role="alert" className="text-[13px] font-medium text-[#a12b1f] bg-[#faf5f2] border border-[#f0e2de] rounded-md px-3.5 py-2.5 mb-5">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="attr-name">Name</label>
            <input id="attr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diameter" autoFocus />
          </div>
          <div>
            <label htmlFor="attr-type">Type</label>
            <select id="attr-type" value={type} onChange={(e) => setType(e.target.value as AttributeDef["type"])}>
              {ATTR_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
        </div>
        {(type === "number" || type === "measurement") && (
          <div>
            <label htmlFor="attr-unit">Unit {type === "measurement" ? "(required, e.g. mm)" : "(optional)"}</label>
            <input id="attr-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={type === "measurement" ? "mm" : "e.g. mm"} />
          </div>
        )}
        {type === "select" && (
          <div>
            <label htmlFor="attr-options">Options — one per line</label>
            <textarea id="attr-options" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={5} placeholder={"40 Grade\n60 Grade\n75 Grade"} />
          </div>
        )}
        <label className="flex items-center gap-2.5 cursor-pointer !normal-case !text-[13px] text-neutral-700">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="!w-4 !h-4" />
          Required — must be filled before buying or selling
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Add attribute</button>
        </div>
      </form>
    </Modal>
  );
}
