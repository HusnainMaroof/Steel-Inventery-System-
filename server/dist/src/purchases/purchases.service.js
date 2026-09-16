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
exports.PurchasesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PurchasesService = class PurchasesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(businessId, dto) {
        if (dto.lines.length === 0) {
            throw new common_1.BadRequestException("A purchase needs at least one line");
        }
        return this.prisma.$transaction(async (tx) => {
            const supplier = await tx.supplier.findFirst({
                where: { id: dto.supplierId, businessId },
                select: { id: true },
            });
            if (!supplier)
                throw new common_1.BadRequestException("Supplier not found");
            const purchase = await tx.purchase.create({
                data: {
                    businessId,
                    date: new Date(dto.date),
                    supplierId: dto.supplierId,
                    notes: dto.notes,
                    transport: dto.transport ?? 0,
                    loading: dto.loading ?? 0,
                    labour: dto.labour ?? 0,
                    otherCost: dto.otherCost ?? 0,
                    paid: dto.paid ?? 0,
                    lines: {
                        create: dto.lines.map((line) => ({
                            productId: line.productId,
                            variantId: line.variantId,
                            categoryId: line.categoryId,
                            item: line.item,
                            attributeSnapshot: line.attributeSnapshot ?? undefined,
                            qty: line.qty,
                            unit: line.unit,
                            rate: line.rate,
                            sellRate: line.sellRate,
                        })),
                    },
                },
                include: { lines: true },
            });
            await tx.inventoryTransaction.createMany({
                data: purchase.lines.map((line) => ({
                    businessId,
                    productId: line.productId,
                    type: "PURCHASE",
                    qty: line.qty,
                    referenceType: "PURCHASE",
                    referenceId: purchase.id,
                    date: new Date(dto.date),
                })),
            });
            return purchase;
        });
    }
    async list(businessId, skip, take, supplierId) {
        const where = {
            businessId,
            ...(supplierId ? { supplierId } : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.purchase.findMany({
                where,
                skip,
                take,
                include: {
                    supplier: { select: { id: true, name: true, mill: true } },
                    lines: { include: { product: { select: { id: true, name: true, unit: true } } } },
                },
                orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            }),
            this.prisma.purchase.count({ where }),
        ]);
        return [items, total];
    }
    async byId(businessId, id) {
        const purchase = await this.prisma.purchase.findFirst({
            where: { id, businessId },
            include: {
                supplier: true,
                lines: { include: { product: { select: { id: true, name: true, unit: true } } } },
            },
        });
        if (!purchase)
            throw new common_1.NotFoundException("Purchase not found");
        return purchase;
    }
};
exports.PurchasesService = PurchasesService;
exports.PurchasesService = PurchasesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PurchasesService);
//# sourceMappingURL=purchases.service.js.map