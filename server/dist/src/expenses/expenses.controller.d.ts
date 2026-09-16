import { AuthUser } from "../common/decorators/current-user.decorator";
import { ExpensesService } from "./expenses.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
export declare class ExpensesController {
    private readonly expensesService;
    constructor(expensesService: ExpensesService);
    create(user: AuthUser, dto: CreateExpenseDto): import(".prisma/client").Prisma.Prisma__ExpenseClient<{
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string | null;
        date: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        label: string;
        category: import(".prisma/client").$Enums.ExpenseCategory;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    list(user: AuthUser, pagination: PaginationDto, productId?: string, from?: string, to?: string): Promise<import("../common/dto/pagination.dto").Paginated<{
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string | null;
        date: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        label: string;
        category: import(".prisma/client").$Enums.ExpenseCategory;
    }>>;
    byId(user: AuthUser, id: string): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string | null;
        date: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        label: string;
        category: import(".prisma/client").$Enums.ExpenseCategory;
    }>;
}
