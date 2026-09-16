import { AuthUser } from "../common/decorators/current-user.decorator";
import { StockChecksService } from "./stock-checks.service";
import { CreateStockCheckDto } from "./dto/create-stock-check.dto";
export declare class StockChecksController {
    private readonly stockChecksService;
    constructor(stockChecksService: StockChecksService);
    create(user: AuthUser, dto: CreateStockCheckDto): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string;
        date: Date;
        physicalQty: import("@prisma/client/runtime/library").Decimal;
        systemQty: import("@prisma/client/runtime/library").Decimal;
    }>;
    list(user: AuthUser, from?: string, to?: string): import(".prisma/client").Prisma.PrismaPromise<({
        product: {
            name: string;
            id: string;
            unit: string;
        };
    } & {
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string;
        date: Date;
        physicalQty: import("@prisma/client/runtime/library").Decimal;
        systemQty: import("@prisma/client/runtime/library").Decimal;
    })[]>;
}
