import { activityCountsByBusiness } from "./query-helpers";

describe("activityCountsByBusiness", () => {
  it("merges groupBy results into a per-business map", async () => {
    const prisma = {
      sale: {
        groupBy: jest.fn().mockResolvedValue([
          { businessId: "b1", _count: { _all: 3 } },
          { businessId: "b2", _count: { _all: 1 } },
        ]),
      },
      purchase: {
        groupBy: jest.fn().mockResolvedValue([
          { businessId: "b1", _count: { _all: 2 } },
        ]),
      },
      payment: {
        groupBy: jest.fn().mockResolvedValue([
          { businessId: "b2", _count: { _all: 4 } },
        ]),
      },
    };

    const map = await activityCountsByBusiness(prisma as never, new Date("2026-01-01"));
    expect(map.get("b1")).toEqual({
      businessId: "b1",
      sales30d: 3,
      purchases30d: 2,
      payments30d: 0,
    });
    expect(map.get("b2")).toEqual({
      businessId: "b2",
      sales30d: 1,
      purchases30d: 0,
      payments30d: 4,
    });
  });
});
