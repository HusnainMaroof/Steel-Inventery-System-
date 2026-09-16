import { AuthUser } from "../common/decorators/current-user.decorator";
import { InvoicesService } from "./invoices.service";
import { PaginationDto } from "../common/dto/pagination.dto";
export declare class InvoicesController {
    private readonly invoicesService;
    constructor(invoicesService: InvoicesService);
    list(user: AuthUser, pagination: PaginationDto, dueOnly?: string): Promise<import("../common/dto/pagination.dto").Paginated<{
        sale: {
            customer: {
                name: string;
                id: string;
                shop: string;
            };
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
    } & {
        number: string;
        id: string;
        businessId: string;
        createdAt: Date;
        paid: import("@prisma/client/runtime/library").Decimal;
        total: import("@prisma/client/runtime/library").Decimal;
        saleId: string;
    }>>;
    byId(user: AuthUser, id: string): Promise<{
        sale: {
            customer: {
                name: string;
                id: string;
                businessId: string;
                createdAt: Date;
                active: boolean;
                phone: string;
                shop: string;
            };
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
            allocations: {
                id: string;
                businessId: string;
                saleId: string;
                amount: import("@prisma/client/runtime/library").Decimal;
                paymentId: string;
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
    } & {
        number: string;
        id: string;
        businessId: string;
        createdAt: Date;
        paid: import("@prisma/client/runtime/library").Decimal;
        total: import("@prisma/client/runtime/library").Decimal;
        saleId: string;
    }>;
}
