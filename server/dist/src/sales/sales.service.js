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
exports.SalesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const sale_availability_1 = require("../domain/sale-availability");
const money_1 = require("../domain/money");
let SalesService = class SalesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(businessId, dto) {
        if (dto.lines.length === 0) {
            throw new common_1.BadRequestException("A sale needs at least one line");
        }
        return this.prisma.$transaction(async (tx) => {
            const customer = await tx.customer.findFirst({
                where: { id: dto.customerId, businessId },
                select: { id: true },
            });
            if (!customer)
                throw new common_1.BadRequestException("Customer not found");
            const ledger = await tx.inventoryTransaction.groupBy({
                by: ["productId"],
                where: { businessId },
                _sum: { qty: true },
            });
            const levels = (0, sale_availability_1.stockLevelsFromLedger)(ledger.map((g) => ({ productId: g.productId, qty: Number(g._sum.qty ?? 0) })));
            const shortages = (0, sale_availability_1.findShortages)(levels, dto.lines.map((l) => ({ productId: l.productId, qty: l.qty })));
            if (shortages.length > 0) {
                const first = shortages[0];
                throw new common_1.BadRequestException(`Insufficient inventory for ${shortages.length} product(s) — ` +
                    `first shortage: requested ${first.requested}, available ${first.available}`);
            }
            const totals = (0, money_1.saleGrandTotal)(dto.lines.map((l) => ({ qty: l.qty, rate: l.rate })), {
                discountPct: dto.discountPct ?? 0,
                taxPct: dto.taxPct ?? 0,
                loading: dto.loadingCharges ?? 0,
                transport: dto.transportCharges ?? 0,
                labour: dto.labourCharges ?? 0,
            });
            const sale = await tx.sale.create({
                data: {
                    businessId,
                    date: new Date(dto.date),
                    customerId: dto.customerId,
                    notes: dto.notes,
                    discountPct: dto.discountPct ?? 0,
                    taxPct: dto.taxPct ?? 0,
                    loadingCharges: dto.loadingCharges ?? 0,
                    transportCharges: dto.transportCharges ?? 0,
                    labourCharges: dto.labourCharges ?? 0,
                    lines: {
                        create: dto.lines.map((line) => ({
                            productId: line.productId,
                            variantId: line.variantId,
                            categoryId: line.categoryId,
                            purchaseId: line.purchaseId,
                            item: line.item,
                            attributeSnapshot: line.attributeSnapshot ?? undefined,
                            qualityName: line.qualityName,
                            qty: line.qty,
                            unit: line.unit,
                            rate: line.rate,
                        })),
                    },
                },
                include: { lines: true },
            });
            await tx.inventoryTransaction.createMany({
                data: sale.lines.map((line) => ({
                    businessId,
                    productId: line.productId,
                    type: "SALE",
                    qty: -line.qty,
                    referenceType: "SALE",
                    referenceId: sale.id,
                    date: new Date(dto.date),
                })),
            });
            const count = await tx.invoice.count({ where: { businessId } });
            const invoice = await tx.invoice.create({
                data: {
                    businessId,
                    saleId: sale.id,
                    number: `INV-${String(count + 1).padStart(4, "0")}`,
                    total: totals.grandTotal,
                },
            });
            if (dto.paidNow && dto.paidNow > 0) {
                if (dto.paidNow > totals.grandTotal + 0.005) {
                    throw new common_1.BadRequestException(`Paid-now amount (${dto.paidNow}) exceeds the invoice total (${totals.grandTotal})`);
                }
                await tx.invoice.update({
                    where: { id: invoice.id },
                    data: { paid: dto.paidNow },
                });
            }
            return { sale, invoice: { ...invoice, total: totals.grandTotal } };
        });
    }
    async list(businessId, skip, take, customerId) {
        const where = {
            businessId,
            ...(customerId ? { customerId } : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.sale.findMany({
                where,
                skip,
                take,
                include: {
                    customer: { select: { id: true, name: true, shop: true } },
                    invoice: true,
                },
                orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            }),
            this.prisma.sale.count({ where }),
        ]);
        return [items, total];
    }
    async byId(businessId, id) {
        const sale = await this.prisma.sale.findFirst({
            where: { id, businessId },
            include: {
                customer: true,
                invoice: true,
                lines: { include: { product: { select: { id: true, name: true, unit: true } } } },
            },
        });
        if (!sale)
            throw new common_1.NotFoundException("Sale not found");
        return sale;
    }
    async remove(businessId, id) {
        return this.prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findFirst({
                where: { id, businessId },
                include: { invoice: true, lines: true },
            });
            if (!sale)
                throw new common_1.NotFoundException("Sale not found");
            await tx.inventoryTransaction.createMany({
                data: sale.lines.map((line) => ({
                    businessId,
                    productId: line.productId,
                    type: "RETURN",
                    qty: line.qty,
                    referenceType: "SALE_DELETE",
                    referenceId: sale.id,
                    date: new Date(),
                })),
            });
            if (sale.invoice) {
                await tx.paymentAllocation.deleteMany({
                    where: { saleId: sale.id },
                });
                await tx.invoice.delete({ where: { id: sale.invoice.id } });
            }
            await tx.sale.delete({ where: { id: sale.id } });
            return { deleted: true, saleId: sale.id };
        });
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SalesService);
//# sourceMappingURL=sales.service.js.map