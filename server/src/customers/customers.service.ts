import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(businessId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: { businessId, name: dto.name, shop: dto.shop, phone: dto.phone },
    });
  }

  async list(businessId: string, skip: number, take: number, search?: string) {
    const where: Prisma.CustomerWhereInput = {
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
    return [items, total] as const;
  }

  async byId(businessId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, businessId },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    return customer;
  }

  /**
   * Receivable history: each invoice with its paid/due — the balance is
   * never a stored number (§27).
   */
  async ledger(businessId: string, id: string) {
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

  async update(businessId: string, id: string, dto: UpdateCustomerDto) {
    await this.byId(businessId, id);
    return this.prisma.customer.update({
      where: { id },
      data: { name: dto.name, shop: dto.shop, phone: dto.phone },
    });
  }

  async deactivate(businessId: string, id: string) {
    await this.byId(businessId, id);
    return this.prisma.customer.update({
      where: { id },
      data: { active: false },
    });
  }
}
