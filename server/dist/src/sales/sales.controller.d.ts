import { AuthUser } from "../common/decorators/current-user.decorator";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
export declare class SalesController {
    private readonly salesService;
    constructor(salesService: SalesService);
    create(user: AuthUser, dto: CreateSaleDto): Promise<{
        sale: {
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
                purchaseId: string | null;
                qualityName: string | null;
                saleId: string;
            }[];
        } & {
            id: string;
            businessId: string;
            createdAt: Date;
            date: Date;
            notes: string | null;
            customerId: string;
            discountPct: import("@prisma/client/runtime/library").Decimal;
            taxPct: import("@prisma/client/runtime/library").Decimal;
            loadingCharges: import("@prisma/client/runtime/library").Decimal;
            transportCharges: import("@prisma/client/runtime/library").Decimal;
            labourCharges: import("@prisma/client/runtime/library").Decimal;
        };
        invoice: {
            total: number;
            number: string;
            id: string;
            businessId: string;
            createdAt: Date;
            paid: import("@prisma/client/runtime/library").Decimal;
            saleId: string;
        };
    }>;
    list(user: AuthUser, pagination: PaginationDto, customerId?: string): Promise<import("../common/dto/pagination.dto").Paginated<{
        customer: {
            name: string;
            id: string;
            shop: string;
        };
        invoice: {
            number: string;
            id: string;
            businessId: string;
            createdAt: Date;
            paid: import("@prisma/client/runtime/library").Decimal;
            total: import("@prisma/client/runtime/library").Decimal;
            saleId: string;
        } | null;
    } & {
        id: string;
        businessId: string;
        createdAt: Date;
        date: Date;
        notes: string | null;
        customerId: string;
        discountPct: import("@prisma/client/runtime/library").Decimal;
        taxPct: import("@prisma/client/runtime/library").Decimal;
        loadingCharges: import("@prisma/client/runtime/library").Decimal;
        transportCharges: import("@prisma/client/runtime/library").Decimal;
        labourCharges: import("@prisma/client/runtime/library").Decimal;
    }>>;
    byId(user: AuthUser, id: string): Promise<{
        customer: {
            name: string;
            id: string;
            businessId: string;
            createdAt: Date;
            active: boolean;
            phone: string;
            shop: string;
        };
        invoice: {
            number: string;
            id: string;
            businessId: string;
            createdAt: Date;
            paid: import("@prisma/client/runtime/library").Decimal;
            total: import("@prisma/client/runtime/library").Decimal;
            saleId: string;
        } | null;
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
            purchaseId: string | null;
            qualityName: string | null;
            saleId: string;
        })[];
    } & {
        id: string;
        businessId: string;
        createdAt: Date;
        date: Date;
        notes: string | null;
        customerId: string;
        discountPct: import("@prisma/client/runtime/library").Decimal;
        taxPct: import("@prisma/client/runtime/library").Decimal;
        loadingCharges: import("@prisma/client/runtime/library").Decimal;
        transportCharges: import("@prisma/client/runtime/library").Decimal;
        labourCharges: import("@prisma/client/runtime/library").Decimal;
    }>;
    remove(user: AuthUser, id: string): Promise<{
        deleted: boolean;
        saleId: string;
    }>;
}
