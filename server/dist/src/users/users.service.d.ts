import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { CreateUserDto } from "./dto/create-user.dto";
export declare class UsersService {
    private readonly prisma;
    private readonly authService;
    constructor(prisma: PrismaService, authService: AuthService);
    list(businessId: string): import(".prisma/client").Prisma.PrismaPromise<{
        email: string;
        name: string;
        id: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
    }[]>;
    byId(id: string): Promise<{
        email: string;
        name: string;
        id: string;
        role: import(".prisma/client").$Enums.Role;
        businessId: string;
    }>;
    create(businessId: string, dto: CreateUserDto): Promise<{
        email: string;
        name: string;
        id: string;
        role: import(".prisma/client").$Enums.Role;
    }>;
}
