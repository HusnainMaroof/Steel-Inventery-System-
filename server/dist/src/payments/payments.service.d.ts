import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
export declare class PaymentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreatePaymentDto): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.PaymentType;
        date: Date;
        supplierId: string | null;
        customerId: string | null;
        saleId: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        method: import(".prisma/client").$Enums.PaymentMethod;
        note: string | null;
    }>;
    list(businessId: string, skip: number, take: number, type?: "customer" | "supplier"): Promise<readonly [({
        supplier: {
            name: string;
            id: string;
            mill: string;
        } | null;
        customer: {
            name: string;
            id: string;
            shop: string;
        } | null;
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
        type: import(".prisma/client").$Enums.PaymentType;
        date: Date;
        supplierId: string | null;
        customerId: string | null;
        saleId: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        method: import(".prisma/client").$Enums.PaymentMethod;
        note: string | null;
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
        } | null;
        customer: {
            name: string;
            id: string;
            businessId: string;
            createdAt: Date;
            active: boolean;
            phone: string;
            shop: string;
        } | null;
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
        type: import(".prisma/client").$Enums.PaymentType;
        date: Date;
        supplierId: string | null;
        customerId: string | null;
        saleId: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        method: import(".prisma/client").$Enums.PaymentMethod;
        note: string | null;
    }>;
}
