import { PRODUCT_TEMPLATES, type ProductTemplate } from "./product-templates";
import { attributeKey, buildTemplateRows } from "./template-rows";

describe("buildTemplateRows", () => {
  const flat: ProductTemplate = {
    id: "tpl-flat",
    label: "Flat",
    usesCategories: false,
    product: { name: " Steel ", unit: "kg" },
    attributes: [
      { name: "Size", type: "select", required: true, options: ["10mm", " ", "12mm"] },
      { name: "  ", type: "text", required: false },
      { name: "Mill Name", type: "text", required: false, unit: "x" },
    ],
  };
  const grouped: ProductTemplate = {
    id: "tpl-grouped",
    label: "Grouped",
    usesCategories: true,
    product: { name: "Cement", unit: "bag", description: "Bags" },
    categories: [
      { name: "Grey", attributes: [{ name: "Brand", type: "select", required: true, options: ["A"] }] },
      { name: " ", attributes: [{ name: "Skipped", type: "text", required: false }] },
    ],
  };

  it("builds the same rows the per-row path created", () => {
    const { rows, applied } = buildTemplateRows([flat, grouped]);

    expect(applied).toEqual(["tpl-flat", "tpl-grouped"]);
    expect(rows.products.map((p) => [p.name, p.unit, p.description, p.usesCategories])).toEqual([
      ["Steel", "kg", null, false],
      ["Cement", "bag", "Bags", true],
    ]);
    expect(rows.categories.map((c) => c.name)).toEqual(["Grey"]);
    expect(rows.attributes.map((a) => [a.key, a.sortOrder, a.categoryId === null, a.unit])).toEqual([
      ["size", 1, true, null],
      ["mill_name", 3, true, "x"],
      ["brand", 1, false, null],
    ]);
    expect(rows.options.map((o) => [o.label, o.sortOrder])).toEqual([
      ["10mm", 0],
      ["12mm", 2],
      ["A", 0],
    ]);
  });

  it("links every child row to a parent built in the same call", () => {
    const { rows } = buildTemplateRows(PRODUCT_TEMPLATES);
    const products = new Set(rows.products.map((p) => p.id));
    const categories = new Set(rows.categories.map((c) => c.id));
    const attributes = new Set(rows.attributes.map((a) => a.id));

    expect(rows.categories.every((c) => products.has(c.productId))).toBe(true);
    expect(rows.attributes.every((a) => products.has(a.productId))).toBe(true);
    expect(rows.attributes.every((a) => a.categoryId === null || categories.has(a.categoryId))).toBe(true);
    expect(rows.options.every((o) => attributes.has(o.attributeDefId))).toBe(true);
    expect(rows.products.every((p) => /^c[0-9a-f]{24}$/.test(p.id))).toBe(true);
  });

  it("skips products that already exist or repeat, but counts them as applied", () => {
    const again = { ...flat, id: "tpl-flat-2", product: { name: "STEEL", unit: "kg" } };
    const { rows, applied } = buildTemplateRows([flat, again, grouped], ["cement"]);

    expect(applied).toEqual(["tpl-flat", "tpl-flat-2", "tpl-grouped"]);
    expect(rows.products.map((p) => p.name)).toEqual(["Steel"]);
  });

  it("derives attribute keys like the old provisioning code", () => {
    expect(attributeKey("Mill / Brand", 0)).toBe("mill_brand");
    expect(attributeKey("***", 4)).toBe("attribute_4");
  });
});
