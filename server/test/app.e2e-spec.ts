import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * E2E suite — requires a reachable DATABASE_URL (Neon). Skipped when the
 * environment has no database configured, so CI can run the unit suite
 * without secrets.
 */
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Tradex API (e2e)", () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/products").expect(401);
    expect(res.body.statusCode).toBe(401);
  });

  it("logs in and reads products", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD })
      .expect(200);
    token = login.body.access_token;
    await request(app.getHttpServer())
      .get("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });
});
