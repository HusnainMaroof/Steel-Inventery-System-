import { BadRequestException, PipeTransform } from "@nestjs/common";

const CUID_PATTERN = /^c[a-z0-9]{24}$/;

/** Route-param validation for Prisma cuid() primary keys. */
export class ParseIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value || typeof value !== "string" || !CUID_PATTERN.test(value)) {
      throw new BadRequestException("Invalid id");
    }
    return value;
  }
}
