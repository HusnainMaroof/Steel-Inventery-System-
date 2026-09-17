/** Product setup templates — shared catalog for Super Admin provisioning. */

export type TemplateAttribute = {
  name: string;
  type: "text" | "number" | "select";
  required: boolean;
  unit?: string;
  options?: string[];
};

export type TemplateCategory = {
  name: string;
  description?: string;
  attributes: TemplateAttribute[];
};

export type ProductTemplate = {
  id: string;
  label: string;
  usesCategories: boolean;
  product: { name: string; unit: string; description?: string };
  attributes?: TemplateAttribute[];
  categories?: TemplateCategory[];
};

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    id: "tpl-steel",
    label: "Steel Trading",
    usesCategories: false,
    product: {
      name: "Steel",
      unit: "kg",
      description: "Diameter, grade and mill on the product — no category",
    },
    attributes: [
      {
        name: "Size",
        type: "select",
        required: true,
        options: ["2 Sutar", "3 Sutar", "4 Sutar", "5 Sutar", "6 Sutar", "8 Sutar"],
      },
      {
        name: "Grade",
        type: "select",
        required: true,
        options: ["40 Grade", "60 Grade", "75 Grade"],
      },
      {
        name: "Manufacturer",
        type: "select",
        required: false,
        options: ["Ittefaq", "Mughal", "Amreli", "Ittehad"],
      },
    ],
  },
  {
    id: "tpl-cement",
    label: "Cement Trading",
    usesCategories: true,
    product: {
      name: "Cement",
      unit: "bag",
      description: "Grey and white cement — each category has its own attributes",
    },
    categories: [
      {
        name: "Grey Cement",
        attributes: [
          {
            name: "Grade",
            type: "select",
            required: true,
            options: ["33 OPC", "43 OPC", "53 OPC"],
          },
          {
            name: "Company",
            type: "select",
            required: true,
            options: ["Lucky Cement", "Fauji Cement", "DG Khan Cement", "Maple Leaf Cement"],
          },
        ],
      },
      {
        name: "White Cement",
        attributes: [
          {
            name: "Grade",
            type: "select",
            required: true,
            options: ["33 OPC", "43 OPC", "53 OPC"],
          },
          {
            name: "Company",
            type: "select",
            required: true,
            options: ["DG Khan Cement", "Maple Leaf Cement"],
          },
        ],
      },
    ],
  },
  {
    id: "tpl-wire",
    label: "Wire Trading",
    usesCategories: true,
    product: { name: "Wire", unit: "kg", description: "Binding and GI wire by gauge" },
    categories: [
      {
        name: "Binding Wire",
        attributes: [
          { name: "Gauge", type: "select", required: true, options: ["16 Gauge", "18 Gauge", "20 Gauge"] },
        ],
      },
      {
        name: "G.I Wire",
        attributes: [
          { name: "Gauge", type: "select", required: true, options: ["16 Gauge", "18 Gauge", "20 Gauge"] },
        ],
      },
    ],
  },
  {
    id: "tpl-paint",
    label: "Paint Trading",
    usesCategories: true,
    product: { name: "Paint", unit: "liter", description: "Wall and enamel paints" },
    categories: [
      {
        name: "Wall Paint",
        attributes: [
          {
            name: "Color",
            type: "select",
            required: true,
            options: ["White", "Ivory", "Sky Grey", "Skin"],
          },
          {
            name: "Finish",
            type: "select",
            required: true,
            options: ["Matt", "Satin", "Gloss"],
          },
          {
            name: "Size",
            type: "select",
            required: true,
            options: ["1 Liter", "4 Liter", "20 Liter"],
          },
        ],
      },
      {
        name: "Enamel",
        attributes: [
          {
            name: "Color",
            type: "select",
            required: true,
            options: ["White", "Black", "Red Oxide"],
          },
          {
            name: "Size",
            type: "select",
            required: true,
            options: ["1 Liter", "4 Liter"],
          },
        ],
      },
    ],
  },
  {
    id: "tpl-tiles",
    label: "Tiles Trading",
    usesCategories: true,
    product: {
      name: "Tiles",
      unit: "box",
      description: "Floor and wall tiles by size and finish",
    },
    categories: [
      {
        name: "Floor Tile",
        attributes: [
          {
            name: "Size",
            type: "select",
            required: true,
            options: ["12x12", "16x16", "24x24"],
          },
          {
            name: "Finish",
            type: "select",
            required: true,
            options: ["Matt", "Glossy", "Wooden"],
          },
          {
            name: "Brand",
            type: "select",
            required: false,
            options: ["Local", "Imported"],
          },
        ],
      },
      {
        name: "Wall Tile",
        attributes: [
          {
            name: "Size",
            type: "select",
            required: true,
            options: ["8x12", "10x16", "12x18"],
          },
          {
            name: "Finish",
            type: "select",
            required: true,
            options: ["Glossy", "Matt"],
          },
          {
            name: "Brand",
            type: "select",
            required: false,
            options: ["Local", "Imported"],
          },
        ],
      },
    ],
  },
];

export const TEMPLATE_BY_ID = new Map(PRODUCT_TEMPLATES.map((t) => [t.id, t]));

export function assertTemplateIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!TEMPLATE_BY_ID.has(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
