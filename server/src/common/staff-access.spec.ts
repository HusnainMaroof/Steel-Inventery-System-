import { sanitizeAccess } from "./staff-access";

describe("staff access", () => {
  it("keeps only known pages in order", () => {
    expect(sanitizeAccess(["sales", "admin", "sales", "dashboard"])).toEqual([
      "sales",
      "dashboard",
    ]);
  });
});
