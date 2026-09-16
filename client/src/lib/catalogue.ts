import type { AttributeDef, AttributeOption } from "./types";

/* display-label identity — kept so existing seed/legacy variants still match.
   New variants use identityKey() (attribute-id + option-id), which does not
   change when an option is renamed or the owner reorders attributes.
   scopeId is the category id when the product uses categories, otherwise the product id. */
export const variantKey = (
  scopeId: string,
  attributes: Record<string, string>
) => {
  const pairs = Object.entries(attributes)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return [scopeId, ...pairs].join("::");
};

/* resolve a filled snapshot (attribute key → typed/picked value) into a
   stable token per definition: option id for dropdowns, otherwise the value.
   Order of attributes is ignored — identity is a sorted set of pairs.
   `defs` should already be scoped to the product or category. */
export function identityTokens(
  attributes: Record<string, string>,
  defs: AttributeDef[],
  options: AttributeOption[]
): { defId: string; token: string }[] {
  const tokens: { defId: string; token: string }[] = [];
  for (const d of defs) {
    const val = attributes[d.key]?.trim() ?? "";
    if (!val) continue;
    if (d.type === "select") {
      const opt =
        options.find((o) => o.attributeDefId === d.id && o.label === val) ??
        options.find((o) => o.attributeDefId === d.id && o.id === val);
      tokens.push({ defId: d.id, token: opt?.id ?? `v:${val}` });
    } else {
      tokens.push({ defId: d.id, token: `v:${val}` });
    }
  }
  tokens.sort((a, b) => a.defId.localeCompare(b.defId));
  return tokens;
}

export const identityKey = (
  scopeId: string,
  attributes: Record<string, string>,
  defs: AttributeDef[],
  options: AttributeOption[]
) => {
  const tokens = identityTokens(attributes, defs, options);
  return [scopeId, ...tokens.map((t) => `${t.defId}=${t.token}`)].join("::");
};

export function scopedDefs(
  defs: AttributeDef[],
  productId: string,
  categoryId?: string | null
): AttributeDef[] {
  const list = categoryId
    ? defs.filter((d) => d.categoryId === categoryId)
    : defs.filter((d) => d.productId === productId && !d.categoryId);
  return list.sort((a, b) => a.sortOrder - b.sortOrder);
}

/* defs to render a snapshot — history may still point at a category even
   after the product stopped using categories, so fall back to product-level. */
export function resolveDefs(
  defs: AttributeDef[],
  opts: { productId?: string; categoryId?: string; snapshot?: Record<string, string> }
): AttributeDef[] {
  const { productId, categoryId, snapshot } = opts;
  const keep = (d: AttributeDef) => d.active || !!(snapshot && snapshot[d.key]);
  if (categoryId) {
    const byCat = defs.filter((d) => d.categoryId === categoryId && keep(d)).sort((a, b) => a.sortOrder - b.sortOrder);
    if (byCat.length) return byCat;
  }
  if (productId) {
    const byProd = defs.filter((d) => d.productId === productId && !d.categoryId && keep(d)).sort((a, b) => a.sortOrder - b.sortOrder);
    if (byProd.length) return byProd;
    return defs.filter((d) => d.productId === productId && keep(d)).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return [];
}

export function attrsEqual(a: Record<string, string>, b: Record<string, string>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? "") !== (b[k] ?? "")) return false;
  return true;
}

/* an option that appears on a variant or in a frozen snapshot must not be
   hard-deleted — deactivate it instead so history stays readable. */
export function optionAppearsIn(
  opt: AttributeOption,
  def: AttributeDef | undefined,
  variants: { attributes: Record<string, string>; identityKey?: string }[],
  snapshots: Array<Record<string, string> | undefined>
) {
  if (!def) return false;
  if (variants.some((v) => v.identityKey?.includes(`${def.id}=${opt.id}`))) return true;
  if (variants.some((v) => v.attributes[def.key] === opt.label)) return true;
  return snapshots.some((s) => s?.[def.key] === opt.label);
}

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
  for (const d of defs.filter((x) => x.active && x.categoryId)) (m[d.categoryId!] ??= []).push(d);
  for (const k of Object.keys(m)) m[k].sort((a, b) => a.sortOrder - b.sortOrder);
  return m;
}

export function productUsesCategories(p?: { usesCategories?: boolean } | null) {
  return p?.usesCategories === true;
}

