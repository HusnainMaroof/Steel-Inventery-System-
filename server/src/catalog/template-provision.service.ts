import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogueCache } from "../ledger/catalogue-cache";
import type { CreateCatalogTemplateDto } from "../platform/dto/create-catalog-template.dto";
import {
  PRODUCT_TEMPLATES,
  TEMPLATE_BY_ID,
  type ProductTemplate,
} from "./product-templates";
import { buildTemplateRows, catalogueInsertCtes, hasCatalogueRows } from "./template-rows";

@Injectable()
export class TemplateProvisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: CatalogueCache,
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

  /**
   * Valid templates for the ids, in the given order and without repeats: built-in
   * ones from code, active custom ones in one query (none when all are built-in).
   */
  async loadTemplates(ids: string[]): Promise<ProductTemplate[]> {
    const customIds = ids.filter((id) => !TEMPLATE_BY_ID.has(id));
    const custom = customIds.length
      ? await this.prisma.catalogTemplate.findMany({
          where: { templateId: { in: customIds }, active: true },
          select: { templateId: true, definition: true },
        })
      : [];
    const customById = new Map(
      custom.map((row) => [row.templateId, { ...(row.definition as ProductTemplate), id: row.templateId }]),
    );
    const out: ProductTemplate[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) continue;
      const template = TEMPLATE_BY_ID.get(id) ?? customById.get(id);
      if (!template) continue;
      seen.add(id);
      out.push(template);
    }
    return out;
  }

  /**
   * Adds the template catalogues to an existing business: one read for the names
   * it already has, then one insert statement.
   * Products whose name already exists (case-insensitive) are skipped but
   * still count as applied.
   */
  async applyTemplates(businessId: string, templates: ProductTemplate[]): Promise<string[]> {
    if (!templates.length) return [];
    const names = templates.map((template) => template.product.name.trim()).filter(Boolean);
    const existing = await this.prisma.product.findMany({
      where: { businessId, OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) },
      select: { name: true },
    });
    const { rows, applied } = buildTemplateRows(templates, existing.map((p) => p.name));
    if (hasCatalogueRows(rows)) {
      await this.prisma.$executeRaw(
        Prisma.sql`WITH ${catalogueInsertCtes(businessId, rows)} SELECT 1`,
      );
      this.catalogue.invalidate(businessId);
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
}
