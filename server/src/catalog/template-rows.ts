import { Prisma } from "@prisma/client";
import { newRecordId } from "../common/record-id";
import type { ProductTemplate, TemplateAttribute } from "./product-templates";

/** Catalogue rows for a set of templates, built in memory so one statement can insert them. */
export type TemplateRows = {
  products: Array<{
    id: string;
    name: string;
    unit: string;
    description: string | null;
    usesCategories: boolean;
  }>;
  categories: Array<{ id: string; productId: string; name: string; description: string | null }>;
  attributes: Array<{
    id: string;
    productId: string;
    categoryId: string | null;
    name: string;
    key: string;
    type: string;
    required: boolean;
    unit: string | null;
    sortOrder: number;
  }>;
  options: Array<{ id: string; attributeDefId: string; label: string; sortOrder: number }>;
};

/** Stable attribute key from its name, the same rule the catalogue UI uses. */
export function attributeKey(name: string, index: number): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `attribute_${index}`
  );
}

/**
 * Builds every product, category, attribute and option row for the templates.
 * A template whose product name (case-insensitive) is in `existingNames`, or
 * repeats an earlier template in the list, is skipped but still counts as applied.
 */
export function buildTemplateRows(
  templates: ProductTemplate[],
  existingNames: Iterable<string> = [],
): { rows: TemplateRows; applied: string[] } {
  const rows: TemplateRows = { products: [], categories: [], attributes: [], options: [] };
  const applied: string[] = [];
  const seen = new Set([...existingNames].map((name) => name.trim().toLowerCase()));

  const addAttributes = (productId: string, attrs: TemplateAttribute[], categoryId: string | null) => {
    for (const [index, attribute] of attrs.entries()) {
      const name = attribute.name.trim();
      if (!name) continue;
      const id = newRecordId();
      rows.attributes.push({
        id,
        productId,
        categoryId,
        name,
        key: attributeKey(name, index),
        type: attribute.type,
        required: attribute.required,
        unit: attribute.unit ?? null,
        sortOrder: index + 1,
      });
      for (const [optionIndex, label] of (attribute.options ?? []).entries()) {
        const clean = label.trim();
        if (!clean) continue;
        rows.options.push({ id: newRecordId(), attributeDefId: id, label: clean, sortOrder: optionIndex });
      }
    }
  };

  for (const template of templates) {
    const name = template.product.name.trim();
    if (!name) continue;
    applied.push(template.id);
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    const productId = newRecordId();
    rows.products.push({
      id: productId,
      name,
      unit: template.product.unit,
      description: template.product.description ?? null,
      usesCategories: template.usesCategories,
    });
    if (template.usesCategories) {
      for (const category of template.categories ?? []) {
        const categoryName = category.name.trim();
        if (!categoryName) continue;
        const categoryId = newRecordId();
        rows.categories.push({
          id: categoryId,
          productId,
          name: categoryName,
          description: category.description ?? null,
        });
        addAttributes(productId, category.attributes, categoryId);
      }
    } else {
      addAttributes(productId, template.attributes ?? [], null);
    }
  }
  return { rows, applied };
}

/**
 * Data-modifying CTEs (no leading WITH) that insert the rows for one business.
 * Foreign keys between the rows are checked at the end of the statement, so the
 * business itself may be inserted by an earlier CTE of the same statement.
 */
export function catalogueInsertCtes(businessId: string, rows: TemplateRows): Prisma.Sql {
  return Prisma.sql`
    tpl_products AS (
      INSERT INTO "Product" ("id", "businessId", "name", "unit", "description", "usesCategories")
      SELECT r."id", ${businessId}, r."name", r."unit", r."description", r."usesCategories"
      FROM jsonb_to_recordset(${JSON.stringify(rows.products)}::jsonb) AS r(
        "id" text, "name" text, "unit" text, "description" text, "usesCategories" boolean
      )
      RETURNING 1
    ),
    tpl_categories AS (
      INSERT INTO "ProductCategory" ("id", "businessId", "productId", "name", "description")
      SELECT r."id", ${businessId}, r."productId", r."name", r."description"
      FROM jsonb_to_recordset(${JSON.stringify(rows.categories)}::jsonb) AS r(
        "id" text, "productId" text, "name" text, "description" text
      )
      RETURNING 1
    ),
    tpl_attributes AS (
      INSERT INTO "AttributeDef" ("id", "businessId", "productId", "categoryId", "key", "name",
                                  "type", "required", "unit", "sortOrder", "active")
      SELECT r."id", ${businessId}, r."productId", r."categoryId", r."key", r."name",
             r."type", r."required", r."unit", r."sortOrder", true
      FROM jsonb_to_recordset(${JSON.stringify(rows.attributes)}::jsonb) AS r(
        "id" text, "productId" text, "categoryId" text, "key" text, "name" text,
        "type" text, "required" boolean, "unit" text, "sortOrder" int
      )
      RETURNING 1
    ),
    tpl_options AS (
      INSERT INTO "AttributeOption" ("id", "attributeDefId", "label", "sortOrder", "active")
      SELECT r."id", r."attributeDefId", r."label", r."sortOrder", true
      FROM jsonb_to_recordset(${JSON.stringify(rows.options)}::jsonb) AS r(
        "id" text, "attributeDefId" text, "label" text, "sortOrder" int
      )
      RETURNING 1
    )`;
}

export function hasCatalogueRows(rows: TemplateRows): boolean {
  return rows.products.length > 0;
}
