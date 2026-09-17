import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ALL_BUSINESS_PANEL_PAGES } from "../panel-access";
import { StaffAccessGuard } from "./staff-access.guard";

describe("StaffAccessGuard", () => {
  const reflector = new Reflector();
  const guard = new StaffAccessGuard(reflector);

  const context = (user: object | undefined) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as never;

  beforeEach(() => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["purchases"]);
  });

  it("allows business owners when the subscription plan includes the page", () => {
    expect(
      guard.canActivate(
        context({
          role: "ADMIN",
          access: [],
          planPages: ALL_BUSINESS_PANEL_PAGES,
          sub: "1",
          email: "o@test.local",
          name: "Owner",
          businessId: "b1",
        }),
      ),
    ).toBe(true);
  });

  it("blocks business owners when the subscription plan excludes the page", () => {
    expect(() =>
      guard.canActivate(
        context({
          role: "ADMIN",
          access: [],
          planPages: ["dashboard"],
          sub: "1",
          email: "o@test.local",
          name: "Owner",
          businessId: "b1",
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows staff when their access includes the required page", () => {
    expect(
      guard.canActivate(
        context({
          role: "SUBADMIN",
          access: ["purchases", "dashboard"],
          planPages: ALL_BUSINESS_PANEL_PAGES,
          sub: "2",
          email: "s@test.local",
          name: "Staff",
          businessId: "b1",
        }),
      ),
    ).toBe(true);
  });

  it("blocks staff without the required page", () => {
    expect(() =>
      guard.canActivate(
        context({
          role: "SUBADMIN",
          access: ["sales"],
          planPages: ALL_BUSINESS_PANEL_PAGES,
          sub: "2",
          email: "s@test.local",
          name: "Staff",
          businessId: "b1",
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("skips checks when no page metadata is set", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
    expect(
      guard.canActivate(
        context({
          role: "SUBADMIN",
          access: [],
          sub: "2",
          email: "s@test.local",
          name: "Staff",
          businessId: "b1",
        }),
      ),
    ).toBe(true);
  });
});
