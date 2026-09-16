import { Injectable, NotFoundException } from "@nestjs/common";
import { ExpenseCategory, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  create(businessId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        businessId,
        date: new Date(dto.date),
        label: dto.label,
        category: dto.category,
        amount: dto.amount,
        productId: dto.productId, // absent = whole shop
      },
    });
  }

  async list(
    businessId: string,
    skip: number,
    take: number,
    filter: { productId?: string; from?: string; to?: string },
  ) {
    const where: Prisma.ExpenseWhereInput = {
      businessId,
      // product filter shows only that product's own tagged expenses;
      // shop-wide expenses belong to the All Products view.
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
    return [items, total] as const;
  }

  /** Category totals for the period — only categories actually used. */
  async totalsByCategory(
    businessId: string,
    from: string,
    to: string,
    productId?: string,
  ) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        businessId,
        ...(productId ? { productId } : {}),
        date: { gte: new Date(from), lte: new Date(to) },
      },
      select: { category: true, amount: true },
    });
    const totals = new Map<ExpenseCategory, number>();
    for (const e of expenses) {
      totals.set(e.category, (totals.get(e.category) ?? 0) + Number(e.amount));
    }
    return [...totals.entries()]
      .filter(([, amount]) => amount > 0.001)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  async byId(businessId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, businessId } });
    if (!expense) throw new NotFoundException("Expense not found");
    return expense;
  }
}
