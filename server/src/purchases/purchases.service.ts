import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import { assertMoney, assertQty, LIMITS } from "../common/security/limits";
import {
  sanitizeAttributeSnapshot,
  sanitizeOptionalText,
} from "../common/security/sanitize-text";
import {
  assertLineReferences,
  checkLineReferences,
  type LineReferenceRows,
} from "../common/catalog/line-reference-validation";
import { lockInventoryKeys, lotLockKey, stockLockKey } from "../common/inventory/stock-locks";
import { newRecordId } from "../common/record-id";
import { purchaseGoodsTotal } from "../domain/money";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePurchaseDto, CreatePurchaseLineDto } from "./dto/create-purchase.dto";
import { UpdatePurchaseDto, UpdatePurchaseLineDto } from "./dto/update-purchase.dto";

type StockRow = { productId: string; variantId?: string | null; qty: number };

/** Supplier, products and line references for a new purchase, read in one statement. */
type PurchaseRefRow = LineReferenceRows & { supplierFound: boolean; productCount: number };

/** The stored purchase row, plus how many child rows the write inserted. */
type PurchaseWriteRow = {
  id: string;
  businessId: string;
  date: Date;
  supplierId: string;
  notes: string | null;
  transport: Prisma.Decimal;
  loading: Prisma.Decimal;
  labour: Prisma.Decimal;
  otherCost: Prisma.Decimal;
  paid: Prisma.Decimal;
  createdAt: Date;
  lineCount: number;
  lotCount: number;
  ledgerCount: number;
};

/**
 * Returns the product ID of the first product or variant that would go negative.
 * Product totals include every variant, and variant totals are checked too,
 * so shrinking one variant cannot hide behind the product total.
 */
export function replacementStockShortage(
  stockWithoutPurchase: StockRow[],
  replacementLines: StockRow[],
): string | undefined {
  const productStock = new Map<string, number>();
  const variantStock = new Map<string, { productId: string; qty: number }>();
  for (const row of [...stockWithoutPurchase, ...replacementLines]) {
    productStock.set(row.productId, (productStock.get(row.productId) ?? 0) + row.qty);
    if (row.variantId) {
      const key = `${row.productId}:${row.variantId}`;
      const current = variantStock.get(key) ?? { productId: row.productId, qty: 0 };
      variantStock.set(key, { productId: row.productId, qty: current.qty + row.qty });
    }
  }
  const negativeProduct = [...productStock.entries()].find(([, qty]) => qty < -0.0005);
  if (negativeProduct) return negativeProduct[0];
  return [...variantStock.values()].find((row) => row.qty < -0.0005)?.productId;
}

/** Ledger referenceTypes that belong to one purchase's stock history. */
export const PURCHASE_LEDGER_TYPES = ["PURCHASE", "PURCHASE_EDIT", "PURCHASE_LINE_REVERSAL"] as const;

type ExistingPurchaseLine = {
  id: string;
  productId: string;
  variantId: string | null;
  categoryId: string | null;
  item: string;
  attributeSnapshot: Prisma.JsonValue;
  qty: Prisma.Decimal;
  unit: string;
  rate: Prisma.Decimal;
  sellRate: Prisma.Decimal | null;
  productName: string | null;
  spec: string | null;
  quality: string | null;
  lotNumber: string | null;
  heatNumber: string | null;
  batchNumber: string | null;
  warehouseId: string | null;
  locationId: string | null;
};

type LineSnapshot = {
  productId: string;
  variantId: string | null;
  categoryId: string | null;
  item: string;
  attributeSnapshot: unknown;
  qty: number;
  unit: string;
  rate: number;
  sellRate: number | null;
  productName: string | null;
  spec: string | null;
  quality: string | null;
  lotNumber: string | null;
  heatNumber: string | null;
  batchNumber: string | null;
  warehouseId: string | null;
  locationId: string | null;
};

function lineSnapshot(line: ExistingPurchaseLine | CreatePurchaseLineDto): LineSnapshot {
  return {
    productId: line.productId,
    variantId: line.variantId ?? null,
    categoryId: line.categoryId ?? null,
    item: line.item,
    attributeSnapshot: line.attributeSnapshot ?? null,
    qty: Number(line.qty),
    unit: line.unit,
    rate: Number(line.rate),
    sellRate: line.sellRate == null ? null : Number(line.sellRate),
    productName: line.productName ?? null,
    spec: line.spec ?? null,
    quality: line.quality ?? null,
    lotNumber: line.lotNumber ?? null,
    heatNumber: line.heatNumber ?? null,
    batchNumber: line.batchNumber ?? null,
    warehouseId: line.warehouseId ?? null,
    locationId: line.locationId ?? null,
  };
}

/** Fields that move stock. A change here needs reversal and new ledger rows. */
function stockSignature(s: LineSnapshot): string {
  return JSON.stringify([
    s.productId, s.variantId, s.categoryId, s.unit, s.qty, s.warehouseId,
    s.locationId, s.lotNumber, s.heatNumber, s.batchNumber, s.attributeSnapshot,
  ]);
}

/** Fields that change money or labels only. No ledger rows change. */
function detailSignature(s: LineSnapshot): string {
  return JSON.stringify([s.item, s.rate, s.sellRate, s.productName, s.spec, s.quality]);
}

export type PurchaseLinePlan<T extends ExistingPurchaseLine = ExistingPurchaseLine> = {
  kept: Array<{
    existing: T;
    input: UpdatePurchaseLineDto;
    stockChanged: boolean;
    detailChanged: boolean;
  }>;
  added: UpdatePurchaseLineDto[];
  removed: T[];
};

/**
 * Matches requested lines to existing lines by persistent ID only. Product and
 * variant are never used for matching, because duplicates are allowed.
 */
export function planPurchaseLineChanges<T extends ExistingPurchaseLine>(
  existing: T[],
  requested: UpdatePurchaseLineDto[],
): PurchaseLinePlan<T> {
  const byId = new Map(existing.map((line) => [line.id, line]));
  const seen = new Set<string>();
  const kept: PurchaseLinePlan<T>["kept"] = [];
  const added: UpdatePurchaseLineDto[] = [];
  for (const input of requested) {
    if (!input.id) {
      added.push(input);
      continue;
    }
    if (seen.has(input.id)) {
      throw new BadRequestException("Duplicate purchase line ID in request");
    }
    const found = byId.get(input.id);
    if (!found) {
      throw new BadRequestException("Purchase line does not belong to this purchase");
    }
    seen.add(input.id);
    const before = lineSnapshot(found);
    const after = lineSnapshot(input);
    kept.push({
      existing: found,
      input,
      stockChanged: stockSignature(before) !== stockSignature(after),
      detailChanged: detailSignature(before) !== detailSignature(after),
    });
  }
  return {
    kept,
    added,
    removed: existing.filter((line) => !seen.has(line.id)),
  };
}

function purchaseLineScalars(line: CreatePurchaseLineDto) {
  return {
    productId: line.productId,
    variantId: line.variantId ?? null,
    categoryId: line.categoryId ?? null,
    item: line.item,
    attributeSnapshot:
      line.attributeSnapshot == null
        ? Prisma.DbNull
        : (line.attributeSnapshot as Prisma.InputJsonValue),
    qty: line.qty,
    unit: line.unit,
    rate: line.rate,
    sellRate: line.sellRate ?? null,
    productName: line.productName ?? null,
    spec: line.spec ?? null,
    quality: line.quality ?? null,
    lotNumber: line.lotNumber ?? null,
    heatNumber: line.heatNumber ?? null,
    batchNumber: line.batchNumber ?? null,
    warehouseId: line.warehouseId ?? null,
    locationId: line.locationId ?? null,
  };
}

/**
 * Line as the DB stores it, built from validated input. Decimal columns are
 * rounded to their scale (qty 3, rate and sellRate 2) to match what is saved.
 */
function persistedPurchaseLine(id: string, purchaseId: string, line: CreatePurchaseLineDto) {
  return {
    id,
    purchaseId,
    productId: line.productId,
    variantId: line.variantId ?? null,
    categoryId: line.categoryId ?? null,
    item: line.item,
    attributeSnapshot: line.attributeSnapshot ?? null,
    qty: new Prisma.Decimal(line.qty).toDecimalPlaces(3),
    unit: line.unit,
    rate: new Prisma.Decimal(line.rate).toDecimalPlaces(2),
    sellRate: line.sellRate == null ? null : new Prisma.Decimal(line.sellRate).toDecimalPlaces(2),
    productName: line.productName ?? null,
    spec: line.spec ?? null,
    quality: line.quality ?? null,
    lotNumber: line.lotNumber ?? null,
    heatNumber: line.heatNumber ?? null,
    batchNumber: line.batchNumber ?? null,
    warehouseId: line.warehouseId ?? null,
    locationId: line.locationId ?? null,
  };
}

type PersistedPurchaseLine = ReturnType<typeof persistedPurchaseLine>;

/**
 * Same JSON the DB readback gave: Prisma Decimals serialize normalized (no trailing zeros).
 * Values are already rounded to column scale, so this matches the stored value.
 */
function toResponseLine(line: PersistedPurchaseLine) {
  return {
    ...line,
    qty: line.qty.toString(),
    rate: line.rate.toString(),
    sellRate: line.sellRate?.toString() ?? null,
  };
}

const listInclude = {
  supplier: { select: { id: true, name: true, mill: true } },
  lines: { include: { product: { select: { id: true, name: true, unit: true } } } },
} satisfies Prisma.PurchaseInclude;

const listOrder: Prisma.PurchaseOrderByWithRelationInput[] = [
  { date: "desc" },
  { createdAt: "desc" },
];

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * §8/§12: purchase + lines + inventory ledger rows are created inside one
   * PostgreSQL transaction. Supplier payable is derived (goods − paid), so
   * nothing else needs updating.
   */
  async create(businessId: string, dto: CreatePurchaseDto, actorId?: string) {
    if (dto.lines.length === 0) {
      throw new BadRequestException("A purchase needs at least one line");
    }
    if (dto.lines.length > LIMITS.MAX_LINES_PER_DOC) {
      throw new BadRequestException(
        `A purchase cannot have more than ${LIMITS.MAX_LINES_PER_DOC} lines`,
      );
    }
    dto.notes = sanitizeOptionalText(dto.notes, 300);
    assertMoney(dto.transport ?? 0, "Transport");
    assertMoney(dto.loading ?? 0, "Loading");
    assertMoney(dto.labour ?? 0, "Labour");
    assertMoney(dto.otherCost ?? 0, "Other cost");
    assertMoney(dto.paid ?? 0, "Paid amount");
    for (const line of dto.lines) {
      assertQty(line.qty);
      assertMoney(line.rate, "Rate");
      if (line.sellRate != null) assertMoney(line.sellRate, "Sell rate");
      line.item = line.item.trim().slice(0, 80);
      line.attributeSnapshot = sanitizeAttributeSnapshot(line.attributeSnapshot);
    }

    const productIds = [...new Set(dto.lines.map((line) => line.productId))];
    const idsOf = (pick: (line: CreatePurchaseLineDto) => string | undefined) =>
      [...new Set(dto.lines.map(pick).filter(Boolean))] as string[];
    const categoryIds = idsOf((line) => line.categoryId);
    const variantIds = idsOf((line) => line.variantId);
    const warehouseIds = idsOf((line) => line.warehouseId);
    const locationIds = idsOf((line) => line.locationId);

    // Latency: four database round trips (BEGIN, one read for every reference
    // check, one write for every row, COMMIT). A purchase only adds stock, so it
    // takes no stock locks.
    return this.prisma.$transaction(async (tx) => {
      const [refs] = await tx.$queryRaw<PurchaseRefRow[]>`
        SELECT
          EXISTS (
            SELECT 1 FROM "Supplier" WHERE "id" = ${dto.supplierId} AND "businessId" = ${businessId}
          ) AS "supplierFound",
          (
            SELECT COUNT(*)::int FROM "Product"
            WHERE "businessId" = ${businessId} AND "id" = ANY(${productIds}::text[])
          ) AS "productCount",
          COALESCE((
            SELECT json_agg(json_build_object('id', c."id", 'productId', c."productId"))
            FROM "ProductCategory" c
            WHERE c."businessId" = ${businessId} AND c."id" = ANY(${categoryIds}::text[])
          ), '[]'::json) AS "categories",
          COALESCE((
            SELECT json_agg(json_build_object('id', v."id", 'productId', v."productId", 'categoryId', v."categoryId"))
            FROM "Variant" v
            WHERE v."businessId" = ${businessId} AND v."id" = ANY(${variantIds}::text[])
          ), '[]'::json) AS "variants",
          COALESCE((
            SELECT json_agg(json_build_object('id', w."id"))
            FROM "Warehouse" w
            WHERE w."businessId" = ${businessId} AND w."id" = ANY(${warehouseIds}::text[])
          ), '[]'::json) AS "warehouses",
          COALESCE((
            SELECT json_agg(json_build_object('id', l."id", 'warehouseId', l."warehouseId"))
            FROM "Location" l
            WHERE l."businessId" = ${businessId} AND l."id" = ANY(${locationIds}::text[])
          ), '[]'::json) AS "locations"
      `;
      if (!refs?.supplierFound) throw new BadRequestException("Supplier not found");
      if (refs.productCount !== productIds.length) {
        throw new BadRequestException("One or more products were not found");
      }
      checkLineReferences(dto.lines, refs);

      const goodsTotal = purchaseGoodsTotal(dto.lines);
      const paid = dto.paid ?? 0;
      if (paid > goodsTotal + 0.005) {
        throw new BadRequestException(
          `Paid amount (${paid}) cannot exceed the goods total (${goodsTotal})`,
        );
      }

      // Ids are generated here so every row can be written in one statement, without a readback.
      const purchaseId = newRecordId();
      // Same calendar day Prisma stores for a DateTime @db.Date (UTC day of the instant).
      const purchaseDate = new Date(dto.date).toISOString().slice(0, 10);
      const lines = dto.lines.map((line) => persistedPurchaseLine(newRecordId(), purchaseId, line));
      const lineInput = lines.map((line) => ({
        ...line,
        // One lot per purchase line, and one ledger row that points at it.
        lotId: newRecordId(),
        txId: newRecordId(),
        qty: line.qty.toFixed(),
        rate: line.rate.toFixed(),
        sellRate: line.sellRate?.toFixed() ?? null,
        refLabel: [line.lotNumber, line.heatNumber, line.batchNumber].filter(Boolean).join(" / ") || null,
      }));
      const hasPayment = paid > 0;
      // As before: a paid-at-purchase payment is dated today (UTC day), not the purchase date.
      const paidOn = new Date().toISOString().slice(0, 10);
      const paymentId = newRecordId();
      const auditMeta = JSON.stringify({ supplierId: dto.supplierId, lineCount: dto.lines.length });
      const money = (value: number | undefined) => new Prisma.Decimal(value ?? 0).toFixed();

      // One statement: purchase, lines, lots, §7 stock-in ledger rows, the optional
      // mill payment with its allocation, and the audit row. Foreign keys between
      // these rows are checked at the end of the statement.
      const [written] = await tx.$queryRaw<PurchaseWriteRow[]>`
        WITH new_purchase AS (
          INSERT INTO "Purchase" ("id", "businessId", "date", "supplierId", "notes",
                                  "transport", "loading", "labour", "otherCost", "paid")
          VALUES (${purchaseId}, ${businessId}, ${purchaseDate}::date, ${dto.supplierId}, ${dto.notes ?? null},
                  ${money(dto.transport)}::numeric, ${money(dto.loading)}::numeric, ${money(dto.labour)}::numeric,
                  ${money(dto.otherCost)}::numeric, ${money(paid)}::numeric)
          RETURNING "id", "businessId", "date", "supplierId", "notes", "transport", "loading",
                    "labour", "otherCost", "paid", "createdAt"
        ),
        line_input AS (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(lineInput)}::jsonb) AS l(
            "id" text, "lotId" text, "txId" text, "productId" text, "variantId" text, "categoryId" text,
            "item" text, "attributeSnapshot" jsonb, "qty" numeric, "unit" text, "rate" numeric,
            "sellRate" numeric, "productName" text, "spec" text, "quality" text, "lotNumber" text,
            "heatNumber" text, "batchNumber" text, "warehouseId" text, "locationId" text, "refLabel" text
          )
        ),
        new_lines AS (
          INSERT INTO "PurchaseLine" ("id", "purchaseId", "productId", "variantId", "categoryId", "item",
                                      "attributeSnapshot", "qty", "unit", "rate", "sellRate", "productName",
                                      "spec", "quality", "lotNumber", "heatNumber", "batchNumber",
                                      "warehouseId", "locationId")
          SELECT l."id", p."id", l."productId", l."variantId", l."categoryId", l."item",
                 l."attributeSnapshot", l."qty", l."unit", l."rate", l."sellRate", l."productName",
                 l."spec", l."quality", l."lotNumber", l."heatNumber", l."batchNumber",
                 l."warehouseId", l."locationId"
          FROM line_input l CROSS JOIN new_purchase p
          RETURNING "id"
        ),
        new_lots AS (
          INSERT INTO "StockLot" ("id", "businessId", "purchaseId", "purchaseLineId", "productId", "variantId",
                                  "unit", "receivedQty", "receivedAt", "status")
          SELECT l."lotId", ${businessId}, p."id", l."id", l."productId", l."variantId",
                 l."unit", l."qty", ${purchaseDate}::date, 'ACTIVE'
          FROM line_input l CROSS JOIN new_purchase p
          RETURNING "id"
        ),
        new_ledger AS (
          INSERT INTO "InventoryTransaction" ("id", "businessId", "productId", "categoryId", "variantId",
                                              "purchaseLineId", "lotId", "warehouseId", "locationId",
                                              "attributeSnapshot", "unit", "refLabel", "type", "qty",
                                              "referenceType", "referenceId", "date")
          SELECT l."txId", ${businessId}, l."productId", l."categoryId", l."variantId",
                 l."id", l."lotId", l."warehouseId", l."locationId",
                 l."attributeSnapshot", l."unit", l."refLabel", 'PURCHASE'::"InventoryTxType", l."qty",
                 'PURCHASE', p."id", ${purchaseDate}::date
          FROM line_input l CROSS JOIN new_purchase p
          RETURNING "id"
        ),
        new_payment AS (
          INSERT INTO "Payment" ("id", "businessId", "date", "type", "supplierId", "amount", "method",
                                 "purchaseId", "note")
          SELECT ${paymentId}, ${businessId}, ${paidOn}::date, 'SUPPLIER'::"PaymentType", ${dto.supplierId},
                 ${money(paid)}::numeric, 'CASH'::"PaymentMethod", p."id",
                 'Payment recorded with purchase ' || p."id"
          FROM new_purchase p
          WHERE ${hasPayment}::boolean
          RETURNING "id"
        ),
        new_allocation AS (
          INSERT INTO "PaymentAllocation" ("id", "businessId", "paymentId", "purchaseId", "amount")
          SELECT ${newRecordId()}, ${businessId}, pay."id", p."id", ${money(paid)}::numeric
          FROM new_payment pay CROSS JOIN new_purchase p
          RETURNING "id"
        ),
        new_audit AS (
          INSERT INTO "AuditLog" ("id", "businessId", "actorId", "action", "entityType", "entityId", "metadata")
          VALUES (${newRecordId()}, ${businessId}, ${actorId ?? null}, 'purchase.created', 'purchase',
                  ${purchaseId}, ${auditMeta}::jsonb)
          RETURNING "id"
        )
        SELECT p.*,
               (SELECT COUNT(*)::int FROM new_lines) AS "lineCount",
               (SELECT COUNT(*)::int FROM new_lots) AS "lotCount",
               (SELECT COUNT(*)::int FROM new_ledger) AS "ledgerCount"
        FROM new_purchase p
      `;
      const { lineCount, lotCount, ledgerCount, ...purchase } = written;
      if (lineCount !== lines.length || lotCount !== lines.length || ledgerCount !== lines.length) {
        throw new Error("Purchase write did not insert every line");
      }

      return { ...purchase, lines: lines.map(toResponseLine) };
    });
  }

  async list(businessId: string, skip: number, take: number, supplierId?: string) {
    const where = this.baseWhere(businessId, supplierId);
    const [items, total] = await Promise.all([
      this.prisma.purchase.findMany({
        relationLoadStrategy: "join",
        where,
        skip,
        take,
        include: listInclude,
        orderBy: listOrder,
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return [items, total] as const;
  }

  /** Bulk fetch for /ledger/transactions — one findMany, no count. */
  listAll(businessId: string, take: number) {
    return this.prisma.purchase.findMany({
      relationLoadStrategy: "join",
      where: this.baseWhere(businessId),
      include: listInclude,
      orderBy: listOrder,
      take,
    });
  }

  private baseWhere(businessId: string, supplierId?: string) {
    return {
      businessId,
      ...(supplierId ? { supplierId } : {}),
    };
  }

  async byId(businessId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: {
        supplier: true,
        lines: { include: { product: { select: { id: true, name: true, unit: true } } } },
      },
    });
    if (!purchase) throw new NotFoundException("Purchase not found");
    return purchase;
  }

  async update(businessId: string, id: string, dto: UpdatePurchaseDto, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      let current = await tx.purchase.findFirst({
        where: { id, businessId },
        include: { lines: true },
      });
      if (!current) throw new NotFoundException("Purchase not found");

      // Serialize purchase edits with supplier payments so a concurrent FIFO
      // settlement cannot use stale goods/paid values. Lock both supplier
      // buckets in stable order if a supplier change was requested.
      const originalSupplierId = current.supplierId;
      const supplierLocks = [...new Set([
        originalSupplierId,
        ...(dto.supplierId ? [dto.supplierId] : []),
      ])].sort();
      for (const supplierId of supplierLocks) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`suppay:${businessId}:${supplierId}`}))`;
      }
      current = await tx.purchase.findFirst({
        where: { id, businessId },
        include: { lines: true },
      });
      if (!current) throw new NotFoundException("Purchase not found");
      if (current.supplierId !== originalSupplierId) {
        throw new BadRequestException("Purchase changed while being edited. Reload and try again.");
      }

      if (dto.paid !== undefined && dto.paid !== Number(current.paid)) {
        throw new BadRequestException(
          "Purchase payments cannot be edited here. Record or correct them through supplier payments.",
        );
      }
      if (dto.supplierId && dto.supplierId !== current.supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: dto.supplierId, businessId },
          select: { id: true },
        });
        if (!supplier) throw new BadRequestException("Supplier not found");
        const [linkedPayment, legacyUnallocatedPayment] = await Promise.all([
          tx.payment.findFirst({
            where: {
              businessId,
              type: "SUPPLIER",
              OR: [
                { purchaseId: id },
                { allocations: { some: { purchaseId: id } } },
              ],
            },
            select: { id: true },
          }),
          tx.payment.findFirst({
            where: {
              businessId,
              type: "SUPPLIER",
              supplierId: current.supplierId,
              purchaseId: null,
              allocations: { none: {} },
            },
            select: { id: true },
          }),
        ]);
        if (current.paid.gt(0) || linkedPayment || legacyUnallocatedPayment) {
          throw new BadRequestException(
            "Cannot change the supplier after payment history exists for this purchase or supplier.",
          );
        }
      }

      const requestedLines = dto.lines;
      if (requestedLines) {
        if (requestedLines.length === 0) {
          throw new BadRequestException("A purchase needs at least one line");
        }
        if (requestedLines.length > LIMITS.MAX_LINES_PER_DOC) {
          throw new BadRequestException(
            `A purchase cannot have more than ${LIMITS.MAX_LINES_PER_DOC} lines`,
          );
        }
        for (const line of requestedLines) {
          assertQty(line.qty);
          assertMoney(line.rate, "Rate");
          if (line.sellRate != null) assertMoney(line.sellRate, "Sell rate");
          line.item = line.item.trim().slice(0, 80);
          line.attributeSnapshot = sanitizeAttributeSnapshot(line.attributeSnapshot);
        }
      }
      // Throws on foreign or duplicate line IDs before any guard or write.
      const plan = requestedLines ? planPurchaseLineChanges(current.lines, requestedLines) : null;
      const linesChanged =
        plan !== null &&
        (plan.added.length > 0 ||
          plan.removed.length > 0 ||
          plan.kept.some((k) => k.stockChanged || k.detailChanged));

      // Guards run only when stock or line details really change. A header-only
      // edit, or a resend of identical lines, never touches lines or ledger rows.
      if (linesChanged) {
        // Lock old and new stock/lot keys before the sold-stock and payment guards.
        await lockInventoryKeys(
          tx,
          this.purchaseStockLockKeys(businessId, id, [...current.lines, ...(requestedLines ?? [])]),
        );
        const [sourcedSales, linkedPayment, legacyUnallocatedPayment] = await Promise.all([
          tx.saleLine.count({
            where: { purchaseId: id, sale: { businessId } },
          }),
          tx.payment.findFirst({
            where: {
              businessId,
              type: "SUPPLIER",
              OR: [
                { purchaseId: id },
                { allocations: { some: { purchaseId: id } } },
              ],
            },
            select: { id: true },
          }),
          tx.payment.findFirst({
            where: {
              businessId,
              type: "SUPPLIER",
              supplierId: current.supplierId,
              purchaseId: null,
              allocations: { none: {} },
            },
            select: { id: true },
          }),
        ]);
        if (sourcedSales) {
          throw new BadRequestException("Cannot replace purchase lines after stock from this lot was sold");
        }
        if (current.paid.gt(0) || linkedPayment || legacyUnallocatedPayment) {
          throw new BadRequestException(
            "Cannot replace purchase lines after supplier payment history exists",
          );
        }
        if (plan && requestedLines) {
          await this.validateReferences(tx, businessId, dto.supplierId ?? current.supplierId, requestedLines);
          await this.assertReplacementLeavesNonNegativeStock(
            tx,
            businessId,
            id,
            requestedLines,
            // Old lines matter too: a line that is removed or moved to another product still changes stock.
            [...new Set([...current.lines, ...requestedLines].map((l) => l.productId))],
          );
          const goodsTotal = purchaseGoodsTotal(requestedLines);
          const paid = Number(current.paid);
          if (paid > goodsTotal + 0.005) {
            throw new BadRequestException(`Paid amount (${paid}) cannot exceed the goods total (${goodsTotal})`);
          }
        }
      }

      const purchase = await tx.purchase.update({
        where: { id },
        data: {
          date: dto.date ? new Date(dto.date) : undefined,
          supplierId: dto.supplierId,
          notes: dto.notes,
          transport: dto.transport,
          loading: dto.loading,
          labour: dto.labour,
          otherCost: dto.otherCost,
        },
      });

      if (plan && linesChanged) {
        await this.applyLineChanges(tx, businessId, purchase, plan);
      }

      const stats = plan && linesChanged
        ? {
            linesAdded: plan.added.length,
            linesRemoved: plan.removed.length,
            linesChanged: plan.kept.filter((k) => k.stockChanged || k.detailChanged).length,
            removedLineIds: plan.removed.map((line) => line.id),
          }
        : { linesAdded: 0, linesRemoved: 0, linesChanged: 0, removedLineIds: [] as string[] };
      await this.audit.logTx(tx, {
        businessId,
        actorId: actorId ?? null,
        action: "purchase.updated",
        entityType: "purchase",
        entityId: purchase.id,
        metadata: stats,
      });
      return tx.purchase.findUniqueOrThrow({ where: { id }, include: { lines: true } });
    });
  }

  /**
   * Applies a line diff. Kept lines keep their IDs and lots. Stock-changed
   * lines get an offsetting edit row plus a new row. Removed lines get an
   * offsetting reversal row. Every ledger row stays in place.
   */
  private async applyLineChanges(
    tx: Prisma.TransactionClient,
    businessId: string,
    purchase: { id: string; date: Date },
    plan: PurchaseLinePlan,
  ) {
    const stockChanged = plan.kept.filter((k) => k.stockChanged);
    const sourceIds = [
      ...plan.removed.map((line) => line.id),
      ...stockChanged.map((k) => k.existing.id),
    ];
    // All rows linked to a line, including rows from earlier edits.
    const sourceRows = sourceIds.length === 0
      ? []
      : await tx.inventoryTransaction.findMany({
          where: { businessId, purchaseLineId: { in: sourceIds } },
        });
    const rowsOf = (lineId: string) => sourceRows.filter((row) => row.purchaseLineId === lineId);

    const reversals = [
      ...plan.removed.flatMap((line) =>
        this.reversalRows(businessId, purchase.id, rowsOf(line.id), "PURCHASE_LINE_REVERSAL"),
      ),
      ...stockChanged.flatMap((k) =>
        this.reversalRows(businessId, purchase.id, rowsOf(k.existing.id), "PURCHASE_EDIT", k.existing.id),
      ),
    ];
    if (reversals.length > 0) {
      await tx.inventoryTransaction.createMany({ data: reversals });
    }

    if (plan.removed.length > 0) {
      await tx.stockLot.updateMany({
        where: { businessId, purchaseLineId: { in: plan.removed.map((line) => line.id) } },
        data: { status: "VOIDED" },
      });
    }
    for (const line of plan.removed) {
      await tx.purchaseLine.delete({ where: { id: line.id } });
    }
    // The lot keeps its line identity. Its quantities follow the edited line.
    for (const k of stockChanged) {
      await tx.stockLot.updateMany({
        where: { businessId, purchaseLineId: k.existing.id },
        data: {
          productId: k.input.productId,
          variantId: k.input.variantId ?? null,
          unit: k.input.unit,
          receivedQty: k.input.qty,
        },
      });
    }
    for (const k of plan.kept) {
      if (k.stockChanged || k.detailChanged) {
        await tx.purchaseLine.update({
          where: { id: k.existing.id },
          data: purchaseLineScalars(k.input),
        });
      }
    }

    const added = [];
    for (const input of plan.added) {
      added.push(
        await tx.purchaseLine.create({
          data: { purchaseId: purchase.id, ...purchaseLineScalars(input) },
        }),
      );
    }

    if (stockChanged.length > 0) {
      const changedLines = await tx.purchaseLine.findMany({
        where: { purchaseId: purchase.id, id: { in: stockChanged.map((k) => k.existing.id) } },
      });
      await this.createMovements(
        tx,
        businessId,
        { id: purchase.id, date: purchase.date, lines: changedLines },
        "PURCHASE_EDIT",
        await this.lotIdsByLine(tx, businessId, changedLines.map((line) => line.id)),
      );
    }
    if (added.length > 0) {
      await this.createMovements(
        tx,
        businessId,
        { id: purchase.id, date: purchase.date, lines: added },
        "PURCHASE",
        await this.createLots(tx, businessId, purchase.id, added, purchase.date),
      );
    }
  }

  async remove(businessId: string, id: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      let purchase = await tx.purchase.findFirst({
        where: { id, businessId },
        include: { lines: true },
      });
      if (!purchase) throw new NotFoundException("Purchase not found");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`suppay:${businessId}:${purchase.supplierId}`}))`;
      purchase = await tx.purchase.findFirst({
        where: { id, businessId },
        include: { lines: true },
      });
      if (!purchase) throw new NotFoundException("Purchase not found");
      await lockInventoryKeys(
        tx,
        this.purchaseStockLockKeys(businessId, id, purchase.lines),
      );
      const sourcedSales = await tx.saleLine.count({
        where: { purchaseId: id, sale: { businessId } },
      });
      if (sourcedSales) {
        throw new BadRequestException("Cannot delete a purchase lot referenced by sales");
      }
      const [linkedPayment, legacyUnallocatedPayment] = await Promise.all([
        tx.payment.findFirst({
          where: {
            businessId,
            type: "SUPPLIER",
            OR: [
              { purchaseId: id },
              { allocations: { some: { purchaseId: id } } },
            ],
          },
          select: { id: true },
        }),
        tx.payment.findFirst({
          where: {
            businessId,
            type: "SUPPLIER",
            supplierId: purchase.supplierId,
            purchaseId: null,
            allocations: { none: {} },
          },
          select: { id: true },
        }),
      ]);
      if (Number(purchase.paid) > 0 || linkedPayment || legacyUnallocatedPayment) {
        throw new BadRequestException(
          "Cannot delete a purchase while supplier payment history may reference it",
        );
      }
      await this.assertReplacementLeavesNonNegativeStock(
        tx,
        businessId,
        id,
        [],
        [...new Set(purchase.lines.map((l) => l.productId))],
      );
      // Keep the original ledger rows for audit. Offset each one with a
      // PURCHASE_DELETE row of the opposite sign, in this same transaction.
      const alreadyReversed = await tx.inventoryTransaction.count({
        where: { businessId, referenceType: "PURCHASE_DELETE", referenceId: id },
      });
      if (alreadyReversed > 0) {
        throw new BadRequestException("Purchase has already been reversed");
      }
      const originals = await tx.inventoryTransaction.findMany({
        where: {
          businessId,
          referenceType: { in: [...PURCHASE_LEDGER_TYPES] },
          referenceId: id,
        },
      });
      await tx.inventoryTransaction.createMany({
        data: this.reversalRows(businessId, id, originals, "PURCHASE_DELETE"),
      });
      // Lots stay for audit history, but are marked voided with the purchase.
      await tx.stockLot.updateMany({ where: { businessId, purchaseId: id }, data: { status: "VOIDED" } });
      await tx.purchase.delete({ where: { id } });
      await this.audit.logTx(tx, {
        businessId,
        actorId: actorId ?? null,
        action: "purchase.deleted",
        entityType: "purchase",
        entityId: id,
      });
      return { deleted: true, purchaseId: id };
    });
  }

  /** Opposite-sign ADJUSTMENT rows for the given ledger rows. */
  private reversalRows(
    businessId: string,
    purchaseId: string,
    rows: Array<{
      productId: string;
      categoryId: string | null;
      variantId: string | null;
      warehouseId: string | null;
      locationId: string | null;
      attributeSnapshot: Prisma.JsonValue;
      unit: string;
      refLabel: string | null;
      purchaseLineId?: string | null;
      lotId?: string | null;
      qty: Prisma.Decimal;
      date: Date;
    }>,
    referenceType: string,
    purchaseLineId?: string,
  ) {
    return rows.map((row) => ({
      businessId,
      productId: row.productId,
      categoryId: row.categoryId,
      variantId: row.variantId,
      purchaseLineId: purchaseLineId ?? row.purchaseLineId ?? undefined,
      lotId: row.lotId ?? undefined,
      warehouseId: row.warehouseId,
      locationId: row.locationId,
      attributeSnapshot:
        row.attributeSnapshot == null
          ? undefined
          : (row.attributeSnapshot as Prisma.InputJsonValue),
      unit: row.unit,
      refLabel: row.refLabel ?? undefined,
      type: "ADJUSTMENT" as const,
      qty: new Prisma.Decimal(row.qty).negated(),
      referenceType,
      referenceId: purchaseId,
      date: row.date,
    }));
  }

  private async validateReferences(
    tx: Prisma.TransactionClient,
    businessId: string,
    supplierId: string,
    lines: Array<{
      productId: string;
      categoryId?: string;
      variantId?: string;
      warehouseId?: string;
      locationId?: string;
    }>,
  ) {
    const productIds = [...new Set(lines.map((line) => line.productId))];
    // One statement checks the supplier and the product count together.
    // Two separate lookups cost one extra network round trip each.
    const [refs] = await tx.$queryRaw<{ supplierFound: boolean; productCount: bigint }[]>`
      SELECT
        EXISTS (SELECT 1 FROM "Supplier" WHERE id = ${supplierId} AND "businessId" = ${businessId}) AS "supplierFound",
        (SELECT COUNT(*) FROM "Product" WHERE "businessId" = ${businessId} AND id = ANY(${productIds}::text[])) AS "productCount"
    `;
    if (!refs?.supplierFound) throw new BadRequestException("Supplier not found");
    if (Number(refs.productCount) !== productIds.length) {
      throw new BadRequestException("One or more products were not found");
    }
    await assertLineReferences(tx, businessId, lines);
  }

  /** Stock and lot keys for every product/variant a purchase line touches. */
  private purchaseStockLockKeys(
    businessId: string,
    purchaseId: string,
    lines: Array<{ productId: string; variantId?: string | null }>,
  ): string[] {
    return lines.flatMap((line) => [
      stockLockKey(businessId, line.productId, line.variantId),
      // Replacement check sums the whole product, so take the product-level key too.
      stockLockKey(businessId, line.productId, null),
      lotLockKey(businessId, purchaseId, line.productId, line.variantId),
    ]);
  }

  private async assertReplacementLeavesNonNegativeStock(
    tx: Prisma.TransactionClient,
    businessId: string,
    purchaseId: string,
    lines: StockRow[],
    affectedProductIds: string[],
  ) {
    if (affectedProductIds.length === 0) return;
    const grouped = await tx.inventoryTransaction.groupBy({
      by: ["productId", "variantId"],
      where: {
        businessId,
        productId: { in: affectedProductIds },
        NOT: { referenceType: { in: [...PURCHASE_LEDGER_TYPES] }, referenceId: purchaseId },
      },
      _sum: { qty: true },
    });
    const shortage = replacementStockShortage(
      grouped.map((row) => ({
        productId: row.productId,
        variantId: row.variantId,
        qty: Number(row._sum.qty ?? 0),
      })),
      lines,
    );
    if (shortage) {
      throw new BadRequestException("Purchase change would make existing sold stock negative");
    }
  }

  /** Creates one ACTIVE lot per purchase line and returns lot IDs keyed by line ID. */
  private async createLots(
    tx: Prisma.TransactionClient,
    businessId: string,
    purchaseId: string,
    lines: Array<{ id: string; productId: string; variantId: string | null; unit: string; qty: Prisma.Decimal }>,
    receivedAt: Date,
  ) {
    // createMany does not return rows, so lot IDs are generated up front.
    const rows = lines.map((line) => ({
      id: newRecordId(),
      businessId,
      purchaseId,
      purchaseLineId: line.id,
      productId: line.productId,
      variantId: line.variantId,
      unit: line.unit,
      receivedQty: line.qty,
      receivedAt,
      status: "ACTIVE",
    }));
    await tx.stockLot.createMany({ data: rows });
    return new Map(rows.map((row) => [row.purchaseLineId, row.id]));
  }

  private async lotIdsByLine(tx: Prisma.TransactionClient, businessId: string, lineIds: string[]) {
    const lots = await tx.stockLot.findMany({
      where: { businessId, purchaseLineId: { in: lineIds } },
      select: { id: true, purchaseLineId: true },
    });
    return new Map(
      lots.flatMap((lot): Array<[string, string]> =>
        lot.purchaseLineId ? [[lot.purchaseLineId, lot.id]] : [],
      ),
    );
  }

  private createMovements(
    tx: Prisma.TransactionClient,
    businessId: string,
    purchase: { id: string; date: Date; lines: Array<{
      id: string; productId: string; categoryId: string | null; variantId: string | null;
      warehouseId: string | null; locationId: string | null; attributeSnapshot: Prisma.JsonValue;
      unit: string; qty: Prisma.Decimal; lotNumber: string | null; heatNumber: string | null; batchNumber: string | null;
    }> },
    referenceType: string = "PURCHASE",
    lotIdByLine: Map<string, string> = new Map(),
  ) {
    return tx.inventoryTransaction.createMany({
      data: purchase.lines.map((line) => ({
        businessId,
        productId: line.productId,
        categoryId: line.categoryId,
        variantId: line.variantId,
        purchaseLineId: line.id,
        lotId: lotIdByLine.get(line.id),
        warehouseId: line.warehouseId,
        locationId: line.locationId,
        attributeSnapshot: line.attributeSnapshot == null
          ? undefined
          : line.attributeSnapshot as Prisma.InputJsonValue,
        unit: line.unit,
        type: "PURCHASE" as const,
        qty: line.qty,
        referenceType,
        referenceId: purchase.id,
        refLabel: [line.lotNumber, line.heatNumber, line.batchNumber].filter(Boolean).join(" / ") || undefined,
        date: purchase.date,
      })),
    });
  }
}
