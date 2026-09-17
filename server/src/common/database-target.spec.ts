import { parseDatabaseTarget, redactSecrets } from "./database-target";

describe("parseDatabaseTarget", () => {
  it("extracts host and database without credentials", () => {
    const target = parseDatabaseTarget(
      "postgresql://owner:secret@ep-example-pooler.aws.neon.tech/neondb?sslmode=require",
    );
    expect(target).toEqual({
      host: "ep-example-pooler.aws.neon.tech",
      database: "neondb",
      pooled: true,
    });
  });

  it("marks a non-pooler host as direct", () => {
    const target = parseDatabaseTarget(
      "postgresql://owner:secret@ep-example.aws.neon.tech/neondb",
    );
    expect(target.pooled).toBe(false);
    expect(target.host).toBe("ep-example.aws.neon.tech");
  });

  it("does not throw on garbage input", () => {
    expect(parseDatabaseTarget("not-a-url")).toEqual({
      host: "unparseable",
      database: "unknown",
      pooled: false,
    });
  });
});

describe("redactSecrets", () => {
  it("strips user:password from connection strings", () => {
    expect(
      redactSecrets("Can't reach postgresql://owner:s3cret@db.example/neondb"),
    ).toBe("Can't reach postgresql://***:***@db.example/neondb");
  });
});
