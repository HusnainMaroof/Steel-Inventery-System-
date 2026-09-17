import { SetMetadata } from "@nestjs/common";
import type { StaffPage } from "../staff-access";

export const STAFF_PAGE_KEY = "staffPage";

/** Tenant routes staff may call only when their access includes this page (owners bypass). */
export const RequireStaffPage = (...pages: StaffPage[]) =>
  SetMetadata(STAFF_PAGE_KEY, pages);
