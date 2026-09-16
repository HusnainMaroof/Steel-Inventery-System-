import { ValidationPipe, VersioningType } from "@nestjs/common";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";

/**
 * E2E suite — requires a reachable DATABASE_URL (Neon). Skipped when the
 * environment has no database configured, so CI can run the unit suite
 * without secrets.
 */
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Tradex API (e2e)", () => {
  let app: NestFastifyApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  it("rejects unauthenticated access", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products",
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().statusCode).toBe(401);
  });

  it("logs in and reads products", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: process.env.TEST_EMAIL,
        password: process.env.TEST_PASSWORD,
      },
    });
    expect(login.statusCode).toBe(200);
    token = login.json().access_token as string;
    const products = await app.inject({
      method: "GET",
      url: "/api/v1/products",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(products.statusCode).toBe(200);
  });
});
