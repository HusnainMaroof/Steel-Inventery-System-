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
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let InventoryService = class InventoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async stock(businessId) {
        const grouped = await this.prisma.inventoryTransaction.groupBy({
            by: ["productId"],
            where: { businessId },
            _sum: { qty: true },
        });
        const products = await this.prisma.product.findMany({
            where: { businessId, active: true },
            select: { id: true, name: true, unit: true },
        });
        const sums = new Map(grouped.map((g) => [g.productId, g._sum.qty ?? 0]));
        return products.map((p) => ({
            productId: p.id,
            productName: p.name,
            unit: p.unit,
            qty: sums.get(p.id) ?? 0,
        }));
    }
    movements(businessId, filter) {
        return this.prisma.inventoryTransaction.findMany({
            where: {
                businessId,
                ...(filter.productId ? { productId: filter.productId } : {}),
                ...(filter.from || filter.to
                    ? {
                        date: {
                            ...(filter.from ? { gte: new Date(filter.from) } : {}),
                            ...(filter.to ? { lte: new Date(filter.to) } : {}),
                        },
                    }
                    : {}),
            },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            take: 500,
        });
    }
    async adjust(businessId, dto) {
        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.findFirst({
                where: { id: dto.productId, businessId },
                select: { id: true },
            });
            if (!product) {
                throw new common_1.BadRequestException("Product not found");
            }
            return tx.inventoryTransaction.create({
                data: {
                    businessId,
                    productId: dto.productId,
                    type: "ADJUSTMENT",
                    qty: dto.qty,
                    referenceType: "ADJUSTMENT",
                    referenceId: "MANUAL",
                    date: new Date(dto.date),
                },
            });
        });
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map