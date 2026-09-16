import { PrismaService } from "../prisma/prisma.service";
import { AdjustInventoryDto } from "./dto/adjust-inventory.dto";
export declare class InventoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    stock(businessId: string): Promise<{
        productId: string;
        productName: string;
        unit: string;
        qty: number | import("@prisma/client/runtime/library").Decimal;
    }[]>;
    movements(businessId: string, filter: {
        productId?: string;
        from?: string;
        to?: string;
    }): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string;
        type: import(".prisma/client").$Enums.InventoryTxType;
        qty: import("@prisma/client/runtime/library").Decimal;
        date: Date;
        referenceType: string;
        referenceId: string;
    }[]>;
    adjust(businessId: string, dto: AdjustInventoryDto): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        productId: string;
        type: import(".prisma/client").$Enums.InventoryTxType;
        qty: import("@prisma/client/runtime/library").Decimal;
        date: Date;
        referenceType: string;
        referenceId: string;
    }>;
}
