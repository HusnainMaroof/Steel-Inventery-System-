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
      className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
        selected
          ? "border-ink bg-[#F8F8F7]"
          : "border-line bg-white hover:bg-[#F8F8F7]"
      }`}
    >
      <input type="checkbox" className="mt-0.5" checked={selected} onChange={onChange} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-bold text-ink">{label}</span>
          {meta ? (
            <span className="rounded bg-[#F0F0EE] px-1.5 py-0.5 text-xs font-medium text-[#171717]/70">
              {meta.trade}
            </span>
          ) : isCustom ? (
            <span className="rounded bg-[#F0F0EE] px-1.5 py-0.5 text-xs font-medium text-[#171717]/70">
              Custom
            </span>
          ) : null}
          {assigned ? (
            <span className="rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
              Already on this business
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-[13px] text-[#171717]/70">
          {productName} · {productUnit}
          {usesCategories != null ? ` · ${catalogStructureLabel(usesCategories)}` : ""}
        </span>
        {meta ? <span className="mt-0.5 block text-[13px] leading-snug text-[#171717]/70">{meta.hint}</span> : null}
      </span>
    </label>
  );
}
