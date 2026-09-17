import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
import {
  CreateAttributeDto,
  CreateOptionDto,
  ReorderDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
  UpdateOptionDto,
  UpdateVariantDto,
} from "./dto/catalogue.dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(businessId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        businessId,
        name: dto.name,
        unit: dto.unit,
        description: dto.description,
        usesCategories: dto.usesCategories ?? false,
        specLabel: dto.specLabel,
      },
    });
  }

  async list(businessId: string, skip: number, take: number) {
    const where = { businessId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
          attributeDefs: {
            include: { options: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
          variants: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);
    return [items, total] as const;
  }

  async byId(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      include: { categories: true, items: true, attributeDefs: { include: { options: true } }, variants: true },
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  async update(businessId: string, id: string, dto: UpdateProductDto) {
    await this.assertExists(businessId, id);
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        unit: dto.unit,
        description: dto.description,
        specLabel: dto.specLabel,
        usesCategories: dto.usesCategories,
        active: dto.active,
      },
    });
  }

  async remove(businessId: string, id: string) {
    await this.assertExists(businessId, id);
    const used = await this.prisma.product.findFirst({
      where: {
        id,
        businessId,
        OR: [
          { purchaseLines: { some: {} } },
          { saleLines: { some: {} } },
          { inventoryTx: { some: {} } },
          { stockChecks: { some: {} } },
        ],
      },
      select: { id: true },
    });
    if (used) return this.prisma.product.update({ where: { id }, data: { active: false } });
    await this.prisma.$transaction([
      this.prisma.variant.deleteMany({ where: { businessId, productId: id } }),
      this.prisma.attributeDef.deleteMany({ where: { businessId, productId: id } }),
      this.prisma.productItem.deleteMany({ where: { businessId, productId: id } }),
      this.prisma.productCategory.deleteMany({ where: { businessId, productId: id } }),
      this.prisma.product.delete({ where: { id } }),
    ]);
    return { deleted: true, productId: id };
  }

  async createCategory(businessId: string, productId: string, dto: CreateCategoryDto) {
    await this.assertExists(businessId, productId);
    return this.prisma.productCategory.create({
      data: { businessId, productId, name: dto.name, description: dto.description },
    });
  }

  async updateCategory(businessId: string, id: string, dto: UpdateCategoryDto) {
    await this.assertCategory(businessId, id);
    return this.prisma.productCategory.update({ where: { id }, data: dto });
  }

  async removeCategory(businessId: string, id: string) {
    await this.assertCategory(businessId, id);
    const [purchases, sales] = await this.prisma.$transaction([
      this.prisma.purchaseLine.count({ where: { purchase: { businessId }, categoryId: id } }),
      this.prisma.saleLine.count({ where: { sale: { businessId }, categoryId: id } }),
    ]);
    if (purchases || sales) {
      return this.prisma.productCategory.update({ where: { id }, data: { active: false } });
    }
    await this.prisma.$transaction([
      this.prisma.variant.deleteMany({ where: { businessId, categoryId: id } }),
      this.prisma.productCategory.delete({ where: { id } }),
    ]);
    return { deleted: true, categoryId: id };
  }

  async createAttribute(businessId: string, productId: string, dto: CreateAttributeDto) {
    await this.assertExists(businessId, productId);
    if (dto.categoryId) {
      const category = await this.assertCategory(businessId, dto.categoryId);
      if (category.productId !== productId) {
        throw new BadRequestException("Category does not belong to product");
      }
    }
    return this.prisma.attributeDef.create({
      data: {
        businessId,
        productId,
        categoryId: dto.categoryId,
        name: dto.name,
        key: dto.key,
        type: dto.type,
        required: dto.required ?? false,
        unit: dto.unit,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async updateAttribute(businessId: string, id: string, dto: UpdateAttributeDto) {
    await this.assertAttribute(businessId, id);
    return this.prisma.attributeDef.update({ where: { id }, data: dto });
  }

  async removeAttribute(businessId: string, id: string) {
    const def = await this.assertAttribute(businessId, id);
    const variants = await this.prisma.variant.findMany({
      where: { businessId, productId: def.productId },
      select: { attributes: true },
    });
    if (variants.some((v) => Object.prototype.hasOwnProperty.call(v.attributes as object, def.key))) {
      return this.prisma.attributeDef.update({ where: { id }, data: { active: false } });
    }
    await this.prisma.attributeDef.delete({ where: { id } });
    return { deleted: true, attributeDefId: id };
  }

  async reorderAttributes(businessId: string, productId: string, dto: ReorderDto) {
    await this.assertExists(businessId, productId);
    const owned = await this.prisma.attributeDef.count({
      where: { businessId, productId, id: { in: dto.ids } },
    });
    if (owned !== dto.ids.length) {
      throw new BadRequestException("One or more attributes were not found");
    }
    await this.prisma.$transaction(
      dto.ids.map((id, sortOrder) =>
        this.prisma.attributeDef.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return { reordered: dto.ids.length };
  }

  async createOption(businessId: string, attributeDefId: string, dto: CreateOptionDto) {
    await this.assertAttribute(businessId, attributeDefId);
    return this.prisma.attributeOption.create({
      data: {
        attributeDefId,
        label: dto.label,
        value: dto.value,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async updateOption(businessId: string, id: string, dto: UpdateOptionDto) {
    await this.assertOption(businessId, id);
    return this.prisma.attributeOption.update({ where: { id }, data: dto });
  }

  async removeOption(businessId: string, id: string) {
    const option = await this.assertOption(businessId, id);
    const variants = await this.prisma.variant.findMany({
      where: { businessId, productId: option.def.productId },
      select: { attributes: true },
    });
    if (
      variants.some(
        (variant) =>
          (variant.attributes as Record<string, unknown>)[option.def.key] === option.label,
      )
    ) {
      return this.prisma.attributeOption.update({ where: { id }, data: { active: false } });
    }
    await this.prisma.attributeOption.delete({ where: { id } });
    return { deleted: true, optionId: id };
  }

  async reorderOptions(businessId: string, attributeDefId: string, dto: ReorderDto) {
    await this.assertAttribute(businessId, attributeDefId);
    const owned = await this.prisma.attributeOption.count({
      where: { attributeDefId, id: { in: dto.ids } },
    });
    if (owned !== dto.ids.length) {
      throw new BadRequestException("One or more options were not found");
    }
    await this.prisma.$transaction(
      dto.ids.map((id, sortOrder) =>
        this.prisma.attributeOption.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return { reordered: dto.ids.length };
  }

  /**
   * Variant identity is a normalised key over its attribute assignments —
   * never the display name (§ data rules mirrored from the client).
   */
  async createVariant(businessId: string, productId: string, dto: CreateVariantDto) {
    await this.assertExists(businessId, productId);
    if (dto.categoryId) {
      const category = await this.assertCategory(businessId, dto.categoryId);
      if (category.productId !== productId) {
        throw new BadRequestException("Category does not belong to product");
      }
    }
    const attributes = Object.fromEntries(
      Object.entries(dto.attributes)
        .map(([key, value]) => [key.trim(), value.trim()])
        .filter(([key, value]) => key.length > 0 && value.length > 0),
    );
    const defs = await this.prisma.attributeDef.findMany({
      where: { businessId, productId, categoryId: dto.categoryId ?? null, active: true },
    });
    const missing = defs.find((def) => def.required && !attributes[def.key]);
    if (missing) throw new BadRequestException(`Missing required attribute: ${missing.name}`);
    const scope = dto.categoryId ?? productId;
    const identityKey = `${scope}|${Object.entries(attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("|")}`;

    const shortName = dto.shortName?.trim() || Object.values(attributes).join(" · ");

    try {
      return await this.prisma.variant.create({
        data: {
          businessId,
          productId,
          categoryId: dto.categoryId,
          identityKey,
          key: identityKey,
          attributes,
          shortName,
        },
      });
    } catch {
      throw new ConflictException("This variant already exists");
    }
  }

  async updateVariant(businessId: string, id: string, dto: UpdateVariantDto) {
    await this.assertVariant(businessId, id);
    return this.prisma.variant.update({ where: { id }, data: dto });
  }

  async removeVariant(businessId: string, id: string) {
    await this.assertVariant(businessId, id);
    const [purchases, sales] = await this.prisma.$transaction([
      this.prisma.purchaseLine.count({ where: { purchase: { businessId }, variantId: id } }),
      this.prisma.saleLine.count({ where: { sale: { businessId }, variantId: id } }),
    ]);
    if (purchases || sales) {
      return this.prisma.variant.update({ where: { id }, data: { active: false } });
    }
    await this.prisma.variant.delete({ where: { id } });
    return { deleted: true, variantId: id };
  }

  private async assertExists(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found");
  }

  private async assertCategory(businessId: string, id: string) {
    const category = await this.prisma.productCategory.findFirst({ where: { id, businessId } });
    if (!category) throw new NotFoundException("Category not found");
    return category;
  }

  private async assertAttribute(businessId: string, id: string) {
    const attribute = await this.prisma.attributeDef.findFirst({ where: { id, businessId } });
    if (!attribute) throw new NotFoundException("Attribute not found");
    return attribute;
  }

  private async assertOption(businessId: string, id: string) {
    const option = await this.prisma.attributeOption.findFirst({
      where: { id, def: { businessId } },
      include: { def: true },
    });
    if (!option) throw new NotFoundException("Option not found");
    return option;
  }

  private async assertVariant(businessId: string, id: string) {
    const variant = await this.prisma.variant.findFirst({ where: { id, businessId } });
    if (!variant) throw new NotFoundException("Variant not found");
    return variant;
  }
}
