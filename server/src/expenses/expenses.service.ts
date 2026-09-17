import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ExpenseCategory, Prisma } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(businessId: string, dto: CreateExpenseDto, actorId?: string) {
    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, businessId },
        select: { id: true },
      });
      if (!product) throw new BadRequestException("Product not found");
    }
    const expense = await this.prisma.expense.create({
      data: {
        businessId,
        date: new Date(dto.date),
        label: dto.label,
        category: dto.category,
        amount: dto.amount,
        productId: dto.productId, // absent = whole shop
      },
    });
    await this.audit.log({
      businessId,
      actorId: actorId ?? null,
      action: "expense.created",
      entityType: "expense",
      entityId: expense.id,
      metadata: { category: dto.category, amount: dto.amount },
    });
    return expense;
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
    const rows = await this.prisma.expense.groupBy({
      by: ["category"],
      where: {
        businessId,
        ...(productId ? { productId } : {}),
        date: { gte: new Date(from), lte: new Date(to) },
      },
      _sum: { amount: true },
    });
    return rows
      .map((row) => ({
        category: row.category as ExpenseCategory,
        amount: Number(row._sum.amount ?? 0),
      }))
      .filter((row) => row.amount > 0.001)
      .sort((a, b) => b.amount - a.amount);
  }

  async byId(businessId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, businessId } });
    if (!expense) throw new NotFoundException("Expense not found");
    return expense;
  }

  async remove(businessId: string, id: string, actorId?: string) {
    await this.byId(businessId, id);
    await this.prisma.expense.delete({ where: { id } });
    await this.audit.log({
      businessId,
      actorId: actorId ?? null,
      action: "expense.deleted",
      entityType: "expense",
      entityId: id,
    });
    return { deleted: true, expenseId: id };
  }
}
