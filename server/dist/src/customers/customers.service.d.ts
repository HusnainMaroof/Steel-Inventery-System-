import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
export declare class CustomersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreateCustomerDto): Prisma.Prisma__CustomerClient<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        phone: string;
        shop: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    list(businessId: string, skip: number, take: number, search?: string): Promise<readonly [{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        phone: string;
        shop: string;
    }[], number]>;
    byId(businessId: string, id: string): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        phone: string;
        shop: string;
    }>;
    ledger(businessId: string, id: string): Promise<{
        rows: {
            saleId: string;
            invoiceNo: string | undefined;
            date: Date;
            total: number;
            paid: number;
            due: number;
        }[];
        totalDue: number;
    }>;
    update(businessId: string, id: string, dto: UpdateCustomerDto): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        phone: string;
        shop: string;
    }>;
    deactivate(businessId: string, id: string): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        phone: string;
        shop: string;
    }>;
}
