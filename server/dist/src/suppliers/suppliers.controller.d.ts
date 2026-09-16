import { AuthUser } from "../common/decorators/current-user.decorator";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
export declare class SuppliersController {
    private readonly suppliersService;
    constructor(suppliersService: SuppliersService);
    create(user: AuthUser, dto: CreateSupplierDto): import(".prisma/client").Prisma.Prisma__SupplierClient<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        mill: string;
        phone: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    list(user: AuthUser, pagination: PaginationDto, search?: string): Promise<import("../common/dto/pagination.dto").Paginated<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        mill: string;
        phone: string;
    }>>;
    payables(user: AuthUser, id: string): Promise<{
        rows: {
            purchaseId: string;
            date: Date;
            goodsTotal: number;
            paid: number;
            due: number;
        }[];
        totalDue: number;
    }>;
    update(user: AuthUser, id: string, dto: UpdateSupplierDto): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        mill: string;
        phone: string;
    }>;
    deactivate(user: AuthUser, id: string): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        mill: string;
        phone: string;
    }>;
}
