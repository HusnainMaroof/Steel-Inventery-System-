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
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CustomersService = class CustomersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(businessId, dto) {
        return this.prisma.customer.create({
            data: { businessId, name: dto.name, shop: dto.shop, phone: dto.phone },
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
                        { shop: { contains: search, mode: "insensitive" } },
                        { phone: { contains: search } },
                    ],
                }
                : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.customer.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "asc" },
            }),
            this.prisma.customer.count({ where }),
        ]);
        return [items, total];
    }
    async byId(businessId, id) {
        const customer = await this.prisma.customer.findFirst({
            where: { id, businessId },
        });
        if (!customer)
            throw new common_1.NotFoundException("Customer not found");
        return customer;
    }
    async ledger(businessId, id) {
        await this.byId(businessId, id);
        const sales = await this.prisma.sale.findMany({
            where: { businessId, customerId: id },
            include: { invoice: true },
            orderBy: { date: "asc" },
        });
        const rows = sales.map((s) => ({
            saleId: s.id,
            invoiceNo: s.invoice?.number,
            date: s.date,
            total: Number(s.invoice?.total ?? 0),
            paid: Number(s.invoice?.paid ?? 0),
            due: Number(s.invoice?.total ?? 0) - Number(s.invoice?.paid ?? 0),
        }));
        const due = rows.reduce((sum, r) => sum + Math.max(0, r.due), 0);
        return { rows, totalDue: due };
    }
    async update(businessId, id, dto) {
        await this.byId(businessId, id);
        return this.prisma.customer.update({
            where: { id },
            data: { name: dto.name, shop: dto.shop, phone: dto.phone },
        });
    }
    async deactivate(businessId, id) {
        await this.byId(businessId, id);
        return this.prisma.customer.update({
            where: { id },
            data: { active: false },
        });
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomersService);
//# sourceMappingURL=customers.service.js.map