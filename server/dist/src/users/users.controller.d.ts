import { AuthUser } from "../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    list(user: AuthUser): import(".prisma/client").Prisma.PrismaPromise<{
        email: string;
        name: string;
        id: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
    }[]>;
    create(user: AuthUser, dto: CreateUserDto): Promise<{
        email: string;
        name: string;
        id: string;
        role: import(".prisma/client").$Enums.Role;
    }>;
    me(user: AuthUser): Promise<{
        email: string;
        name: string;
        id: string;
        role: import(".prisma/client").$Enums.Role;
        businessId: string;
    }>;
}
