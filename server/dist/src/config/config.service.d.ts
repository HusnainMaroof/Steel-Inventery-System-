import { OnModuleInit } from "@nestjs/common";
export declare class ConfigService implements OnModuleInit {
    private readonly required;
    onModuleInit(): void;
    get databaseUrl(): string;
    get jwtSecret(): string;
    get jwtExpiresIn(): string;
    get port(): number;
}
