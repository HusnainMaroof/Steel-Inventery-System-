import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Observable, map } from "rxjs";
import { decimalToJson } from "../decimal/decimal-json";

const TITLE_ENUMS: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank",
  CHEQUE: "Cheque",
  TRANSPORT: "Transport",
  LABOR: "Labor",
  RENT: "Rent",
  UTILITIES: "Utilities",
  OTHER: "Other",
};

export function normalizeJson(value: unknown, key?: string): unknown {
  if (value instanceof Prisma.Decimal) return decimalToJson(value, key);
  if (value instanceof Date) {
    const iso = value.toISOString();
    return key === "date" || key === "purchasedAt" ? iso.slice(0, 10) : iso;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (value && typeof value === "object") {
    const normalized = Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        normalizeJson(child, childKey),
      ]),
    );
    if (typeof normalized.referenceType === "string" && typeof normalized.type === "string") {
      if (normalized.type === "PURCHASE") normalized.type = "PURCHASE_RECEIPT";
      if (normalized.type === "RETURN" && normalized.referenceType === "SALE_DELETE") {
        normalized.type = "SALE_RETURN";
      }
      if (normalized.type === "ADJUSTMENT" && normalized.qty != null) {
        const q = Number(normalized.qty);
        normalized.type = q >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
      }
    }
    return normalized;
  }
  if (typeof value === "string") {
    if (key === "type" && (value === "CUSTOMER" || value === "SUPPLIER")) {
      return value.toLowerCase();
    }
    if ((key === "method" || key === "category") && TITLE_ENUMS[value]) {
      return TITLE_ENUMS[value];
    }
  }
  return value;
}

@Injectable()
export class JsonNormalizationInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => normalizeJson(data)));
  }
}
