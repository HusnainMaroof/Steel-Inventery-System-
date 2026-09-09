import type { AttributeDef } from "./types";

/* deterministic identity for an attribute combination — duplicate variants
   are impossible because the key is built from the same sorted pairs. */
export const variantKey = (
  categoryId: string,
  attributes: Record<string, string>
) => {
  const pairs = Object.entries(attributes)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return [categoryId, ...pairs].join("::");
};

/* friendly one-line label, derived generically from the configured
   attributes: single attribute → its value; several → values in
   definition order; none → the category name. Config UI can override. */
export function defaultShortName(
  categoryName: string,
  attributes: Record<string, string>,
  defs: AttributeDef[]
): string {
  const ordered = [...defs]
    .filter((d) => d.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const values = ordered
    .map((d) => attributes[d.key])
    .filter((v): v is string => !!v && v !== "");
  if (values.length === 0) return categoryName;
  if (values.length === 1) return values[0];
  return values.join(" · ");
}

/* attribute rows in definition order, for rendering chips/labels */
export function attrsInOrder(defs: AttributeDef[], snapshot?: Record<string, string>) {
  return [...defs]
    .filter((d) => d.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => ({ def: d, value: snapshot?.[d.key] ?? "" }))
    .filter((r) => r.value !== "");
}

/* one muted line of attribute values, e.g. "3 Sutar · 60 Grade" */
export function attrsValuesLine(defs: AttributeDef[], snapshot?: Record<string, string>) {
  return attrsInOrder(defs, snapshot)
    .map((r) => r.value)
    .join(" · ");
}

/* does the value look filled in for a required/any check */
export const isBlank = (v?: string) => v === undefined || v.trim() === "";

/* group active defs by category id (ordered), for cheap lookups in UIs */
export function groupDefsByCategory(defs: AttributeDef[]): Record<string, AttributeDef[]> {
  const m: Record<string, AttributeDef[]> = {};
  for (const d of defs.filter((x) => x.active)) (m[d.categoryId] ??= []).push(d);
  for (const k of Object.keys(m)) m[k].sort((a, b) => a.sortOrder - b.sortOrder);
  return m;
}

