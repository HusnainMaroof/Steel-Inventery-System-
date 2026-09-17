"use client";

import { useState } from "react";
import {
  createCatalogTemplateAction,
  type CatalogTemplateAttribute,
  type ProductTemplateFull,
} from "@/app/actions/platform";
import { BusyButton, Modal } from "@/components/ui";

const UNIT_OPTIONS = [
  { value: "kg", label: "KG" },
  { value: "bag", label: "Bags" },
  { value: "liter", label: "Liters" },
  { value: "box", label: "Boxes" },
  { value: "piece", label: "Pieces" },
];

function AttributeBlock({ attribute }: { attribute: CatalogTemplateAttribute }) {
  return (
    <div className="rounded-md border border-neutral-100 bg-neutral-50/50 px-3 py-2">
      <p className="text-[12px] font-medium text-neutral-900">
        {attribute.name}
        {attribute.required ? <span className="text-neutral-400 font-normal"> · required</span> : null}
      </p>
      <p className="text-[11px] text-neutral-500 mt-0.5 capitalize">
        {attribute.type}
        {attribute.unit ? ` · ${attribute.unit}` : ""}
      </p>
      {attribute.options?.length ? (
        <div className="flex flex-wrap gap-1 mt-2">
          {attribute.options.map((option) => (
            <span
              key={option}
              className="inline-flex rounded-full bg-white border border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-600"
            >
              {option}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TemplateCatalogCard({
  template,
  expanded,
  onToggle,
}: {
  template: ProductTemplateFull;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isCustom = template.id.startsWith("custom_");

  return (
    <article className="panel overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-neutral-50/80 transition-colors"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-neutral-900">{template.label}</span>
            {isCustom ? (
              <span className="text-[10px] uppercase tracking-widest text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                Custom
              </span>
            ) : null}
          </span>
          <span className="block text-[11px] text-neutral-500 mt-1">
            {template.product.name} · {template.product.unit}
            {template.usesCategories ? " · uses categories" : " · flat attributes"}
          </span>
        </span>
        <span className="text-neutral-400 text-xs shrink-0 pt-0.5">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-neutral-100">
          {template.product.description ? (
            <p className="text-[12px] text-neutral-600 mt-3">{template.product.description}</p>
          ) : null}

          {template.usesCategories && template.categories?.length ? (
            <div className="mt-4 space-y-4">
              {template.categories.map((category) => (
                <div key={category.name}>
                  <p className="text-[12px] font-semibold text-neutral-800">{category.name}</p>
                  {category.description ? (
                    <p className="text-[11px] text-neutral-500 mt-0.5">{category.description}</p>
                  ) : null}
                  <div className="grid gap-2 mt-2">
                    {category.attributes.map((attribute) => (
                      <AttributeBlock key={`${category.name}-${attribute.name}`} attribute={attribute} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!template.usesCategories && template.attributes?.length ? (
            <div className="grid gap-2 mt-4">
              {template.attributes.map((attribute) => (
                <AttributeBlock key={attribute.name} attribute={attribute} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}

type DraftAttribute = {
  name: string;
  type: CatalogTemplateAttribute["type"];
  required: boolean;
  options: string;
};

export function AddCatalogTemplateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [productName, setProductName] = useState("");
  const [productUnit, setProductUnit] = useState("kg");
  const [description, setDescription] = useState("");
  const [attributes, setAttributes] = useState<DraftAttribute[]>([
    { name: "", type: "select", required: true, options: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setLabel("");
    setProductName("");
    setProductUnit("kg");
    setDescription("");
    setAttributes([{ name: "", type: "select", required: true, options: "" }]);
    setError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const parsed: CatalogTemplateAttribute[] = attributes
      .map((row) => ({
        name: row.name.trim(),
        type: row.type,
        required: row.required,
        options: row.type === "select"
          ? row.options.split(",").map((part) => part.trim()).filter(Boolean)
          : undefined,
      }))
      .filter((row) => row.name);

    const result = await createCatalogTemplateAction({
      label,
      productName,
      productUnit,
      description,
      attributes: parsed,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    await onCreated();
    close();
  };

  return (
    <Modal open={open} onClose={close} title="New product template" size="lg">
      {error ? <p role="alert" className="text-sm text-[#a12b1f] mb-3">{error}</p> : null}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div>
          <label htmlFor="tpl-label">Template label</label>
          <input
            id="tpl-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Copper Wire"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tpl-product">Product name</label>
            <input
              id="tpl-product"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Wire"
            />
          </div>
          <div>
            <label htmlFor="tpl-unit">Unit</label>
            <select id="tpl-unit" value={productUnit} onChange={(e) => setProductUnit(e.target.value)}>
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit.value} value={unit.value}>{unit.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="tpl-desc">Description (optional)</label>
          <input
            id="tpl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short note for admins"
          />
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Attributes / variants</p>
          <div className="space-y-3">
            {attributes.map((row, index) => (
              <div key={index} className="border border-neutral-200 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={row.name}
                    onChange={(e) =>
                      setAttributes((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)),
                      )
                    }
                    placeholder="Attribute name (e.g. Gauge)"
                  />
                  <select
                    value={row.type}
                    onChange={(e) =>
                      setAttributes((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, type: e.target.value as DraftAttribute["type"] } : item,
                        ),
                      )
                    }
                  >
                    <option value="select">Dropdown</option>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                  </select>
                </div>
                {row.type === "select" ? (
                  <input
                    value={row.options}
                    onChange={(e) =>
                      setAttributes((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, options: e.target.value } : item)),
                      )
                    }
                    placeholder="Options, comma-separated"
                  />
                ) : null}
                <label className="flex items-center gap-2 text-[12px] text-neutral-600">
                  <input
                    type="checkbox"
                    checked={row.required}
                    onChange={(e) =>
                      setAttributes((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, required: e.target.checked } : item)),
                      )
                    }
                  />
                  Required
                </label>
                {attributes.length > 1 ? (
                  <button
                    type="button"
                    className="text-[11px] text-[#a12b1f]"
                    onClick={() => setAttributes((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove attribute
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="text-[12px] font-medium text-neutral-600 hover:text-black mt-2"
            onClick={() =>
              setAttributes((prev) => [...prev, { name: "", type: "select", required: true, options: "" }])
            }
          >
            + Add attribute
          </button>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <BusyButton type="submit" loading={pending}>Create template</BusyButton>
        </div>
      </form>
    </Modal>
  );
}
