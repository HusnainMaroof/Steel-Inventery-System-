"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const supertest_1 = __importDefault(require("supertest"));
const app_module_1 = require("../src/app.module");
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;
describeIfDb("Tradex API (e2e)", () => {
    let app;
    let token;
    beforeAll(async () => {
        const moduleRef = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleRef.createNestApplication();
        app.setGlobalPrefix("api");
        app.enableVersioning({ type: common_1.VersioningType.URI, defaultVersion: "1" });
        app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
    });
    afterAll(async () => {
        await app.close();
    });
    it("rejects unauthenticated access", async () => {
        const res = await (0, supertest_1.default)(app.getHttpServer()).get("/api/v1/products").expect(401);
        expect(res.body.statusCode).toBe(401);
    });
    it("logs in and reads products", async () => {
        const login = await (0, supertest_1.default)(app.getHttpServer())
            .post("/api/v1/auth/login")
            .send({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD })
            .expect(200);
        token = login.body.access_token;
        await (0, supertest_1.default)(app.getHttpServer())
            .get("/api/v1/products")
            .set("Authorization", `Bearer ${token}`)
            .expect(200);
    });
});
//# sourceMappingURL=app.e2e-spec.js.map