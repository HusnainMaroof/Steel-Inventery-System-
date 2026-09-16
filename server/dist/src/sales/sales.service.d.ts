import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
export declare class SalesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreateSaleDto): Promise<{
        sale: {
            lines: {
                id: string;
                unit: string;
                categoryId: string | null;
                productId: string;
                qty: Prisma.Decimal;
                variantId: string | null;
                item: string;
                attributeSnapshot: Prisma.JsonValue | null;
                rate: Prisma.Decimal;
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
            discountPct: Prisma.Decimal;
            taxPct: Prisma.Decimal;
            loadingCharges: Prisma.Decimal;
            transportCharges: Prisma.Decimal;
            labourCharges: Prisma.Decimal;
        };
        invoice: {
            total: number;
            number: string;
            id: string;
            businessId: string;
            createdAt: Date;
            paid: Prisma.Decimal;
            saleId: string;
        };
    }>;
    list(businessId: string, skip: number, take: number, customerId?: string): Promise<readonly [({
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
            paid: Prisma.Decimal;
            total: Prisma.Decimal;
            saleId: string;
        } | null;
    } & {
        id: string;
        businessId: string;
        createdAt: Date;
        date: Date;
        notes: string | null;
        customerId: string;
        discountPct: Prisma.Decimal;
        taxPct: Prisma.Decimal;
        loadingCharges: Prisma.Decimal;
        transportCharges: Prisma.Decimal;
        labourCharges: Prisma.Decimal;
    })[], number]>;
    byId(businessId: string, id: string): Promise<{
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
            paid: Prisma.Decimal;
            total: Prisma.Decimal;
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
            qty: Prisma.Decimal;
            variantId: string | null;
            item: string;
            attributeSnapshot: Prisma.JsonValue | null;
            rate: Prisma.Decimal;
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
        discountPct: Prisma.Decimal;
        taxPct: Prisma.Decimal;
        loadingCharges: Prisma.Decimal;
        transportCharges: Prisma.Decimal;
        labourCharges: Prisma.Decimal;
    }>;
    remove(businessId: string, id: string): Promise<{
        deleted: boolean;
        saleId: string;
    }>;
}
