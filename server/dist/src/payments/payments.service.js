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
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const payment_settlement_1 = require("../domain/payment-settlement");
let PaymentsService = class PaymentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(businessId, dto) {
        return this.prisma.$transaction(async (tx) => {
            if (dto.type === "CUSTOMER") {
                if (!dto.customerId) {
                    throw new common_1.BadRequestException("Customer payments need customerId");
                }
                const customer = await tx.customer.findFirst({
                    where: { id: dto.customerId, businessId },
                    select: { id: true },
                });
                if (!customer)
                    throw new common_1.BadRequestException("Customer not found");
                const payment = await tx.payment.create({
                    data: {
                        businessId,
                        date: new Date(dto.date),
                        type: "CUSTOMER",
                        customerId: dto.customerId,
                        amount: dto.amount,
                        method: dto.method ?? "CASH",
                        saleId: dto.saleId,
                        note: dto.note,
                    },
                });
                if (dto.saleId) {
                    const invoice = await tx.invoice.findFirst({
                        where: { businessId, saleId: dto.saleId },
                    });
                    if (!invoice)
                        throw new common_1.BadRequestException("Invoice not found");
                    const due = Number(invoice.total) - Number(invoice.paid);
                    if (dto.amount > due + 0.005) {
                        throw new common_1.BadRequestException(`Payment (${dto.amount}) exceeds the remaining due (${Math.max(0, due)})`);
                    }
                    await tx.invoice.update({
                        where: { id: invoice.id },
                        data: { paid: Number(invoice.paid) + dto.amount },
                    });
                    await tx.paymentAllocation.create({
                        data: {
                            businessId,
                            paymentId: payment.id,
                            saleId: dto.saleId,
                            amount: dto.amount,
                        },
                    });
                }
                else {
                    const sales = await tx.sale.findMany({
                        where: {
                            businessId,
                            customerId: dto.customerId,
                            invoice: { total: { gt: 0 } },
                        },
                        include: { invoice: true },
                        orderBy: { date: "asc" },
                    });
                    const open = sales
                        .filter((s) => s.invoice)
                        .map((s) => ({
                        saleId: s.id,
                        total: Number(s.invoice.total),
                        paidSoFar: Number(s.invoice.paid),
                        date: s.date.toISOString().slice(0, 10),
                    }));
                    const { allocations } = (0, payment_settlement_1.settleFifo)(open, dto.amount);
                    for (const a of allocations) {
                        await tx.paymentAllocation.create({
                            data: {
                                businessId,
                                paymentId: payment.id,
                                saleId: a.saleId,
                                amount: a.amount,
                            },
                        });
                        await tx.invoice.updateMany({
                            where: { businessId, saleId: a.saleId },
                            data: { paid: { increment: a.amount } },
                        });
                    }
                }
                return payment;
            }
            if (!dto.supplierId) {
                throw new common_1.BadRequestException("Supplier payments need supplierId");
            }
            const supplier = await tx.supplier.findFirst({
                where: { id: dto.supplierId, businessId },
                select: { id: true },
            });
            if (!supplier)
                throw new common_1.BadRequestException("Supplier not found");
            return tx.payment.create({
                data: {
                    businessId,
                    date: new Date(dto.date),
                    type: "SUPPLIER",
                    supplierId: dto.supplierId,
                    amount: dto.amount,
                    method: dto.method ?? "CASH",
                    note: dto.note,
                },
            });
        });
    }
    async list(businessId, skip, take, type) {
        const where = {
            businessId,
            ...(type
                ? { type: type === "customer" ? "CUSTOMER" : "SUPPLIER" }
                : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.payment.findMany({
                where,
                skip,
                take,
                include: {
                    customer: { select: { id: true, name: true, shop: true } },
                    supplier: { select: { id: true, name: true, mill: true } },
                    allocations: true,
                },
                orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            }),
            this.prisma.payment.count({ where }),
        ]);
        return [items, total];
    }
    async byId(businessId, id) {
        const payment = await this.prisma.payment.findFirst({
            where: { id, businessId },
            include: { allocations: true, customer: true, supplier: true },
        });
        if (!payment)
            throw new common_1.NotFoundException("Payment not found");
        return payment;
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map