import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
export declare class ExpensesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreateExpenseDto): Prisma.Prisma__ExpenseClient<{
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string | null;
        date: Date;
        amount: Prisma.Decimal;
        label: string;
        category: import(".prisma/client").$Enums.ExpenseCategory;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    list(businessId: string, skip: number, take: number, filter: {
        productId?: string;
        from?: string;
        to?: string;
    }): Promise<readonly [{
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string | null;
        date: Date;
        amount: Prisma.Decimal;
        label: string;
        category: import(".prisma/client").$Enums.ExpenseCategory;
    }[], number]>;
    totalsByCategory(businessId: string, from: string, to: string, productId?: string): Promise<{
        category: import(".prisma/client").$Enums.ExpenseCategory;
        amount: number;
    }[]>;
    byId(businessId: string, id: string): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string | null;
        date: Date;
        amount: Prisma.Decimal;
        label: string;
        category: import(".prisma/client").$Enums.ExpenseCategory;
    }>;
}
