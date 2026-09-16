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
exports.StockChecksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let StockChecksService = class StockChecksService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(businessId, dto) {
        const { systemQty } = await this.systemQty(businessId, dto.productId);
        return this.prisma.stockCheck.create({
            data: {
                businessId,
                date: new Date(dto.date),
                productId: dto.productId,
                physicalQty: dto.physicalQty,
                systemQty,
            },
        });
    }
    async systemQty(businessId, productId) {
        const grouped = await this.prisma.inventoryTransaction.aggregate({
            where: { businessId, productId },
            _sum: { qty: true },
        });
        return { systemQty: Number(grouped._sum.qty ?? 0) };
    }
    list(businessId, from, to) {
        return this.prisma.stockCheck.findMany({
            where: {
                businessId,
                ...(from || to
                    ? {
                        date: {
                            ...(from ? { gte: new Date(from) } : {}),
                            ...(to ? { lte: new Date(to) } : {}),
                        },
                    }
                    : {}),
            },
            include: { product: { select: { id: true, name: true, unit: true } } },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            take: 500,
        });
    }
};
exports.StockChecksService = StockChecksService;
exports.StockChecksService = StockChecksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockChecksService);
//# sourceMappingURL=stock-checks.service.js.map