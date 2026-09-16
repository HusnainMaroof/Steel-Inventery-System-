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
exports.InvoicesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let InvoicesService = class InvoicesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(businessId, skip, take, dueOnly) {
        return this.prisma.$transaction([
            this.prisma.invoice.findMany({
                where: {
                    businessId,
                    ...(dueOnly ? { total: { gt: this.prisma.invoice.fields.paid } } : {}),
                },
                skip,
                take,
                include: {
                    sale: { include: { customer: { select: { id: true, name: true, shop: true } } } },
                },
                orderBy: { createdAt: "desc" },
            }),
            this.prisma.invoice.count({
                where: {
                    businessId,
                    ...(dueOnly ? { total: { gt: this.prisma.invoice.fields.paid } } : {}),
                },
            }),
        ]);
    }
    async byId(businessId, id) {
        const invoice = await this.prisma.invoice.findFirst({
            where: { id, businessId },
            include: {
                sale: { include: { customer: true, lines: true, allocations: true } },
            },
        });
        if (!invoice)
            throw new common_1.NotFoundException("Invoice not found");
        return invoice;
    }
};
exports.InvoicesService = InvoicesService;
exports.InvoicesService = InvoicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvoicesService);
//# sourceMappingURL=invoices.service.js.map