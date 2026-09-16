import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";

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

  list(businessId: string) {
    return this.prisma.product.findMany({
      where: { businessId, active: true },
      include: { categories: true, variants: true },
      orderBy: { createdAt: "asc" },
    });
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
      },
    });
  }

  async deactivate(businessId: string, id: string) {
    await this.assertExists(businessId, id);
    return this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }

  createCategory(businessId: string, productId: string, dto: CreateCategoryDto) {
    return this.prisma.productCategory.create({
      data: { businessId, productId, name: dto.name, description: dto.description },
    });
  }

  /**
   * Variant identity is a normalised key over its attribute assignments —
   * never the display name (§ data rules mirrored from the client).
   */
  async createVariant(businessId: string, productId: string, dto: CreateVariantDto) {
    const identityKey = Object.entries(dto.attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("|");

    const shortName = Object.values(dto.attributes).join(" · ");

    return this.prisma.variant.create({
      data: {
        businessId,
        productId,
        categoryId: dto.categoryId,
        identityKey,
        key: identityKey,
        attributes: dto.attributes,
        shortName,
      },
    });
  }

  private async assertExists(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found");
  }
}
