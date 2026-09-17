import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import type { CreateCatalogTemplateDto } from "../platform/dto/create-catalog-template.dto";
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

  async listTemplates() {
    const custom = await this.prisma.catalogTemplate.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    const builtIn = PRODUCT_TEMPLATES.map((t) => this.toSummary(t));
    const customSummaries = custom.map((row) => {
      const def = row.definition as ProductTemplate;
      return this.toSummary(def);
    });
    return [...builtIn, ...customSummaries];
  }

  async listTemplatesFull(): Promise<ProductTemplate[]> {
    const custom = await this.prisma.catalogTemplate.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    return [
      ...PRODUCT_TEMPLATES,
      ...custom.map((row) => row.definition as ProductTemplate),
    ];
  }

  async getTemplateById(id: string): Promise<ProductTemplate | undefined> {
    const builtIn = TEMPLATE_BY_ID.get(id);
    if (builtIn) return builtIn;
    const row = await this.prisma.catalogTemplate.findFirst({
      where: { templateId: id, active: true },
    });
    return row ? (row.definition as ProductTemplate) : undefined;
  }

  async filterValidTemplateIds(ids: string[]): Promise<string[]> {
    const custom = await this.prisma.catalogTemplate.findMany({
      where: { templateId: { in: ids }, active: true },
      select: { templateId: true },
    });
    const valid = new Set([
      ...TEMPLATE_BY_ID.keys(),
      ...custom.map((row) => row.templateId),
    ]);
    const out: string[] = [];
    for (const id of ids) {
      if (valid.has(id) && !out.includes(id)) out.push(id);
    }
    return out;
  }

  async createCatalogTemplate(dto: CreateCatalogTemplateDto): Promise<ProductTemplate> {
    const templateId = `custom_${crypto.randomUUID().replace(/-/g, "")}`;
    const definition: ProductTemplate = {
      id: templateId,
      label: dto.label.trim(),
      usesCategories: dto.usesCategories ?? false,
      product: {
        name: dto.productName.trim(),
        unit: dto.productUnit.trim(),
        description: dto.description?.trim() || undefined,
      },
      attributes: dto.attributes.map((attribute) => ({
        name: attribute.name.trim(),
        type: attribute.type,
        required: attribute.required,
        unit: attribute.unit?.trim() || undefined,
        options: attribute.options?.map((option) => option.trim()).filter(Boolean),
      })),
    };
    await this.prisma.catalogTemplate.create({
      data: {
        templateId,
        label: definition.label,
        definition,
      },
    });
    return definition;
  }

  async applyTemplates(businessId: string, templateIds: string[]): Promise<string[]> {
    const applied: string[] = [];
    for (const templateId of templateIds) {
      const template = await this.getTemplateById(templateId);
      if (!template) continue;
      const productId = await this.applyOne(businessId, template);
      if (productId) applied.push(templateId);
    }
    return applied;
  }

  private toSummary(template: ProductTemplate) {
    return {
      id: template.id,
      label: template.label,
      usesCategories: template.usesCategories,
      productName: template.product.name,
      productUnit: template.product.unit,
      custom: template.id.startsWith("custom_"),
    };
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
