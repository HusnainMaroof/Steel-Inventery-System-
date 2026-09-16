import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AuthUser } from "../common/decorators/current-user.decorator";
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    me(user: AuthUser): Promise<{
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
}
