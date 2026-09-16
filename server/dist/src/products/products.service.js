"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProductsService = class ProductsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(businessId, dto) {
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
    list(businessId) {
        return this.prisma.product.findMany({
            where: { businessId, active: true },
            include: { categories: true, variants: true },
            orderBy: { createdAt: "asc" },
        });
    }
    async byId(businessId, id) {
        const product = await this.prisma.product.findFirst({
            where: { id, businessId },
            include: { categories: true, items: true, attributeDefs: { include: { options: true } }, variants: true },
        });
        if (!product)
            throw new common_1.NotFoundException("Product not found");
        return product;
    }
    async update(businessId, id, dto) {
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
    async deactivate(businessId, id) {
        await this.assertExists(businessId, id);
        return this.prisma.product.update({
            where: { id },
            data: { active: false },
        });
    }
    createCategory(businessId, productId, dto) {
        return this.prisma.productCategory.create({
            data: { businessId, productId, name: dto.name, description: dto.description },
        });
    }
    async createVariant(businessId, productId, dto) {
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
    async assertExists(businessId, id) {
        const product = await this.prisma.product.findFirst({
            where: { id, businessId },
            select: { id: true },
        });
        if (!product)
            throw new common_1.NotFoundException("Product not found");
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);
//# sourceMappingURL=products.service.js.map