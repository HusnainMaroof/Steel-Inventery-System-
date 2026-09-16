import { PrismaService } from "../prisma/prisma.service";
export declare class InvoicesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(businessId: string, skip: number, take: number, dueOnly: boolean): Promise<[({
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
    })[], number]>;
    byId(businessId: string, id: string): Promise<{
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
