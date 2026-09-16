import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    constructor(prisma: PrismaService, jwt: JwtService);
    login(dto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: "ADMIN" | "SUBADMIN";
            businessId: string;
        };
    }>;
    register(dto: RegisterDto): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: "ADMIN" | "SUBADMIN";
            businessId: string;
        };
    }>;
    me(userId: string): Promise<{
        business: {
            name: string;
            id: string;
        };
        email: string;
        name: string;
        id: string;
        role: import(".prisma/client").$Enums.Role;
        businessId: string;
    }>;
    private issueToken;
    assertEmailAvailable(email: string): Promise<void>;
    hashPassword(password: string): Promise<string>;
}
