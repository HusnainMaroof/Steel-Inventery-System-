"use client";

import type { AttributeDef } from "@/lib/types";
import { attrsInOrder } from "@/lib/catalogue";

/*
 * One identity block for a variant (or a snapshot of it): the short name on
 * the first line, its attribute values on the second. Replaces every place
 * that composed [product · spec · quality] from fixed fields.
 */
export function VariantBadge({
  name,
  snapshot,
  defs,
  nameClass = "text-[13px] sm:text-[15px] font-semibold text-[#171717] leading-tight",
  attrsClass = "text-[11px] text-neutral-500 mt-0.5 leading-snug",
}: {
  name: string;
  snapshot?: Record<string, string>;
  defs: AttributeDef[];
  nameClass?: string;
  attrsClass?: string;
}) {
  const rows = attrsInOrder(defs, snapshot);
  return (
    <span className="block min-w-0">
      <span className={`block truncate ${nameClass}`} title={name}>
        {name}
      </span>
      {rows.length > 0 && (
        <span className={`block truncate ${attrsClass}`}>
          {rows.map((r) => r.value).join(" · ")}
        </span>
      )}
    </span>
  );
}
