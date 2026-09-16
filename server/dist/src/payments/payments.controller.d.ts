import { AuthUser } from "../common/decorators/current-user.decorator";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    create(user: AuthUser, dto: CreatePaymentDto): Promise<{
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
    list(user: AuthUser, pagination: PaginationDto, type?: "customer" | "supplier"): Promise<import("../common/dto/pagination.dto").Paginated<{
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
