import { PrismaService } from "../prisma/prisma.service";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
export declare class PurchasesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreatePurchaseDto): Promise<{
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
    list(businessId: string, skip: number, take: number, supplierId?: string): Promise<readonly [({
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
    })[], number]>;
    byId(businessId: string, id: string): Promise<{
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
