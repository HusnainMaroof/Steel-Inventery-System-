import { AuthUser } from "../common/decorators/current-user.decorator";
import { InventoryService } from "./inventory.service";
import { AdjustInventoryDto } from "./dto/adjust-inventory.dto";
export declare class InventoryController {
    private readonly inventoryService;
    constructor(inventoryService: InventoryService);
    stock(user: AuthUser): Promise<{
        productId: string;
        productName: string;
        unit: string;
        qty: number | import("@prisma/client/runtime/library").Decimal;
    }[]>;
    movements(user: AuthUser, productId?: string, from?: string, to?: string): import(".prisma/client").Prisma.PrismaPromise<{
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
    adjust(user: AuthUser, dto: AdjustInventoryDto): Promise<{
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
