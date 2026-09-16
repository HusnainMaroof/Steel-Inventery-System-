import { PrismaService } from "../prisma/prisma.service";
import { CreateStockCheckDto } from "./dto/create-stock-check.dto";
export declare class StockChecksService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreateStockCheckDto): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string;
        date: Date;
        physicalQty: import("@prisma/client/runtime/library").Decimal;
        systemQty: import("@prisma/client/runtime/library").Decimal;
    }>;
    systemQty(businessId: string, productId: string): Promise<{
        systemQty: number;
    }>;
    list(businessId: string, from?: string, to?: string): import(".prisma/client").Prisma.PrismaPromise<({
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
