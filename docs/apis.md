# APIs

> Status: the backend **now exists as a scaffold** in `server/` — NestJS +
> Fastify + Prisma (modular monolith), REST under `/api/v1`, PostgreSQL on
> Neon. It compiles and its money/inventory logic is unit-tested; running it
> and applying migrations need a Neon `DATABASE_URL` in `server/.env` (see
> `server/README.md`). The client app still runs on its in-memory store;
> wiring the frontend to these endpoints is the next step.

## 1. Current internal data API (client-side, no server)

All functions live in `client/src/lib/` and are pure — any screen can call
them, so two screens can never disagree on a figure.

### Store mutations (`client/src/lib/store.tsx`)

| Function | Purpose |
|---|---|
| `addPurchase(p)` | records a purchase lot; raises inventory |
| `updatePurchase(id, patch)` | edits a purchase |
| `deletePurchase(id)` | cascades: stock out, dues cleared, payments removed |
| `addSale(s)` | creates an invoice (auto `invoiceNo` + `createdAt`); lowers stock |
| `deleteSale(id)` | cascades: stock back, payments removed |
| `addPayment(p)` | customer (FIFO to oldest unpaid invoice) or supplier payment |
| `addCustomer(c)` / `addSupplier(s)` | party records |
| `addExpense(e)` | shop-wide or product-tagged expense |
| `recordStockCheck(c)` | physical count for a product on a date |

### Money & stock selectors (pure helpers)

| Function | Definition |
|---|---|
| `purchaseTotal(p)` | `qty × rate + transport + loading + labour + other` (landed cost) |
| `steelAmount(p)` | `qty × rate` — the only part owed to the mill |
| `saleTotal(s)` / `saleDiscount` / `saleTaxable` / `saleTax` | invoice math |
| `saleCharges(s)` | `loading + transport + labour` (billed to customer) |
| `saleGrandTotal(s)` | `taxable + tax + charges` |
| `invoiceStatus(paid, total)` | paid / unpaid |
| `supplierBalance(id)` | Σ `max(0, steelAmount − paid)` per purchase |
| `salePaid(id)` | payments settled against an invoice |
| `customerBalance(id)` | ledger balance per customer |
| `lineUnitCost(saleId, i)` | FIFO cost of a sold line |
| `byItem` | weighted landed cost per item |
| `stats` | dashboard aggregates (stock, revenue, dues, profit) |

Report figures come from `client/src/lib/profitReport.ts`
(`buildProfitReport`) and exports from `client/src/lib/reports.ts`.

## 2. Server API (`server/` — NestJS, implemented)

Stack (per the backend spec): Node.js + NestJS with the Fastify adapter,
TypeScript strict, Prisma ORM, PostgreSQL hosted on Neon, REST under
`/api/v1`, modular monolith (one app, one database — no microservices,
Redis, or queues).

Modules: auth · users · products (categories, attributes, variants) ·
inventory (derived stock + movement ledger + adjustments) · purchases ·
sales · customers · suppliers · payments · invoices · expenses ·
stock-checks · reports.

Key behaviours already implemented in services:

- Purchases, sales, and payments create atomically via `prisma.$transaction`
  (§12) — a failed write rolls back everything.
- Sales validate availability against the `InventoryTransaction` ledger and
  reject oversells; every stock change (purchase, sale, adjustment, return)
  writes a traceable ledger row (§7).
- Each sale generates an `Invoice` with a per-business sequential number.
- Customer payments targeted at an invoice can never exceed its remaining
  due; untargeted payments settle oldest-unpaid invoices first (FIFO) with
  recorded allocations (§10).
- Balances (customer receivable, supplier payable) are always derived from
  transactions, never stored (§27). Money columns are Prisma `Decimal` (§11).
- DTO validation on every request; JWT auth on everything except login;
  role guards (ADMIN/SUBADMIN); consistent `{ statusCode, message, error }`
  errors; pagination on list endpoints (`?page=&limit=`).

The route map below is the contract the modules implement.

Conventions: JSON over HTTPS, base path `/api/v1`, every record carries
`businessId` (multi-tenant isolation is mandatory), dates are ISO
`yyyy-mm-dd`, timestamps are ISO 8601, money is a decimal number in ₨.
History is immutable: transactions snapshot the product identity and
attribute values used at the time — later catalogue changes never rewrite
past records (entities are deactivated, not deleted).

### Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | returns session token |
| POST | `/auth/logout` | invalidates session |
| GET | `/auth/me` | current user + role (super admin / owner) |

### Catalogue (per business)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/products` | list / create product (name, unit, specLabel) |
| GET/PATCH/DELETE | `/products/{id}` | DELETE = deactivate, never hard-delete |
| GET/POST | `/products/{id}/categories` | category tree |
| POST/PATCH/DELETE | `/categories/{id}/attributes` | attribute defs + options |
| GET/POST | `/variants` | dedup by normalised key (category + sorted attribute pairs) |
| GET/POST/PATCH/DELETE | `/warehouses` , `/locations` | nested parent→child |

### Parties

| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH | `/customers` , `/suppliers` | balance is derived, never stored |
| GET | `/customers/{id}/ledger` | invoice-by-invoice dues |

### Transactions

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/purchases` | server computes landed cost; stock rises |
| GET/PATCH/DELETE | `/purchases/{id}` | server enforces cascade rules |
| GET/POST | `/sales` | server assigns `invoiceNo` + `createdAt`; validates qty against FIFO lots of the chosen source; prices locked from lots |
| GET/PATCH/DELETE | `/sales/{id}` | cascade on delete |
| GET/POST | `/payments` | type customer/supplier; optional `saleId`; server performs FIFO settlement |
| GET/POST/DELETE | `/expenses` | optional `productId` (absent = shop-wide) |
| GET/POST | `/stock-checks` | physical counts per product/date |
| GET | `/inventory` | derived stock per variant: qty per unit, FIFO value, lots, movements |
| GET | `/movements` | chronological stock events with running balance |

### Reports

| Method | Path | Notes |
|---|---|---|
| GET | `/reports/profit?mode=month\|year\|range&from=&to=&productId=` | the `buildProfitReport` engine, server-side: stock flow, P&L, cash, business value, dues, expense breakdown |
| GET | `/reports/export.csv` | same data, CSV |

The server owns all reconciliation: it must return the same figures the
client engine computes today (see `docs/NUMBER_AUDIT.md` for the QA checks
every response must satisfy).
