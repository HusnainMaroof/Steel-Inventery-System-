import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import {
  lockInventoryKeys,
  lotLockKey,
  stockLockKey,
} from "../common/inventory/stock-locks";
import {
  assertMaxDecimals,
  assertMoney,
  assertQty,
  LIMITS,
} from "../common/security/limits";
import {
  sanitizeAttributeSnapshot,
  sanitizeOptionalText,
} from "../common/security/sanitize-text";
import { checkLineReferences } from "../common/catalog/line-reference-validation";
import { newRecordId } from "../common/record-id";
import { PrismaService } from "../prisma/prisma.service";
import { roundMoneyDecimal, saleGrandTotalDecimal } from "../domain/money";
import { CreateSaleDto } from "./dto/create-sale.dto";

const listInclude = {
  customer: { select: { id: true, name: true, shop: true, phone: true } },
  invoice: true,
  lines: true,
} satisfies Prisma.SaleInclude;

/** Percent values are stored as Decimal(5,2): 0 to 100, at most 2 decimals. */
function assertPercent(value: number, label: string): void {
  assertMaxDecimals(value, 2, `${label} percent`);
  if (new Prisma.Decimal(value).lt(0) || new Prisma.Decimal(value).gt(100)) {
    throw new BadRequestException(`${label} percent must be between 0 and 100`);
  }
}

const listOrder: Prisma.SaleOrderByWithRelationInput[] = [
  { date: "desc" },
  { createdAt: "desc" },
];

/** Exact decimal string for SQL binding. Avoids float64 conversion of money and quantities. */
const exact = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value).toFixed();

type QtyRow = { productId: string; variantId: string | null; qty: string };
type LotQtyRow = QtyRow & { purchaseId: string };

/** Everything the sale checks need, read in one statement after the stock locks. */
type SaleCheckRow = {
  customerFound: boolean;
  productCount: number;
  /** Ledger sum per product/variant, for the requested products only. */
  stock: QtyRow[];
  categories: Array<{ id: string; productId: string }>;
  variants: Array<{ id: string; productId: string; categoryId: string | null }>;
  /** Requested purchase ids that exist for this business. */
  purchaseIds: string[];
  purchaseLines: LotQtyRow[];
  /** Quantity already sold per purchase/product/variant. */
  consumed: LotQtyRow[];
  lots: Array<{ id: string; productId: string; variantId: string | null; purchaseId: string | null; status: string }>;
  lotBalances: Array<{ lotId: string; qty: string }>;
};

type SaleWriteRow = {
  saleCreatedAt: Date;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceCreatedAt: Date | null;
  lineCount: number;
  ledgerCount: number;
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * §9/§12: atomic sale creation. Availability is checked against the
   * inventory ledger inside the same transaction; an oversell throws and
   * every partial write rolls back.
   *
   * Latency: every statement inside the transaction is one database round
   * trip, so the work is packed into five: BEGIN, all stock locks, one read
   * for every check, one write for every row, COMMIT. The checks themselves
   * are the same rules as before, applied in JavaScript to the read result.
   */
  async create(businessId: string, dto: CreateSaleDto) {
    if (dto.lines.length === 0) {
      throw new BadRequestException("A sale needs at least one line");
    }
    if (dto.lines.length > LIMITS.MAX_LINES_PER_DOC) {
      throw new BadRequestException(
        `A sale cannot have more than ${LIMITS.MAX_LINES_PER_DOC} lines`,
      );
    }
    dto.notes = sanitizeOptionalText(dto.notes, 300);
    assertMoney(dto.loadingCharges ?? 0, "Loading charges");
    assertMoney(dto.transportCharges ?? 0, "Transport charges");
    assertMoney(dto.labourCharges ?? 0, "Labour charges");
    assertMoney(dto.paidNow ?? 0, "Paid now");
    assertPercent(dto.discountPct ?? 0, "Discount");
    assertPercent(dto.taxPct ?? 0, "Tax");
    for (const line of dto.lines) {
      assertQty(line.qty);
      assertMaxDecimals(line.qty, 3, "Quantity");
      assertMoney(line.rate, "Rate");
      assertMaxDecimals(line.rate, 2, "Rate");
      line.item = line.item.trim().slice(0, 80);
      line.attributeSnapshot = sanitizeAttributeSnapshot(line.attributeSnapshot);
    }

    const productIds = [...new Set(dto.lines.map((l) => l.productId))];
    const categoryIds = [...new Set(dto.lines.map((l) => l.categoryId).filter(Boolean))] as string[];
    const variantIds = [...new Set(dto.lines.map((l) => l.variantId).filter(Boolean))] as string[];
    const purchaseIds = [...new Set(dto.lines.map((l) => l.purchaseId).filter(Boolean))] as string[];
    const lotIds = [...new Set(dto.lines.map((l) => l.lotId).filter(Boolean))] as string[];

    return this.prisma.$transaction(async (tx) => {
      // Round trip 1 (after BEGIN): every stock key, in sorted order.
      const lockKeys = dto.lines.flatMap((line) => {
        // Product-level key too: product-total sales and variant sales must serialize.
        const keys = [
          stockLockKey(businessId, line.productId, line.variantId),
          stockLockKey(businessId, line.productId, null),
        ];
        if (line.purchaseId) {
          keys.push(lotLockKey(businessId, line.purchaseId, line.productId, line.variantId));
        }
        return keys;
      });
      await lockInventoryKeys(tx, lockKeys);

      // Round trip 2: all check data. It runs after the locks, so the stock it
      // reads cannot change before this transaction commits.
      const [checks] = await tx.$queryRaw<SaleCheckRow[]>`
        SELECT
          EXISTS (
            SELECT 1 FROM "Customer" WHERE "id" = ${dto.customerId} AND "businessId" = ${businessId}
          ) AS "customerFound",
          (
            SELECT COUNT(*)::int FROM "Product"
            WHERE "businessId" = ${businessId} AND "id" = ANY(${productIds}::text[])
          ) AS "productCount",
          COALESCE((
            SELECT json_agg(json_build_object('productId', g."productId", 'variantId', g."variantId", 'qty', g.qty::text))
            FROM (
              SELECT "productId", "variantId", SUM("qty") AS qty
              FROM "InventoryTransaction"
              WHERE "businessId" = ${businessId} AND "productId" = ANY(${productIds}::text[])
              GROUP BY "productId", "variantId"
            ) g
          ), '[]'::json) AS "stock",
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
            SELECT json_agg(p."id")
            FROM "Purchase" p
            WHERE p."businessId" = ${businessId} AND p."id" = ANY(${purchaseIds}::text[])
          ), '[]'::json) AS "purchaseIds",
          COALESCE((
            SELECT json_agg(json_build_object('purchaseId', pl."purchaseId", 'productId', pl."productId", 'variantId', pl."variantId", 'qty', pl."qty"::text))
            FROM "PurchaseLine" pl
            INNER JOIN "Purchase" p ON p."id" = pl."purchaseId"
            WHERE p."businessId" = ${businessId} AND p."id" = ANY(${purchaseIds}::text[])
          ), '[]'::json) AS "purchaseLines",
          COALESCE((
            SELECT json_agg(json_build_object('purchaseId', c."purchaseId", 'productId', c."productId", 'variantId', c."variantId", 'qty', c.qty::text))
            FROM (
              SELECT sl."purchaseId", sl."productId", sl."variantId", SUM(sl."qty") AS qty
              FROM "SaleLine" sl
              INNER JOIN "Sale" s ON s."id" = sl."saleId"
              WHERE s."businessId" = ${businessId} AND sl."purchaseId" = ANY(${purchaseIds}::text[])
              GROUP BY sl."purchaseId", sl."productId", sl."variantId"
            ) c
          ), '[]'::json) AS "consumed",
          COALESCE((
            SELECT json_agg(json_build_object('id', l."id", 'productId', l."productId", 'variantId', l."variantId", 'purchaseId', l."purchaseId", 'status', l."status"))
            FROM "StockLot" l
            WHERE l."businessId" = ${businessId} AND l."id" = ANY(${lotIds}::text[])
          ), '[]'::json) AS "lots",
          COALESCE((
            SELECT json_agg(json_build_object('lotId', b."lotId", 'qty', b.qty::text))
            FROM (
              SELECT "lotId", SUM("qty") AS qty
              FROM "InventoryTransaction"
              WHERE "businessId" = ${businessId} AND "lotId" = ANY(${lotIds}::text[])
              GROUP BY "lotId"
            ) b
          ), '[]'::json) AS "lotBalances"
      `;

      if (!checks?.customerFound) throw new BadRequestException("Customer not found");
      if (checks.productCount !== productIds.length) {
        throw new BadRequestException("One or more products were not found");
      }
      checkLineReferences(dto.lines, {
        categories: checks.categories,
        variants: checks.variants,
        warehouses: [],
        locations: [],
      });

      // Exact StockLot: a lot balance is the sum of its ledger rows (purchase, edit, reversal, sale).
      const lotById = new Map(checks.lots.map((lot) => [lot.id, lot]));
      const balanceByLot = new Map(
        checks.lotBalances.map((row) => [row.lotId, new Prisma.Decimal(row.qty)]),
      );
      for (const line of dto.lines) {
        if (!line.lotId) continue;
        const lot = lotById.get(line.lotId);
        if (!lot) throw new BadRequestException("Source lot not found");
        if (lot.status !== "ACTIVE") throw new BadRequestException("Source lot is voided");
        if (lot.productId !== line.productId || (lot.variantId ?? null) !== (line.variantId ?? null)) {
          throw new BadRequestException("Source lot does not match the sale line product");
        }
        if (line.purchaseId && lot.purchaseId && line.purchaseId !== lot.purchaseId) {
          throw new BadRequestException("Source lot does not belong to the given purchase");
        }
        const requestedFromLot = dto.lines
          .filter((candidate) => candidate.lotId === line.lotId)
          .reduce((sum, candidate) => sum.plus(candidate.qty), new Prisma.Decimal(0));
        const available = balanceByLot.get(line.lotId) ?? new Prisma.Decimal(0);
        if (requestedFromLot.gt(available)) {
          throw new BadRequestException("Insufficient inventory in source lot");
        }
      }

      // Purchase lot (traceability): bought on that purchase minus already sold from it.
      const purchaseFound = new Set(checks.purchaseIds);
      const consumedByLot = new Map(
        checks.consumed.map((row) => [
          `${row.purchaseId}:${row.productId}:${row.variantId ?? ""}`,
          new Prisma.Decimal(row.qty),
        ]),
      );
      for (const line of dto.lines) {
        if (!line.purchaseId) continue;
        if (!purchaseFound.has(line.purchaseId)) {
          throw new BadRequestException("Source purchase lot not found");
        }
        const matchingLines = checks.purchaseLines.filter(
          (purchaseLine) =>
            purchaseLine.purchaseId === line.purchaseId &&
            purchaseLine.productId === line.productId &&
            (!line.variantId || purchaseLine.variantId === line.variantId),
        );
        if (matchingLines.length === 0) {
          throw new BadRequestException("Source purchase lot not found");
        }
        const bought = matchingLines.reduce(
          (sum, purchaseLine) => sum.plus(purchaseLine.qty),
          new Prisma.Decimal(0),
        );
        const lotKey = `${line.purchaseId}:${line.productId}:${line.variantId ?? ""}`;
        const alreadySold = consumedByLot.get(lotKey) ?? new Prisma.Decimal(0);
        const requestedFromLot = dto.lines
          .filter(
            (candidate) =>
              candidate.purchaseId === line.purchaseId &&
              candidate.productId === line.productId &&
              candidate.variantId === line.variantId,
          )
          .reduce((sum, candidate) => sum.plus(candidate.qty), new Prisma.Decimal(0));
        // Quantities are stored at 3 decimals, so this comparison is exact.
        if (requestedFromLot.gt(bought.minus(alreadySold))) {
          throw new BadRequestException("Insufficient inventory in source purchase lot");
        }
      }

      // §22 edge case: sell more than available ⇒ reject, nothing written.
      const productLevels = new Map<string, Prisma.Decimal>();
      const variantLevels = new Map<string, Prisma.Decimal>();
      for (const row of checks.stock) {
        const qty = new Prisma.Decimal(row.qty);
        productLevels.set(
          row.productId,
          (productLevels.get(row.productId) ?? new Prisma.Decimal(0)).plus(qty),
        );
        if (row.variantId) variantLevels.set(`${row.productId}:${row.variantId}`, qty);
      }
      const availableFor = (line: { productId: string; variantId?: string | null }) =>
        line.variantId
          ? variantLevels.get(`${line.productId}:${line.variantId}`) ?? new Prisma.Decimal(0)
          : productLevels.get(line.productId) ?? new Prisma.Decimal(0);
      const requested = new Map<
        string,
        { productId: string; variantId?: string; qty: Prisma.Decimal }
      >();
      for (const line of dto.lines) {
        const key = line.variantId ? `${line.productId}:${line.variantId}` : line.productId;
        const current = requested.get(key);
        requested.set(key, {
          productId: line.productId,
          variantId: line.variantId,
          qty: (current?.qty ?? new Prisma.Decimal(0)).plus(line.qty),
        });
      }
      const variantShortages = [...requested.values()].filter((line) =>
        line.qty.gt(availableFor(line)),
      );
      // Variant lines and product-level lines draw from the same product total,
      // but variant ledger rows never include product-level sales. So the product
      // total must also cover every line for that product.
      const productRequested = new Map<string, Prisma.Decimal>();
      for (const line of dto.lines) {
        productRequested.set(
          line.productId,
          (productRequested.get(line.productId) ?? new Prisma.Decimal(0)).plus(line.qty),
        );
      }
      const productShortages = [...productRequested]
        .filter(([productId, qty]) => qty.gt(productLevels.get(productId) ?? new Prisma.Decimal(0)))
        .map(([productId, qty]) => ({ productId, qty }));
      const shortages = [...variantShortages, ...productShortages];
      if (shortages.length > 0) {
        const first = shortages[0];
        throw new BadRequestException(
          `Insufficient inventory for ${shortages.length} product(s) — ` +
            `first shortage: requested ${first.qty.toString()}, ` +
            `available ${availableFor(first).toString()}`,
        );
      }

      const totals = saleGrandTotalDecimal(
        dto.lines.map((l) => ({ qty: l.qty, rate: l.rate })),
        {
          discountPct: dto.discountPct ?? 0,
          taxPct: dto.taxPct ?? 0,
          loading: dto.loadingCharges ?? 0,
          transport: dto.transportCharges ?? 0,
          labour: dto.labourCharges ?? 0,
        },
      );
      const paidNow = dto.paidNow && dto.paidNow > 0 ? roundMoneyDecimal(dto.paidNow) : new Prisma.Decimal(0);
      if (paidNow.gt(totals.grandTotal)) {
        throw new BadRequestException(
          `Paid-now amount (${paidNow.toFixed(2)}) exceeds the invoice total ` +
            `(${totals.grandTotal.toFixed(2)})`,
        );
      }
      const hasPayment = paidNow.gt(0);

      // Same calendar day Prisma stores for a DateTime @db.Date (UTC day of the instant).
      const saleDate = new Date(dto.date).toISOString().slice(0, 10);
      const saleId = newRecordId();
      const invoiceId = newRecordId();
      const lines = dto.lines.map((line) => {
        const lot = line.lotId ? lotById.get(line.lotId) : undefined;
        return {
          id: newRecordId(),
          txId: newRecordId(),
          productId: line.productId,
          variantId: line.variantId ?? null,
          categoryId: line.categoryId ?? null,
          // Traceability: a line that names an exact lot records that lot's purchase.
          purchaseId: lot?.purchaseId ?? line.purchaseId ?? null,
          lotId: line.lotId ?? null,
          item: line.item,
          attributeSnapshot: line.attributeSnapshot ?? null,
          qualityName: line.qualityName ?? null,
          qty: exact(line.qty),
          unit: line.unit,
          rate: exact(line.rate),
        };
      });
      const discountPct = exact(dto.discountPct ?? 0);
      const taxPct = exact(dto.taxPct ?? 0);
      const loadingCharges = exact(dto.loadingCharges ?? 0);
      const transportCharges = exact(dto.transportCharges ?? 0);
      const labourCharges = exact(dto.labourCharges ?? 0);
      const total = totals.grandTotal.toFixed(2);
      const paid = paidNow.toFixed(2);
      const auditMeta = JSON.stringify({ customerId: dto.customerId, lineCount: lines.length });

      // Round trip 3: sale, lines, §7 stock-out ledger rows (signed −qty), invoice with the
      // next INV-NNNN number, the paid-now receipt and its allocation, and the audit row.
      // Foreign keys between these rows are checked at the end of the statement.
      // The Business UPDATE locks the business row until commit, so two sales can never
      // get the same number; the counter never goes down, so deleted numbers are not reused.
      const [written] = await tx.$queryRaw<SaleWriteRow[]>`
        WITH new_sale AS (
          INSERT INTO "Sale" ("id", "businessId", "date", "customerId", "notes", "discountPct", "taxPct",
                              "loadingCharges", "transportCharges", "labourCharges")
          VALUES (${saleId}, ${businessId}, ${saleDate}::date, ${dto.customerId}, ${dto.notes ?? null},
                  ${discountPct}::numeric, ${taxPct}::numeric, ${loadingCharges}::numeric,
                  ${transportCharges}::numeric, ${labourCharges}::numeric)
          RETURNING "id", "createdAt"
        ),
        line_input AS (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(lines)}::jsonb) AS l(
            "id" text, "txId" text, "productId" text, "variantId" text, "categoryId" text,
            "purchaseId" text, "lotId" text, "item" text, "attributeSnapshot" jsonb,
            "qualityName" text, "qty" numeric, "unit" text, "rate" numeric
          )
        ),
        new_lines AS (
          INSERT INTO "SaleLine" ("id", "businessId", "saleId", "productId", "variantId", "categoryId",
                                  "purchaseId", "lotId", "item", "attributeSnapshot", "qualityName",
                                  "qty", "unit", "rate")
          SELECT l."id", ${businessId}, s."id", l."productId", l."variantId", l."categoryId",
                 l."purchaseId", l."lotId", l."item", l."attributeSnapshot", l."qualityName",
                 l."qty", l."unit", l."rate"
          FROM line_input l CROSS JOIN new_sale s
          RETURNING "id"
        ),
        new_ledger AS (
          INSERT INTO "InventoryTransaction" ("id", "businessId", "productId", "categoryId", "variantId",
                                              "saleLineId", "lotId", "attributeSnapshot", "unit", "type",
                                              "qty", "referenceType", "referenceId", "date")
          SELECT l."txId", ${businessId}, l."productId", l."categoryId", l."variantId",
                 l."id", l."lotId", l."attributeSnapshot", l."unit", 'SALE'::"InventoryTxType",
                 -l."qty", 'SALE', s."id", ${saleDate}::date
          FROM line_input l CROSS JOIN new_sale s
          RETURNING "id"
        ),
        seq AS (
          UPDATE "Business" SET "invoiceSeq" = "invoiceSeq" + 1
          WHERE "id" = ${businessId}
          RETURNING "invoiceSeq"
        ),
        new_invoice AS (
          INSERT INTO "Invoice" ("id", "businessId", "saleId", "number", "total", "paid")
          SELECT ${invoiceId}, ${businessId}, s."id",
                 'INV-' || CASE WHEN length(q."invoiceSeq"::text) >= 4
                                THEN q."invoiceSeq"::text
                                ELSE lpad(q."invoiceSeq"::text, 4, '0') END,
                 ${total}::numeric, ${paid}::numeric
          FROM seq q CROSS JOIN new_sale s
          RETURNING "id", "number", "createdAt"
        ),
        new_payment AS (
          INSERT INTO "Payment" ("id", "businessId", "date", "type", "customerId", "amount", "method", "saleId")
          SELECT ${newRecordId()}, ${businessId}, ${saleDate}::date, 'CUSTOMER'::"PaymentType",
                 ${dto.customerId}, ${paid}::numeric, 'CASH'::"PaymentMethod", s."id"
          FROM new_sale s
          WHERE ${hasPayment}::boolean
          RETURNING "id"
        ),
        new_allocation AS (
          INSERT INTO "PaymentAllocation" ("id", "businessId", "paymentId", "saleId", "amount")
          SELECT ${newRecordId()}, ${businessId}, p."id", s."id", ${paid}::numeric
          FROM new_payment p CROSS JOIN new_sale s
          RETURNING "id"
        ),
        new_audit AS (
          INSERT INTO "AuditLog" ("id", "businessId", "actorId", "action", "entityType", "entityId", "metadata")
          VALUES (${newRecordId()}, ${businessId}, NULL, 'sale.created', 'sale', ${saleId}, ${auditMeta}::jsonb)
          RETURNING "id"
        )
        SELECT s."createdAt" AS "saleCreatedAt",
               i."id" AS "invoiceId",
               i."number" AS "invoiceNumber",
               i."createdAt" AS "invoiceCreatedAt",
               (SELECT COUNT(*)::int FROM new_lines) AS "lineCount",
               (SELECT COUNT(*)::int FROM new_ledger) AS "ledgerCount"
        FROM new_sale s
        LEFT JOIN new_invoice i ON TRUE
      `;
      if (!written?.invoiceId || !written.invoiceNumber) {
        throw new NotFoundException("Business not found");
      }
      if (written.lineCount !== lines.length || written.ledgerCount !== lines.length) {
        throw new Error("Sale write did not insert every line");
      }

      const invoice = {
        id: written.invoiceId,
        businessId,
        saleId,
        number: written.invoiceNumber,
        total: totals.grandTotal,
        paid: paidNow,
        createdAt: written.invoiceCreatedAt,
      };
      // Same shape as the stored rows, so the client can merge it without a reload.
      const sale = {
        id: saleId,
        businessId,
        date: new Date(saleDate),
        customerId: dto.customerId,
        notes: dto.notes ?? null,
        discountPct: new Prisma.Decimal(discountPct),
        taxPct: new Prisma.Decimal(taxPct),
        loadingCharges: new Prisma.Decimal(loadingCharges),
        transportCharges: new Prisma.Decimal(transportCharges),
        labourCharges: new Prisma.Decimal(labourCharges),
        createdAt: written.saleCreatedAt,
        lines: lines.map(({ txId: _txId, ...line }) => ({
          ...line,
          businessId,
          saleId,
          qty: new Prisma.Decimal(line.qty),
          rate: new Prisma.Decimal(line.rate),
        })),
        invoice,
      };
      return { sale, invoice: { ...invoice, total: totals.grandTotal.toNumber() } };
    });
  }

  async list(businessId: string, skip: number, take: number, customerId?: string) {
    const where = this.baseWhere(businessId, customerId);
    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        relationLoadStrategy: "join",
        where,
        skip,
        take,
        include: listInclude,
        orderBy: listOrder,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return [items, total] as const;
  }

  /** Bulk fetch for /ledger/transactions — one findMany, no count. */
  listAll(businessId: string, take: number) {
    return this.prisma.sale.findMany({
      relationLoadStrategy: "join",
      where: this.baseWhere(businessId),
      include: listInclude,
      orderBy: listOrder,
      take,
    });
  }

  private baseWhere(businessId: string, customerId?: string): Prisma.SaleWhereInput {
    return {
      businessId,
      ...(customerId ? { customerId } : {}),
    };
  }

  async byId(businessId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        invoice: true,
        lines: { include: { product: { select: { id: true, name: true, unit: true } } } },
      },
    });
    if (!sale) throw new NotFoundException("Sale not found");
    return sale;
  }

  /**
   * Delete = reversal ledger rows + payment cleanup + invoice gone, atomically.
   *
   * Latency: five round trips (BEGIN, lock statement, one cleanup statement, the
   * sale delete, COMMIT).
   * The sale delete is its own statement: it cascades to the lines and sets
   * `saleLineId` to NULL on their ledger rows, including the reversal rows just written,
   * the same end state as before.
   */
  async remove(businessId: string, id: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const reversalIds = Array.from({ length: LIMITS.MAX_LINES_PER_DOC }, () => newRecordId());

      const [sale] = await tx.$queryRaw<{ id: string; date: string }[]>`
        SELECT s."id", to_char(s."date", 'YYYY-MM-DD') AS "date",
          (SELECT string_agg(l, '') FROM (
             SELECT pg_advisory_xact_lock(hashtext(k))::text AS l
             FROM (SELECT DISTINCT k FROM "SaleLine" sl CROSS JOIN LATERAL (VALUES
                    ('stock:' || ${businessId} || ':' || sl."productId" || ':' || COALESCE(sl."variantId", '_')),
                    ('stock:' || ${businessId} || ':' || sl."productId" || ':_'),
                    (CASE WHEN sl."purchaseId" IS NOT NULL
                          THEN 'lot:' || ${businessId} || ':' || sl."purchaseId" || ':' || sl."productId" || ':' || COALESCE(sl."variantId", '_')
                          ELSE NULL END)) v(k)
                   WHERE sl."saleId" = s."id" AND k IS NOT NULL) keys
             ORDER BY k COLLATE "C") taken) AS "locked"
        FROM "Sale" s WHERE s."id" = ${id} AND s."businessId" = ${businessId}
      `;
      if (!sale) throw new NotFoundException("Sale not found");

      const saleId = sale.id;
      const saleDate = sale.date;

      // One statement for everything that hangs off the sale:
      // - the reversal ledger rows,
      // - this sale's allocations,
      // - payments recorded against this sale (paid-now and targeted receipts),
      // - untargeted (FIFO) payments whose only allocations were to this sale,
      //   so no money record is left that settles nothing,
      // - the invoice, and the audit row.
      // Every sub-statement sees the rows as they were before the statement, so the
      // FIFO check reads the allocations before they are deleted.
      await tx.$executeRaw`
        WITH reversal_input AS (
          -- One pre-generated id per line (a sale has at most MAX_LINES_PER_DOC lines).
          SELECT (${reversalIds}::text[])[sl."rn"] AS "id",
                 sl."productId", sl."categoryId", sl."variantId",
                 sl."id" AS "saleLineId",
                 sl."lotId", sl."attributeSnapshot", sl."unit", sl."qty"
          FROM (
            SELECT line.*, (row_number() OVER (ORDER BY line."id"))::int AS "rn"
            FROM "SaleLine" line
            WHERE line."saleId" = ${id}
          ) sl
        ),
        new_reversals AS (
          INSERT INTO "InventoryTransaction" ("id", "businessId", "productId", "categoryId", "variantId",
                                              "saleLineId", "lotId", "attributeSnapshot", "unit", "type",
                                              "qty", "referenceType", "referenceId", "date")
          SELECT r."id", ${businessId}, r."productId", r."categoryId", r."variantId",
                 r."saleLineId", r."lotId", r."attributeSnapshot", r."unit", 'RETURN'::"InventoryTxType",
                 r."qty", 'SALE_DELETE', ${saleId}, ${saleDate}::date
          FROM reversal_input r
          RETURNING "id"
        ),
        orphan_payments AS (
          DELETE FROM "Payment" p
          WHERE p."businessId" = ${businessId}
            AND p."saleId" IS NULL
            AND p."id" IN (
              SELECT a."paymentId" FROM "PaymentAllocation" a
              WHERE a."businessId" = ${businessId} AND a."saleId" = ${saleId}
            )
            AND NOT EXISTS (
              SELECT 1 FROM "PaymentAllocation" other
              WHERE other."paymentId" = p."id" AND other."saleId" IS DISTINCT FROM ${saleId}
            )
          RETURNING p."id"
        ),
        sale_payments AS (
          DELETE FROM "Payment"
          WHERE "businessId" = ${businessId} AND "saleId" = ${saleId}
          RETURNING "id"
        ),
        sale_allocations AS (
          DELETE FROM "PaymentAllocation"
          WHERE "businessId" = ${businessId} AND "saleId" = ${saleId}
          RETURNING "id"
        ),
        sale_invoice AS (
          DELETE FROM "Invoice"
          WHERE "businessId" = ${businessId} AND "saleId" = ${saleId}
          RETURNING "id"
        ),
        new_audit AS (
          INSERT INTO "AuditLog" ("id", "businessId", "actorId", "action", "entityType", "entityId")
          VALUES (${newRecordId()}, ${businessId}, ${actorId ?? null}, 'sale.deleted', 'sale', ${saleId})
          RETURNING "id"
        )
        SELECT 1
      `;
      await tx.sale.delete({ where: { id: saleId, businessId } });

      return { deleted: true, saleId };
    });
  }
}
