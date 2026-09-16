"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const common_1 = require("@nestjs/common");
let ConfigService = class ConfigService {
    required = ["DATABASE_URL", "JWT_SECRET"];
    onModuleInit() {
        const missing = this.required.filter((key) => !process.env[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(", ")}. ` +
                "Copy .env.example to .env and fill in the values.");
        }
    }
    get databaseUrl() {
        return process.env.DATABASE_URL ?? "";
    }
    get jwtSecret() {
        return process.env.JWT_SECRET ?? "";
    }
    get jwtExpiresIn() {
        return process.env.JWT_EXPIRES_IN ?? "12h";
    }
    get port() {
        return Number(process.env.PORT ?? 4000);
    }
};
exports.ConfigService = ConfigService;
exports.ConfigService = ConfigService = __decorate([
    (0, common_1.Injectable)()
], ConfigService);
//# sourceMappingURL=config.service.js.map