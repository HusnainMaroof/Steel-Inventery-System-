# Database & Query Optimization Report

**Date:** 2026-09-18  
**Scope:** NestJS backend + PostgreSQL (Prisma)  
**Constraint:** All business logic preserved — no changes to FIFO, balances, profit, inventory, or permissions.

---

## Executive summary

| Area | Status |
|------|--------|
| N+1 elimination (critical paths) | Fixed |
| Pagination on collection endpoints | Already enforced (`PaginationDto`, max 100) |
| Dashboard aggregation | Already uses SQL/`groupBy` (no full-table loads) |
| Composite indexes for hot paths | Added (migration `20260918120000`) |
| EXPLAIN ANALYZE verification | Run via `server/scripts/explain-audit.mjs` |
| Unit tests | 36 passed |
| Business logic | Unchanged |

**Production readiness:** Ready for deployment after `npm run prisma:deploy` in `server/`. Remaining items are documented under [Remaining bottlenecks](#remaining-bottlenecks) — none require business-logic changes.

---

## 1. Query audit

### Collection endpoints (pagination)

All list endpoints use `PaginationDto` (`page` default 50, `limit` max 100):

| Endpoint | Service | Pagination | Notes |
|----------|---------|------------|-------|
| `GET /customers` | `customers.service.list` | Yes | `businessId`, optional search |
| `GET /suppliers` | `suppliers.service.list` | Yes | `businessId`, optional search |
| `GET /products` | `products.service.list` | Yes | Heavy `include` for catalogue tree |
| `GET /sales` | `sales.service.list` | Yes | Customer + invoice + lines |
| `GET /purchases` | `purchases.service.list` | Yes | Supplier + lines |
| `GET /payments` | `payments.service.list` | Yes | Allocations included |
| `GET /expenses` | `expenses.service.list` | Yes | Date/product filters |
| `GET /invoices` | `invoices.service.list` | Yes | Sale + customer |
| `GET /stock-checks` | `stock-checks.service.list` | Yes | |
| `GET /users` | `users.service.listStaff` | Yes | Staff only |
| `GET /inventory/lots` | `inventory.service.lots` | Yes | |
| `GET /inventory/movements` | `inventory.service.movements` | Yes | |
| `GET /customers/:id/ledger` | `customers.service.ledger` | Yes | |
| `GET /suppliers/:id/payables` | `suppliers.service.payables` | Yes | |

### Unbounded reads (by design — aggregated/small)

| Endpoint | Rows possible | Rationale |
|----------|---------------|-----------|
| `GET /inventory/stock` | Per active product | `groupBy` + product list |
| `GET /inventory/variants` | Per variant group | `groupBy` + lookup maps |
| `GET /ledger/bootstrap` | Catalogue config only | Transactions loaded via paginated lists |
| `GET /reports/profit` | Period-bounded | Max 2-year range enforced |

### Detailed audit table (hot paths)

| Endpoint | Query pattern | Tables | Rows (typical) | Index used | N+1 (before) | Pagination | Optimization |
|----------|---------------|--------|----------------|------------|--------------|------------|--------------|
| `GET /platform/overview` | Per-owner 30d counts | Sale, Purchase, Payment | N owners | `businessId` | **Yes (3×N)** | N/A (admin) | **3× `groupBy`** |
| `POST /payments` (customer FIFO) | Open sales + per-allocation invoice | Sale, Invoice | Per customer | `(businessId, customerId, date)` | **Yes (per alloc)** | N/A | **Batch invoice `findMany`** |
| `POST /payments` (supplier FIFO) | All purchases + lines | Purchase, PurchaseLine | Per supplier | `(businessId, supplierId, date)` | No | N/A | **SQL goods subquery** |
| `POST /sales` | Per-line category/variant/lot | Many | Per line (≤50) | Various | **Yes (≤3×lines)** | N/A | **Batch validation + lot aggregate** |
| `POST /purchases` | Per-line refs | Many | Per line (≤50) | Various | **Yes (≤4×lines)** | N/A | **`assertLineReferences` batch** |
| `DELETE /sales/:id` | Per-payment orphan check | Payment, PaymentAllocation | Per payment | `paymentId` | **Yes (per payment)** | N/A | **`groupBy` once** |
| `GET /inventory/lots` | All consumed lots | SaleLine | All business | `(purchaseId, productId, variantId)` | No | Yes | **Scope to page purchase IDs** |
| `GET /ledger/bootstrap` | Catalogue + counts | Many | Small | `businessId` | No | N/A | Already slim (v3) |
| `GET /reports/profit` | Period sales/purchases | Sale, Purchase | Period-bound | `(businessId, date)` | No | N/A | Bounded; JS cost calc required |
| Dashboard summary | Aggregates | Invoice, InventoryTx, Purchase | 1 row each | `businessId` | No | N/A | Already aggregated |

---

## 2. N+1 issues fixed

### Platform overview (`platform.service.ts`)

**Before:** For each owner, 3 `count()` queries → `3 × N` DB round-trips.  
**After:** 3 `groupBy({ by: ['businessId'] })` queries → **3 total** via `activityCountsByBusiness()`.

### Customer payment FIFO (`payments.service.ts`)

**Before:** One `invoice.findFirst` per FIFO allocation.  
**After:** Single `invoice.findMany({ saleId: { in: [...] } })`, then in-memory map.

### Supplier payment FIFO (`payments.service.ts`)

**Before:** `purchase.findMany` with `include: { lines: true }` for every supplier payment.  
**After:** `openPurchasesForSupplier()` — SQL computes `SUM(qty × rate)` per purchase without loading line rows.

### Sale creation (`sales.service.ts`)

**Before:** Per-line `findFirst` for category, variant, purchase; per-line `saleLine.aggregate` for lot consumption.  
**After:**
- `assertLineReferences()` — 4 batched `findMany` calls max
- `consumedQtyByLot()` — one grouped SQL for all purchase IDs on the document

### Purchase validation (`purchases.service.ts`)

**Before:** Per-line warehouse/location/category/variant lookups.  
**After:** Shared `assertLineReferences()` batch helper.

### Sale deletion (`sales.service.ts`)

**Before:** `paymentAllocation.count` per linked payment ID.  
**After:** One `groupBy({ by: ['paymentId'] })`, delete orphans in one `deleteMany`.

### Inventory lots page (`inventory.service.ts`)

**Before:** `saleLine.groupBy` for **all** business lots on every paginated request.  
**After:** `groupBy` scoped to `purchaseId IN (current page IDs)`.

---

## 3. Indexes added

Migration: `prisma/migrations/20260918120000_production_query_indexes`

| Index | Supports |
|-------|----------|
| `Customer(businessId, createdAt)` | Customer list `ORDER BY createdAt` |
| `Supplier(businessId, createdAt)` | Supplier list `ORDER BY createdAt` |
| `Purchase(businessId, supplierId, date)` | Supplier FIFO settlement |
| `Sale(businessId, customerId, date)` | Customer FIFO open invoices |
| `Sale(businessId, createdAt)` | Platform recent activity |
| `SaleLine(purchaseId, productId, variantId)` | Lot consumption aggregate |
| `InventoryTransaction(businessId, productId, date)` | Filtered movement history |

**Not added (existing indexes sufficient):**
- `Invoice(businessId, createdAt)` — already present
- `Payment(businessId, type, date)` — already present

**Over-indexing avoided:** No per-column indexes on low-cardinality flags (`active`, etc.).

---

## 4. EXPLAIN ANALYZE results

Run: `node server/scripts/explain-audit.mjs`

Sample results (business with seed data, post-migration):

| Query | Execution time | Plan highlight |
|-------|----------------|----------------|
| Sales list (LIMIT 50) | **1.16 ms** | Index Scan `Sale_businessId_date_idx` |
| Customer FIFO invoices | **0.07 ms** | Index Scan on Sale + Invoice join |
| Supplier FIFO purchases | **0.56 ms** | Index Scan `Purchase_businessId_date_idx` |
| Lot consumption GROUP BY | **<1 ms** | Hash Join SaleLine → Sale (small table) |
| Dashboard invoice SUM | **<1 ms** | Aggregate on Invoice by businessId |
| Inventory movements | Uses `(businessId, date)` index | Paginated LIMIT 50 |

On large tables, expect `SaleLine` lot aggregate to use `SaleLine_purchaseId_productId_variantId_idx` once purchase volume grows.

---

## 5. Before / after measurements

### Structural (query count)

| Operation | Before (DB calls) | After (DB calls) |
|-----------|-------------------|------------------|
| Platform overview (50 owners) | ~153 | **6** (4 parallel + 3 groupBy) |
| Customer payment (5 FIFO allocations) | ~7 | **~4** |
| Supplier payment | 1 + full line load | **1** SQL query |
| Sale create (10 lines, 3 lots) | ~30+ | **~8** |
| Sale delete (3 linked payments) | 3 count loops | **1** groupBy |
| Inventory lots page | 1 + **full business** groupBy | 1 + **page-scoped** groupBy |

### API benchmarks (post-optimization, SCALE=200, Neon AP-Southeast)

| Endpoint | Response time | Payload |
|----------|---------------|---------|
| `GET /ledger/bootstrap` | 3476 ms | 45 KB |
| `GET /sales?page=1&limit=50` | 1646 ms | 200 total |
| `GET /customers?page=1&limit=50` | 819 ms | 201 total |
| `GET /reports/profit` | 2371 ms | aggregated |
| `GET /inventory/stock` | 623 ms | per-product |

Run locally: `SCALE=500 node server/scripts/performance-seed.mjs` (requires server on port 4000).

> Note: Structural before counts are derived from code inspection. API timings are post-optimization only; re-run the seed script before releases to track regression.

---

## 6. Concurrency

**Already safe (unchanged):**

| Operation | Mechanism |
|-----------|-----------|
| Sale stock deduction | Advisory locks + ledger check in same transaction |
| Invoice `paid` increment | `incrementInvoicePaidOrThrow` conditional update |
| Purchase `paid` increment | `incrementPurchasePaid` with goods cap |
| Customer/supplier payments | `pg_advisory_xact_lock` per party |

No application-level read-then-write race paths were introduced or removed.

---

## 7. Connection pooling

| Setting | Current |
|---------|---------|
| ORM | Prisma 6.x |
| Pooled URL | `DATABASE_URL` (Neon pooler) |
| Direct URL | `DIRECT_URL` (migrations, EXPLAIN) |
| Pool sizing | Managed by Neon pooler — do not raise Prisma `connection_limit` without calculating `instances × pool ≤ DB max` |

**Recommendation:** For multiple app instances, use Neon's pooled endpoint for runtime and keep `DIRECT_URL` for migrations only.

---

## 8. Pagination & cursor evaluation

| Table | Current | Cursor pagination |
|-------|---------|-------------------|
| Sales, purchases, payments | Offset (`page`/`limit`) | Evaluate when >100k rows/tenant and deep pages lag |
| Audit logs | Not exposed yet | Use cursor when added |
| Inventory movements | Offset | Cursor candidate at high volume |

Offset pagination is acceptable at current scale. `MAX_PAGE_SIZE=100` prevents abuse.

---

## 9. Remaining bottlenecks

| Item | Impact | Recommendation | Business logic change? |
|------|--------|----------------|------------------------|
| `GET /reports/profit` loads period sales/purchases into Node | High for multi-year ranges | Pre-aggregate COGS in SQL (future) | Would need approval |
| `GET /products` list includes full catalogue tree | Medium for large catalogues | Separate lightweight list endpoint | API shape change |
| Customer/supplier `ILIKE '%term%'` search | Seq scan at scale | `pg_trgm` index if search is slow | No |
| Client `fetchAllPages` loads all transactions at bootstrap | High for large tenants | Server-side incremental sync | Client change |
| Performance seed creates purchases/sales one-by-one | Dev tooling only | Batch seed script | N/A |

---

## 10. Business logic preservation

Confirmed unchanged:

- Purchase goods total, charges, and `paid` semantics
- Sale creation, lot traceability, and inventory ledger writes
- FIFO customer invoice settlement (`settleFifo`)
- FIFO supplier purchase settlement (oldest unpaid first)
- Profit calculation (`computeProfit`, landed cost weighting)
- Customer/supplier balance derivation (never stored)
- Sale deletion reversal (RETURN ledger rows + payment cleanup)
- Staff permissions and `businessId` isolation
- Report period bounds (max 2 years)

---

## 11. Files changed

| File | Change |
|------|--------|
| `server/src/common/prisma/query-helpers.ts` | New — lot consumption, supplier FIFO SQL, activity groupBy |
| `server/src/common/catalog/line-reference-validation.ts` | New — batch line reference validation |
| `server/src/platform/platform.service.ts` | N+1 fix |
| `server/src/payments/payments.service.ts` | Batch invoices, SQL supplier FIFO |
| `server/src/sales/sales.service.ts` | Batch validation, orphan payment cleanup |
| `server/src/purchases/purchases.service.ts` | Batch validation |
| `server/src/inventory/inventory.service.ts` | Scoped lot consumption |
| `server/prisma/schema.prisma` | Composite indexes |
| `server/prisma/migrations/20260918120000_production_query_indexes/` | Index migration |
| `server/scripts/explain-audit.mjs` | EXPLAIN ANALYZE runner |

---

## 12. Verification checklist

- [x] No significant N+1 on critical mutation/list paths
- [x] No unbounded collection endpoints
- [x] Pagination enforced (max 100)
- [x] Important queries have composite indexes
- [x] EXPLAIN ANALYZE script provided and executed
- [x] Dashboard uses database aggregation
- [x] Reports bounded by date range
- [x] Inventory writes concurrency-safe
- [x] Payment writes concurrency-safe
- [x] Prisma connection pooling documented
- [x] Unit tests pass
- [x] No Redis/cache introduced
- [x] No business logic changes

---

## 13. Deploy steps

```bash
cd server
npm run prisma:deploy
npm run build
npm test
node scripts/explain-audit.mjs   # optional, against production-like data
```
