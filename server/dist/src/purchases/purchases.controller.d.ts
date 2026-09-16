import { AuthUser } from "../common/decorators/current-user.decorator";
import { PurchasesService } from "./purchases.service";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
export declare class PurchasesController {
    private readonly purchasesService;
    constructor(purchasesService: PurchasesService);
    create(user: AuthUser, dto: CreatePurchaseDto): Promise<{
        lines: {
            id: string;
            unit: string;
            categoryId: string | null;
            productId: string;
            qty: import("@prisma/client/runtime/library").Decimal;
            variantId: string | null;
            item: string;
            attributeSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
            rate: import("@prisma/client/runtime/library").Decimal;
            sellRate: import("@prisma/client/runtime/library").Decimal | null;
            purchaseId: string;
        }[];
    } & {
        id: string;
        businessId: string;
        createdAt: Date;
        date: Date;
        supplierId: string;
        notes: string | null;
        transport: import("@prisma/client/runtime/library").Decimal;
        loading: import("@prisma/client/runtime/library").Decimal;
        labour: import("@prisma/client/runtime/library").Decimal;
        otherCost: import("@prisma/client/runtime/library").Decimal;
        paid: import("@prisma/client/runtime/library").Decimal;
    }>;
    list(user: AuthUser, pagination: PaginationDto, supplierId?: string): Promise<import("../common/dto/pagination.dto").Paginated<{
        supplier: {
            name: string;
            id: string;
            mill: string;
        };
        lines: ({
            product: {
                name: string;
                id: string;
                unit: string;
            };
        } & {
            id: string;
            unit: string;
            categoryId: string | null;
            productId: string;
            qty: import("@prisma/client/runtime/library").Decimal;
            variantId: string | null;
            item: string;
            attributeSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
            rate: import("@prisma/client/runtime/library").Decimal;
            sellRate: import("@prisma/client/runtime/library").Decimal | null;
            purchaseId: string;
        })[];
    } & {
        id: string;
        businessId: string;
        createdAt: Date;
        date: Date;
        supplierId: string;
        notes: string | null;
        transport: import("@prisma/client/runtime/library").Decimal;
        loading: import("@prisma/client/runtime/library").Decimal;
        labour: import("@prisma/client/runtime/library").Decimal;
        otherCost: import("@prisma/client/runtime/library").Decimal;
        paid: import("@prisma/client/runtime/library").Decimal;
    }>>;
    byId(user: AuthUser, id: string): Promise<{
        supplier: {
            name: string;
            id: string;
            businessId: string;
            createdAt: Date;
            active: boolean;
            mill: string;
            phone: string;
        };
        lines: ({
            product: {
                name: string;
                id: string;
                unit: string;
            };
        } & {
            id: string;
            unit: string;
            categoryId: string | null;
            productId: string;
            qty: import("@prisma/client/runtime/library").Decimal;
            variantId: string | null;
            item: string;
            attributeSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
            rate: import("@prisma/client/runtime/library").Decimal;
            sellRate: import("@prisma/client/runtime/library").Decimal | null;
            purchaseId: string;
        })[];
    } & {
        id: string;
        businessId: string;
        createdAt: Date;
        date: Date;
        supplierId: string;
        notes: string | null;
        transport: import("@prisma/client/runtime/library").Decimal;
        loading: import("@prisma/client/runtime/library").Decimal;
        labour: import("@prisma/client/runtime/library").Decimal;
        otherCost: import("@prisma/client/runtime/library").Decimal;
        paid: import("@prisma/client/runtime/library").Decimal;
    }>;
}
