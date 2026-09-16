import { AuthUser } from "../common/decorators/current-user.decorator";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
export declare class CustomersController {
    private readonly customersService;
    constructor(customersService: CustomersService);
    create(user: AuthUser, dto: CreateCustomerDto): import(".prisma/client").Prisma.Prisma__CustomerClient<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        phone: string;
        shop: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    list(user: AuthUser, pagination: PaginationDto, search?: string): Promise<import("../common/dto/pagination.dto").Paginated<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        phone: string;
        shop: string;
    }>>;
    ledger(user: AuthUser, id: string): Promise<{
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
    update(user: AuthUser, id: string, dto: UpdateCustomerDto): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        phone: string;
        shop: string;
    }>;
    deactivate(user: AuthUser, id: string): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        active: boolean;
        phone: string;
        shop: string;
    }>;
}
