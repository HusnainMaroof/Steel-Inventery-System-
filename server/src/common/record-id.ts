import { randomBytes } from "crypto";

/**
 * Id for rows written with raw SQL or createMany, where Prisma's client-side
 * `@default(cuid())` does not run. Matches the cuid() shape `c` + 24 chars,
 * the format IsCuid and ParseIdPipe accept.
 */
export function newRecordId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}
