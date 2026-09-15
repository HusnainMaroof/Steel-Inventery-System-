import { attrsInOrder, productUsesCategories, resolveDefs } from "./catalogue";
import type { InvoiceLineDetail } from "@/components/InvoiceDocument";
import type { AttributeDef, Product, ProductCategory, SaleLine, Variant } from "./types";

export function invoiceLineDetail(
  l: SaleLine,
  ctx: {
    products: Product[];
    categories: ProductCategory[];
    variants: Variant[];
    attributeDefs: AttributeDef[];
  }
): InvoiceLineDetail {
  const variant = l.variantId ? ctx.variants.find((v) => v.id === l.variantId) : undefined;
  const cat =
    (l.categoryId ? ctx.categories.find((c) => c.id === l.categoryId) : undefined) ??
    (variant?.categoryId ? ctx.categories.find((c) => c.id === variant.categoryId) : undefined);
  const product =
    (variant?.productId ? ctx.products.find((p) => p.id === variant.productId) : undefined) ??
    (cat ? ctx.products.find((p) => p.id === cat.productId) : undefined);
  const defs = resolveDefs(ctx.attributeDefs, {
    productId: product?.id ?? variant?.productId,
    categoryId: l.categoryId ?? variant?.categoryId,
    snapshot: l.attributeSnapshot,
  });

  const attributes = l.attributeSnapshot
    ? attrsInOrder(defs, l.attributeSnapshot).map((r) => ({
        label: r.def.name,
        value: r.value,
      }))
    : [l.spec, l.quality]
        .filter(Boolean)
        .map((v, i) => ({ label: i === 0 ? "Spec" : "Grade", value: v! }));

  return {
    product: product?.name ?? null,
    category: productUsesCategories(product) ? (cat?.name ?? null) : null,
    item: variant?.shortName ?? l.item,
    qualityName: l.qualityName ?? l.quality ?? null,
    attributes,
  };
}
