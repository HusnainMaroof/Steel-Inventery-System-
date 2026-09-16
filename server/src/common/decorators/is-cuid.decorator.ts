import { Matches } from "class-validator";

/** Prisma `@default(cuid())` ids — not UUIDs. */
export function IsCuid(): PropertyDecorator {
  return Matches(/^c[a-z0-9]{24}$/, { message: "must be a valid id" });
}
