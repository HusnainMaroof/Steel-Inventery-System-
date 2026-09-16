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
exports.SuppliersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const payment_settlement_1 = require("../domain/payment-settlement");
let SuppliersService = class SuppliersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(businessId, dto) {
        return this.prisma.supplier.create({
            data: { businessId, name: dto.name, mill: dto.mill, phone: dto.phone },
        });
    }
    async list(businessId, skip, take, search) {
        const where = {
            businessId,
            active: true,
            ...(search
                ? {
                    OR: [
                        { name: { contains: search, mode: "insensitive" } },
                        { mill: { contains: search, mode: "insensitive" } },
                        { phone: { contains: search } },
                    ],
                }
                : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.supplier.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "asc" },
            }),
            this.prisma.supplier.count({ where }),
        ]);
        return [items, total];
    }
    async byId(businessId, id) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id, businessId },
        });
        if (!supplier)
            throw new common_1.NotFoundException("Supplier not found");
        return supplier;
    }
    async payables(businessId, id) {
        await this.byId(businessId, id);
        const purchases = await this.prisma.purchase.findMany({
            where: { businessId, supplierId: id },
            include: { lines: true },
            orderBy: { date: "asc" },
        });
        const rows = purchases.map((p) => {
            const goodsTotal = Number(p.lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.rate), 0));
            const due = Math.max(0, goodsTotal - Number(p.paid));
            return {
                purchaseId: p.id,
                date: p.date,
                goodsTotal,
                paid: Number(p.paid),
                due,
            };
        });
        const totalDue = (0, payment_settlement_1.supplierPayable)(rows.map((r) => ({ goodsTotal: r.goodsTotal, paid: r.paid })));
        return { rows, totalDue };
    }
    async update(businessId, id, dto) {
        await this.byId(businessId, id);
        return this.prisma.supplier.update({
            where: { id },
            data: { name: dto.name, mill: dto.mill, phone: dto.phone },
        });
    }
    async deactivate(businessId, id) {
        await this.byId(businessId, id);
        return this.prisma.supplier.update({
            where: { id },
            data: { active: false },
        });
    }
};
exports.SuppliersService = SuppliersService;
exports.SuppliersService = SuppliersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SuppliersService);
//# sourceMappingURL=suppliers.service.js.map