import { incrementInvoicePaid } from "./invoice-atomic";

describe("incrementInvoicePaid", () => {
  it("returns true when the update succeeds", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "inv-1" }]),
    };
    const ok = await incrementInvoicePaid(
      tx as never,
      "biz-1",
      "inv-1",
      100,
    );
    expect(ok).toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it("returns false when no row is updated", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const ok = await incrementInvoicePaid(
      tx as never,
      "biz-1",
      "inv-1",
      100,
    );
    expect(ok).toBe(false);
  });
});
