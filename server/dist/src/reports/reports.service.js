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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const profit_1 = require("../domain/profit");
const money_1 = require("../domain/money");
let ReportsService = class ReportsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async profit(businessId, input) {
        const period = this.periodOf(input);
        const productId = input.productId;
        const purchases = await this.prisma.purchase.findMany({
            where: {
                businessId,
                date: { gte: period.from, lte: period.to },
                ...(productId ? { lines: { some: { productId } } } : {}),
            },
            include: {
                lines: {
                    where: productId ? { productId } : undefined,
                    include: { product: { select: { id: true, name: true, unit: true } } },
                },
            },
            orderBy: { date: "asc" },
        });
        const sales = await this.prisma.sale.findMany({
            where: {
                businessId,
                date: { gte: period.from, lte: period.to },
                ...(productId ? { lines: { some: { productId } } } : {}),
            },
            include: {
                lines: {
                    where: productId ? { productId } : undefined,
                    include: { product: { select: { id: true, name: true, unit: true } } },
                },
            },
            orderBy: { date: "asc" },
        });
        const expenses = await this.prisma.expense.findMany({
            where: {
                businessId,
                date: { gte: period.from, lte: period.to },
                ...(productId ? { productId } : {}),
            },
        });
        const unitCostByPurchaseLine = new Map();
        for (const p of purchases) {
            const goods = p.lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.rate), 0);
            if (goods <= 0)
                continue;
            const charges = Number(p.transport) + Number(p.loading) + Number(p.labour) + Number(p.otherCost);
            for (const line of p.lines) {
                unitCostByPurchaseLine.set(line.id, ((Number(line.qty) * Number(line.rate) + charges * (Number(line.qty) * Number(line.rate)) / goods) || 0));
            }
        }
        const salesForProfit = sales.map((s) => ({
            saleId: s.id,
            lines: s.lines.map((l) => ({
                productId: l.productId,
                qty: Number(l.qty),
                rate: Number(l.rate),
                unitCost: unitCostByPurchaseLine.get(l.purchaseId ?? "") ?? 0,
            })),
            discountPct: Number(s.discountPct),
            taxPct: Number(s.taxPct),
            loading: Number(s.loadingCharges),
            transport: Number(s.transportCharges),
            labour: Number(s.labourCharges),
        }));
        const profit = (0, profit_1.computeProfit)(salesForProfit, expenses.map((e) => ({ productId: e.productId ?? undefined, amount: Number(e.amount) })), { productId });
        const products = await this.prisma.product.findMany({
            where: { businessId, active: true, ...(productId ? { id: productId } : {}) },
            select: { id: true, name: true, unit: true },
        });
        const allTx = await this.prisma.inventoryTransaction.findMany({
            where: { businessId, ...(productId ? { productId } : {}), date: { lte: period.to } },
            select: { productId: true, qty: true, date: true },
        });
        const openingBy = new Map();
        const closingBy = new Map();
        for (const t of allTx) {
            const q = Number(t.qty);
            closingBy.set(t.productId, (closingBy.get(t.productId) ?? 0) + q);
            if (t.date < period.from) {
                openingBy.set(t.productId, (openingBy.get(t.productId) ?? 0) + q);
            }
        }
        const stock = products.map((p) => ({
            productId: p.id,
            productName: p.name,
            unit: p.unit,
            openingQty: openingBy.get(p.id) ?? 0,
            remainingQty: closingBy.get(p.id) ?? 0,
        }));
        const invoices = await this.prisma.invoice.findMany({
            where: { businessId },
            include: { sale: { select: { customerId: true } } },
        });
        const customerDue = invoices.reduce((sum, i) => sum + Math.max(0, Number(i.total) - Number(i.paid)), 0);
        const purchasesAll = await this.prisma.purchase.findMany({
            where: { businessId },
            include: { lines: true },
        });
        const supplierDue = purchasesAll.reduce((sum, p) => {
            const goods = p.lines.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);
            return sum + Math.max(0, goods - Number(p.paid));
        }, 0);
        const paymentsInRange = await this.prisma.payment.findMany({
            where: { businessId, date: { gte: period.from, lte: period.to } },
        });
        const cashReceived = paymentsInRange
            .filter((p) => p.type === "CUSTOMER")
            .reduce((s, p) => s + Number(p.amount), 0);
        const cashPaid = paymentsInRange
            .filter((p) => p.type === "SUPPLIER")
            .reduce((s, p) => s + Number(p.amount), 0);
        const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
        const cashInHand = cashReceived - cashPaid - expensesTotal;
        const allPurchaseLines = await this.prisma.purchaseLine.findMany({
            where: { purchase: { businessId } },
            select: { productId: true, qty: true, rate: true, purchase: { select: { transport: true, loading: true, labour: true, otherCost: true } } },
        });
        const weight = new Map();
        for (const line of allPurchaseLines) {
            const goods = Number(line.qty) * Number(line.rate);
            const w = weight.get(line.productId) ?? { qty: 0, value: 0 };
            w.qty += Number(line.qty);
            w.value += goods;
            weight.set(line.productId, w);
        }
        const totalCharges = allPurchaseLines.reduce((sum, l) => sum +
            Number(l.purchase.transport) +
            Number(l.purchase.loading) +
            Number(l.purchase.labour) +
            Number(l.purchase.otherCost), 0);
        const totalGoods = allPurchaseLines.reduce((sum, l) => sum + Number(l.qty) * Number(l.rate), 0);
        const remainingValuation = products.reduce((sum, p) => {
            const w = weight.get(p.id);
            if (!w || w.qty <= 0)
                return sum;
            const avgLanded = (w.value + totalCharges * (w.value / (totalGoods || 1))) / w.qty;
            return sum + (closingBy.get(p.id) ?? 0) * avgLanded;
        }, 0);
        const businessValue = remainingValuation + customerDue + cashInHand;
        return {
            period: period.label,
            productScope: productId ?? "ALL_PRODUCTS",
            profit,
            stock,
            dues: { customerDue, supplierDue },
            cash: { cashReceived, cashPaid, expenses: expensesTotal, cashInHand },
            remainingValuation,
            businessValue,
            salesGrandTotals: sales.map((s) => (0, money_1.saleGrandTotal)(s.lines.map((l) => ({ qty: Number(l.qty), rate: Number(l.rate) })), {
                discountPct: Number(s.discountPct),
                taxPct: Number(s.taxPct),
                loading: Number(s.loadingCharges),
                transport: Number(s.transportCharges),
                labour: Number(s.labourCharges),
            }).grandTotal),
        };
    }
    periodOf(input) {
        const now = new Date();
        if (input.mode === "range" && (input.from || input.to)) {
            return {
                from: input.from ? new Date(input.from) : new Date("2000-01-01"),
                to: input.to ? new Date(input.to) : now,
                label: `${input.from ?? "start"} → ${input.to ?? "today"}`,
            };
        }
        if (input.mode === "year") {
            return {
                from: new Date(`${input.year}-01-01`),
                to: new Date(`${input.year}-12-31`),
                label: String(input.year),
            };
        }
        const month = input.month ?? now.getMonth() + 1;
        return {
            from: new Date(`${input.year}-${String(month).padStart(2, "0")}-01`),
            to: new Date(input.year, month, 0),
            label: `${input.year}-${String(month).padStart(2, "0")}`,
        };
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map