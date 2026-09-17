import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import {
  PRODUCT_TEMPLATES,
  TEMPLATE_BY_ID,
  type ProductTemplate,
  type TemplateAttribute,
} from "./product-templates";

@Injectable()
export class TemplateProvisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  listTemplates() {
    return PRODUCT_TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      usesCategories: t.usesCategories,
      productName: t.product.name,
      productUnit: t.product.unit,
    }));
  }

  async applyTemplates(businessId: string, templateIds: string[]): Promise<string[]> {
    const applied: string[] = [];
    for (const templateId of templateIds) {
      const template = TEMPLATE_BY_ID.get(templateId);
      if (!template) continue;
      const productId = await this.applyOne(businessId, template);
      if (productId) applied.push(templateId);
    }
    return applied;
  }

  private async applyOne(businessId: string, template: ProductTemplate): Promise<string | null> {
    const name = template.product.name.trim();
    if (!name) return null;

    const existing = await this.prisma.product.findFirst({
      where: { businessId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) return existing.id;

    const product = await this.products.create(businessId, {
      name,
      unit: template.product.unit,
      description: template.product.description,
      usesCategories: template.usesCategories,
    });

    if (template.usesCategories) {
      for (const category of template.categories ?? []) {
        if (!category.name.trim()) continue;
        const created = await this.products.createCategory(businessId, product.id, {
          name: category.name.trim(),
          description: category.description,
        });
        await this.addAttributes(
          businessId,
          product.id,
          category.attributes,
          created.id,
        );
      }
    } else {
      await this.addAttributes(businessId, product.id, template.attributes ?? []);
    }

    return product.id;
  }

  private async addAttributes(
    businessId: string,
    productId: string,
    attrs: TemplateAttribute[],
    categoryId?: string,
  ) {
    for (const [index, attribute] of attrs.entries()) {
      const attrName = attribute.name.trim();
      if (!attrName) continue;
      const key =
        attrName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || `attribute_${index}`;
      const created = await this.products.createAttribute(businessId, productId, {
        name: attrName,
        key,
        type: attribute.type,
        required: attribute.required,
        unit: attribute.unit,
        categoryId,
        sortOrder: index + 1,
        active: true,
      });
      for (const [optionIndex, label] of (attribute.options ?? []).entries()) {
        const clean = label.trim();
        if (!clean) continue;
        await this.products.createOption(businessId, created.id, {
          label: clean,
          sortOrder: optionIndex,
        });
      }
    }
  }
}
