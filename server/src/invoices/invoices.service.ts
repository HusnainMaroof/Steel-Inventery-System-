import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  list(businessId: string, skip: number, take: number, dueOnly: boolean) {
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

  async byId(businessId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
      include: {
        sale: { include: { customer: true, lines: true, allocations: true } },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return invoice;
  }
}
