"use client";

import { builtinTemplateMeta, catalogStructureLabel } from "@/lib/admin-platform-meta";

export function AdminTemplatePickCard({
  id,
  label,
  productName,
  productUnit,
  usesCategories,
  selected,
  onChange,
  assigned,
}: {
  id: string;
  label: string;
  productName: string;
  productUnit: string;
  usesCategories?: boolean;
  selected: boolean;
  onChange: () => void;
  assigned?: boolean;
}) {
  const meta = builtinTemplateMeta(id);
  const isCustom = id.startsWith("custom_");

  return (
    <label
      className={`flex items-start gap-3 border rounded-lg p-3.5 cursor-pointer transition-colors border-l-4 ${
        meta?.accentClass ?? "border-l-neutral-300"
      } ${
        selected
          ? "border-neutral-900 bg-white ring-1 ring-neutral-900/10"
          : "border-neutral-200 bg-white hover:border-neutral-300"
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 shrink-0"
        checked={selected}
        onChange={onChange}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">{label}</span>
          {meta ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
              {meta.trade}
            </span>
          ) : isCustom ? (
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
              Custom
            </span>
          ) : null}
        </span>
        <span className="block text-xs text-neutral-600 mt-1">
          {productName} · {productUnit}
          {usesCategories != null ? ` · ${catalogStructureLabel(usesCategories)}` : ""}
        </span>
        {meta ? <span className="block text-[11px] text-neutral-500 mt-1 leading-snug">{meta.hint}</span> : null}
        {assigned ? (
          <span className="block text-[11px] text-emerald-700 font-medium mt-1.5">Already on this business</span>
        ) : null}
      </span>
    </label>
  );
}
