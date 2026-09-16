import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
export declare class SuppliersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreateSupplierDto): Prisma.Prisma__SupplierClient<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        mill: string;
        phone: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    list(businessId: string, skip: number, take: number, search?: string): Promise<readonly [{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        mill: string;
        phone: string;
    }[], number]>;
    byId(businessId: string, id: string): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        mill: string;
        phone: string;
    }>;
    payables(businessId: string, id: string): Promise<{
        rows: {
            purchaseId: string;
            date: Date;
            goodsTotal: number;
            paid: number;
            due: number;
        }[];
        totalDue: number;
    }>;
    update(businessId: string, id: string, dto: UpdateSupplierDto): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        mill: string;
        phone: string;
    }>;
    deactivate(businessId: string, id: string): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        mill: string;
        phone: string;
    }>;
}
