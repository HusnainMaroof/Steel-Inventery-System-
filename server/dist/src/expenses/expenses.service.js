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
exports.ExpensesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ExpensesService = class ExpensesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(businessId, dto) {
        return this.prisma.expense.create({
            data: {
                businessId,
                date: new Date(dto.date),
                label: dto.label,
                category: dto.category,
                amount: dto.amount,
                productId: dto.productId,
            },
        });
    }
    async list(businessId, skip, take, filter) {
        const where = {
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
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.expense.findMany({ where, skip, take, orderBy: { date: "desc" } }),
            this.prisma.expense.count({ where }),
        ]);
        return [items, total];
    }
    async totalsByCategory(businessId, from, to, productId) {
        const expenses = await this.prisma.expense.findMany({
            where: {
                businessId,
                ...(productId ? { productId } : {}),
                date: { gte: new Date(from), lte: new Date(to) },
            },
            select: { category: true, amount: true },
        });
        const totals = new Map();
        for (const e of expenses) {
            totals.set(e.category, (totals.get(e.category) ?? 0) + Number(e.amount));
        }
        return [...totals.entries()]
            .filter(([, amount]) => amount > 0.001)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount);
    }
    async byId(businessId, id) {
        const expense = await this.prisma.expense.findFirst({ where: { id, businessId } });
        if (!expense)
            throw new common_1.NotFoundException("Expense not found");
        return expense;
    }
};
exports.ExpensesService = ExpensesService;
exports.ExpensesService = ExpensesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExpensesService);
//# sourceMappingURL=expenses.service.js.map