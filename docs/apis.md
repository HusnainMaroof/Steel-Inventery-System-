# APIs

> Status: **the backend does not exist yet.** The app is currently a
> client-side Next.js application whose entire data layer is the in-memory
> store in `client/src/lib/store.tsx`, seeded from `client/src/lib/seed.ts`.
> This document records (a) the internal data API the frontend uses today
> and (b) the REST contract the future `server/` must implement so the
> frontend can switch from in-memory to real persistence.

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

## 2. Planned server API (`server/` — not built yet)

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
