# Final Performance Audit

**Date:** 2026-09-18  
**Environment:** NestJS 11 + Prisma 6 + Neon PostgreSQL (ap-southeast-1 pooler)  
**Test dataset:** SCALE≈200 (`cmu6jnet80000ldqoq3eqmqmi`) — 201 customers, 200 sales, 200 purchases, 1000 payments  
**Method:** `node scripts/final-performance-audit.mjs` (10 warm iterations, HTTP + direct Prisma profiling)

---

## Completed optimizations (this audit)

| Change | Effect |
|--------|--------|
| `GET /ledger/transactions` bulk endpoint | One HTTP/JWT round-trip instead of ~15 paginated list requests for bootstrap |
| Client `StoreProvider` uses `/ledger/transactions` | Same in-memory data; fewer network hops |
| Reports: skip `costPurchases` when period has zero sales | Avoids loading all historical purchases when COGS cannot apply |
| Prior work retained | N+1 fixes, composite indexes, pagination, dashboard aggregation |

---

## 1. Reports / COGS

### Measured (March 2025, 0 sales in period)

| Metric | Value |
|--------|-------|
| Purchases in period | 0 |
| Sales in period | 0 |
| Cost purchases loaded (before fix) | **200** (all business purchases) |
| Cost purchases loaded (after fix) | **0** |
| DB queries (fetch phase) | 5 |
| DB time | **1132 ms** |
| Node COGS calculation | **1.27 ms** |
| Heap delta (fetch) | 1.43 MB |

**Conclusion:** The bottleneck is **PostgreSQL fetch latency** (remote Neon), not Node.js COGS math. Node calculation is negligible (&lt;2 ms).

### Scale projection

| Records (sales in period) | Expected behavior |
|---------------------------|-------------------|
| 10k | Loads period sales + scoped cost purchases; DB time grows linearly with rows returned |
| 100k | Same; bounded by 2-year max date range |
| 1M | Would require archival/partitioning strategy — **not tested** |

### SQL migration for COGS?

**Not implemented.** Reason:

The landed-cost engine averages multiple lines per `purchaseId:productId`, applies lot-specific costs when `purchaseId` is set, and falls back to a **weighted average across all cost purchases** otherwise (`reports.service.ts` + `domain/profit.ts`). Reproducing this exactly in SQL risks divergent COGS/profit without formal equivalence proofs.

| | Current | Proposed SQL |
|---|---------|--------------|
| Behavior | JS maps + `computeProfit` | Window functions / CTEs |
| Risk | Known correct | Possible rounding / averaging differences |

**Status:** Documented limitation. Safe micro-optimization applied (skip cost purchases when no period sales).

---

## 2. Client bootstrap

### Current flow (after optimization)

| Step | Endpoint | Purpose |
|------|----------|---------|
| 1 | `GET /ledger/bootstrap` | Catalogue, settings, staff, dashboard summary, counts |
| 2 | `GET /ledger/transactions` | All customers, suppliers, purchases, sales, payments, expenses, stock-checks |

### Before vs after (SCALE=200, measured HTTP p50)

| Flow | HTTP requests | Est. p50 total |
|------|---------------|----------------|
| **Before** (`fetchAllPages` × 7) | ~18 (bootstrap + paginated lists) | **~17.5 s** (bootstrap 1.6s + lists ~15.9s) |
| **After** (bulk transactions) | **2** | **~8.2 s** (bootstrap 1.6s + transactions 6.6s) |

### Data classification

| Category | Data | Load strategy |
|----------|------|---------------|
| Required at init | Catalogue, settings, staff, dashboard summary | Bootstrap |
| Required for current UI | Full transaction history (audit, balances, dashboard derivations) | Transactions bulk |
| Paginated elsewhere | Sales list tab (`usePaginatedSales`) | On-demand per page |
| On-demand | Reports, customer ledger, supplier payables | Per-route API |

**Why full transactions still load:** The React store computes customer balances, supplier payables, inventory, audit reconciliation, and dashboard stats from the complete in-memory ledger. Removing this would change UI behavior. The optimization reduces **round-trips**, not required data.

### Future path (not implemented)

Route-level lazy loading would require refactoring `useStore()` consumers — out of scope for this audit.

---

## 3. Customer endpoint — 819 ms investigation

### Root cause (measured, not assumed)

The customer list SQL is **fast**. Total latency is dominated by **network + JWT validation + Neon round-trip**.

```
Before (cold single sample from SCALE=200 benchmark):
  Total:     ~819 ms (HTTP)
  DB:        ~603 ms (4 Prisma queries — includes connection overhead)
  Node:      ~803 ms (serialization + Prisma client)
  Queries:   4 (JWT path) + 2 (list transaction) = 6 per HTTP request
  Payload:   ~9.5 KB (50 customers)

After warmup (10 iterations, HTTP):
  Total:     p50 691 ms, p95 822 ms
  DB:        Index scan execution 0.067 ms (EXPLAIN ANALYZE)
  Node:      Remainder after DB
  Queries:   3 per request (1 JWT user lookup + 2 list)
  Payload:   9,482 bytes
```

| Check | Result |
|-------|--------|
| N+1 | **None** — 2 queries in `$transaction` |
| Balance calculation | **None** on list endpoint |
| Unnecessary relations | **None** |
| Missing index | **No** — `Customer(businessId, createdAt)` used |
| JS aggregation | **None** |
| Index EXPLAIN | `Index Scan` 0.067 ms execution |

**Fix applied:** None required at application layer. Latency is infrastructure (Neon AP-Southeast from local dev). Bulk `/ledger/transactions` reduces repeated JWT+list overhead during bootstrap.

---

## 4. Search (`ILIKE '%term%'`)

| Customers | Query time | Plan | Seq scan? |
|-----------|------------|------|-----------|
| 201 (SCALE=200) | **0.04–0.14 ms** execution | `Limit` + filter | Yes, on tiny table |

**Conclusion:** Theoretical concern only at current scale. At 100k+ customers with heavy search, evaluate `pg_trgm`. **Not added** — no measured bottleneck.

---

## 5. Query count audit (SCALE=200)

| Endpoint | DB queries (service layer) | Rows returned | Response size | HTTP p50 |
|----------|---------------------------|---------------|---------------|----------|
| Bootstrap | ~12 (parallel transaction) | Catalogue only | 45 KB | 1618 ms |
| Transactions bulk | ~28 (7 types × pages) | Full ledger | 811 KB | 6616 ms |
| Customers list | 2 | 50 | 9.5 KB | 691 ms |
| Suppliers list | 2 | 1 | 235 B | 607 ms |
| Sales list | 2 | 50 | 44 KB | 915 ms |
| Purchases list | 2 | 50 | 42 KB | 918 ms |
| Payments list | 2 | 50 | 19 KB | 809 ms |
| Inventory stock | 2 | per product | 18 KB | 409 ms |
| Reports profit | 5+ (period) | Aggregated | 23 KB | 1486 ms |
| Sale create | ~15–30 (transaction) | 1 | — | not profiled |
| Payment create | ~5–15 (FIFO) | 1 | — | not profiled |

JWT adds **1 DB query per HTTP request** (~400 ms to Neon from test environment).

---

## 6. Large dataset benchmarks

| SCALE | Status | Notes |
|-------|--------|-------|
| 200 | **Measured** | Full audit results above |
| 1,000 | Not re-seeded | Seed script creates purchases/sales sequentially (~2 min per 100) |
| 10,000 | Not run | Would require ~3+ hours seed time |
| 100,000 | Not run | Impractical without bulk seed tooling |

**Extrapolation from EXPLAIN:** List queries use index scans with sub-ms execution; HTTP p50 scales with **(JWT latency × requests) + (rows × serialization)**. Bulk transactions endpoint keeps request count constant as data grows; **payload and DB page fetches grow linearly**.

---

## 7. Index validation

| Index | Query | Used? | Execution |
|-------|-------|-------|-----------|
| `Customer(businessId, createdAt)` | Customer list | Yes | 0.067 ms |
| `Sale(businessId, customerId, date)` | Customer FIFO | Yes | 0.231 ms |
| `Purchase(businessId, supplierId, date)` | Supplier FIFO | Yes | 0.144 ms |
| `SaleLine(purchaseId, productId, variantId)` | Lot aggregate | Hash join at current size | 0.228 ms |

No redundant indexes removed. Write overhead acceptable at current volume.

---

## 8. PostgreSQL statistics

| Table | Live rows | Dead rows | Last analyze |
|-------|-----------|-----------|--------------|
| Payment | 2,032 | 0 | auto 2026-09-18 |
| Sale | 428 | 0 | auto 2026-09-18 |
| Customer | ~201 | 0 | auto |

Estimates match actuals at tested scale. Autovacuum active. No manual `ANALYZE` required.

---

## 9. Connection pool

| Test | Result |
|------|--------|
| 20 concurrent customer list | wall 1922 ms, p95 1917 ms, **0 failures** |
| 20 concurrent sales list | wall 2033 ms, p95 2028 ms, **0 failures** |
| 20 concurrent inventory | wall 820 ms, **0 failures** |
| 20 concurrent bootstrap | wall 4046 ms, **0 failures** |

No connection exhaustion observed. Neon pooler handles concurrent JWT+query patterns. Pool size not increased.

---

## 10. Concurrent mutations

Previously implemented advisory locks and atomic invoice/purchase paid increments **unchanged**. Not re-benchmarked in this audit; unit tests pass.

---

## 11. API payload audit

| Endpoint | Size | Notes |
|----------|------|-------|
| Transactions bulk | **811 KB** | Largest payload — necessary for store hydration |
| Sales list page | 44 KB | Includes lines + invoice |
| Purchases list page | 42 KB | Includes lines + supplier |
| Bootstrap | 45 KB | Catalogue only — appropriate |

List endpoints already use `select` on relations where applicable. Further field trimming would break client adapters.

---

## 12. Memory audit

| Operation | Heap delta |
|-----------|------------|
| Reports fetch (200 cost purchases) | +1.43 MB |
| Transactions bulk | Loads full arrays in Node for JSON serialization |

At SCALE=200, memory is acceptable. At 100k+ transactions, bulk load would require **architectural change** (not implemented).

---

## Performance table

| Endpoint | SCALE | Before | After | DB time | Query count |
|----------|-------|--------|-------|---------|-------------|
| Bootstrap (HTTP) | 200 | 3476 ms* | **1618 ms** p50 | ~1.2 s | ~12 |
| Transaction load | 200 | ~15900 ms* (18 requests) | **6616 ms** p50 | ~5 s | ~28 |
| Customers list | 200 | 819 ms* | **691 ms** p50 | 0.07 ms SQL | 3 HTTP |
| Reports (empty period sales) | 200 | ~2371 ms* | **&lt;500 ms** est. post-fix | 1132→~200 ms est. | 5→4 |

\*Earlier single-sample benchmarks from `performance-seed.mjs`; **After** columns from warm 10-iteration audit.

---

## Business logic

**Confirmed unchanged** for:

- Inventory, purchases, sales, payments, FIFO settlement
- Customer/supplier balances and dues
- COGS / profit semantics (`computeProfit`, landed cost weighting)
- Reports when period contains sales (cost purchase scoping identical)
- Staff permissions and tenant isolation

**Safe change:** When a report period has **zero sales**, `costPurchases` is empty — COGS was already zero; no profit figures change.

---

## Final status

```
PRODUCTION READY WITH KNOWN PERFORMANCE LIMITATIONS
```

**Ready because:**

- No N+1 on audited paths
- Indexes validated with EXPLAIN
- Bootstrap HTTP round-trips cut ~50%
- Pagination enforced
- Concurrency protections intact
- Business logic preserved

**Known limitations:**

1. **Neon network latency** dominates per-request time (~400–700 ms from test environment) — not an application bug
2. **Full transaction bulk load** still required by current UI architecture — grows linearly with tenant size
3. **COGS** remains in Node.js when period has sales — DB fetch scales with period volume
4. **SCALE 10k+** not fully benchmarked — recommend bulk seed + re-run `npm run perf:audit` before high-volume launch

---

## Commands

```bash
cd server
npm run perf:audit                    # Full audit
npm run perf:seed                     # Seed SCALE=200+
npm run db:explain                    # EXPLAIN ANALYZE suite
BUSINESS_ID=<id> npm run perf:audit   # Audit specific tenant
```

Results JSON: `server/audit-results/final-performance-audit.json`
