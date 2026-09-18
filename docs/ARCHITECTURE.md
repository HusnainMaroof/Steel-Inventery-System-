# Tradex architecture

Tradex is a multi-tenant depot ledger built with Next.js 16, NestJS 11,
Prisma, and PostgreSQL. Purchases add stock, sales remove stock, and the
dashboard, invoices, dues, and reports are derived from the same persisted
records.

## Repository layout

```text
client/                 # Next.js 16 UI (App Router)
  src/app/              # Pages, layouts, Server Actions, BFF route handlers
  src/app/api/          # /api/tradex/* BFF proxy, /api/auth/*, /api/health
  src/app/[businessSlug]/  # Tenant pages (dashboard, sales, …)
  src/app/admin/        # Super Admin platform panel
  src/components/       # Shell, StoreGate, sales/invoices/reports UI
  src/lib/                # Store, money math, backend adapters, auth
  src/hooks/              # Paginated sales, platform admin data
  src/proxy.ts            # Cookie-level route gate (Next.js 16 proxy convention)

server/                 # NestJS + Prisma API (PostgreSQL)
  src/auth/             # Login, JWT, token invalidation
  src/ledger/           # Bootstrap, settings, dashboard summary
  src/products/         # Catalogue (products, categories, attributes, variants)
  src/warehouses/       # Warehouses and locations
  src/inventory/        # Stock ledger, lots, movements, adjustments
  src/purchases/        # Purchase receipts
  src/sales/            # Sales + invoice creation
  src/payments/         # Customer/supplier payments (FIFO settlement)
  src/customers/        # Customers + per-customer ledger
  src/suppliers/        # Suppliers + payables
  src/expenses/         # Shop and per-product expenses
  src/stock-checks/     # Physical stock checks
  src/reports/          # Profit reports
  src/users/            # Staff CRUD (owner) + owner CRUD (super admin)
  src/platform/         # Super-admin overview, templates, subscription plans
  src/media/            # Cloudinary business-logo upload
  src/domain/           # Pure money, FIFO, profit, availability logic
  src/common/           # Guards, rate limits, audit, security limits
  prisma/               # Schema and migrations

docs/                   # Architecture, APIs, design, QA checklists
```

## Runtime

```text
Browser
  -> Next.js pages (/{businessSlug}/… or /admin/…)
  -> AuthProvider + StoreProvider + Shell
  -> Next.js /api BFF (httpOnly session cookie)
  -> Nest /api/v1 (Bearer JWT)
  -> Prisma / PostgreSQL
```

The browser never receives the Nest access token. Login stores it in the
Next.js `session` cookie. Browser data requests go through route handlers,
which attach the token server-side via `tradexFetch`.

### Two-phase client hydration

1. **Bootstrap** — `GET /ledger/bootstrap` returns catalogue configuration,
   warehouses, staff list, UI settings, record counts, and a pre-aggregated
   `dashboardSummary`. Transaction collections are empty in this payload.
2. **Transactions** — `StoreProvider` immediately fetches all paginated list
   endpoints (`/customers`, `/suppliers`, `/purchases`, `/sales`, `/payments`,
   `/expenses`, `/stock-checks`) via `fetchAllPages` and sets
   `transactionsReady`.

`StoreGate` blocks tenant pages until bootstrap succeeds. Screens that need
full ledger data wait on `transactionsReady` or use page-level pagination
(e.g. sales list).

## Accounts and administration

### Roles

| Role | Scope |
|------|-------|
| `SUPERADMIN` | Platform operator; only `/admin` routes |
| `ADMIN` | Business owner; full access to their depot |
| `SUBADMIN` | Staff login; restricted to pages in `User.access[]` |

One `SUPERADMIN` is bootstrapped from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
Public registration is closed (`POST /auth/register` returns 403). Owners are
created by the Super Admin.

### Super Admin (`/admin`)

| Route | Purpose |
|-------|---------|
| `/admin/overview` | Business counts, subscription mix, 30-day activity |
| `/admin/businesses` | Owner logins, plans, templates, per-tenant activity |
| `/admin/businesses/[ownerId]` | Single-business detail |
| `/admin/products` | Catalogue template management |
| `/admin/subscriptions` | Subscription plan definitions |

Super Admin APIs under `/api/v1/platform/*` and `/api/v1/owners/*`:

- Register owners with a **subscription plan** and **product templates**
  (steel, cement, wire, paint, tiles — provisioned server-side)
- `PATCH /owners/:id/subscription` — plan, status, expiry
- `POST /owners/:id/templates` — apply templates (skips duplicate names)
- `GET|POST|PATCH /platform/subscription-plans` — plan definitions with
  `allowedPages` (sidebar module gating)
- `GET|POST /platform/templates` — custom catalogue templates

Expired or cancelled subscriptions block tenant API access during JWT
validation. Revoking an owner sets the login inactive; it never deletes the
business or its ledger.

### Business owner staff

Owners manage staff at `/{businessSlug}/staff` via `/api/v1/users`:

- Create `SUBADMIN` logins with a title and page access list
- Staff see only modules allowed by both their `access[]` and the business
  subscription plan's `allowedPages`
- `StaffAccessGuard` and `filterBootstrapForStaff` enforce page-level ACL
- Logout invalidates all sessions via `User.tokenVersion` bump

## Tenant URLs

Each business has a unique `slug`. Tenant pages live under:

```text
/{businessSlug}/dashboard
/{businessSlug}/purchases
/{businessSlug}/sales
…
```

Helpers in `client/src/lib/business-path.ts` build paths; `proxy.ts` and
`Shell` enforce role navigation (Super Admin cannot open tenant routes; staff
cannot open pages outside their access).

Printable views: `/{businessSlug}/sales/[id]`, `/{businessSlug}/invoices/[id]`,
`/{businessSlug}/sales/print`.

Reconciliation: `/{businessSlug}/audit`.

## Persisted tenant data

Each catalogue and trading record is stored in its normalized Prisma table.
All controllers derive `businessId` from the JWT, so callers cannot select
another tenant. Business invoice/profile preferences are stored on
`Business.settings` through `/api/v1/settings`.

There is no JSON ledger snapshot or runtime demo seed. Every create, update,
delete, payment, and stock check uses its dedicated domain endpoint inside
Prisma transactions.

### Prisma model overview

**Tenant hub:** `Business` (slug, settings, subscription fields)

**Catalogue:** `Product`, `ProductCategory`, `ProductItem`, `AttributeDef`,
`AttributeOption`, `Variant`

**Storage:** `Warehouse`, `Location`

**Parties:** `Supplier`, `Customer`

**Trading:** `Purchase` + `PurchaseLine`, `Sale` + `SaleLine`, `Invoice`
(1:1 with sale), `Payment` + `PaymentAllocation`

**Operations:** `Expense`, `StockCheck`, `InventoryTransaction`

**Platform:** `SubscriptionPlanDefinition`, `CatalogTemplate`, `AuditLog`

**Auth:** `User` (role, `tokenVersion`, `access[]` for staff)

### Bootstrap shape (client normalization)

`client/src/lib/backend-adapters.ts` maps the API payload into store types.
Transaction rows arrive from paginated list endpoints, not bootstrap:

| Server record | Client notes |
|---------------|--------------|
| `Purchase` + `lines[]` | Expanded to one row per line; parent `paid` copied to every line |
| `Sale` + `invoice` | `invoiceNo`, `invoicePaid`, `invoiceTotal` from `Invoice` row |
| `Payment` + `allocations[]` | FIFO invoice settlements exposed per payment |
| Supplier payments | Replayed FIFO client-side to build `purchase.paymentHistory` |

**Authoritative money fields**

- Customer invoice paid/due: `Invoice.paid` / `Invoice.total` (not client FIFO alone)
- Mill payable: goods value per purchase document (`qty × rate` summed per parent id)
- Purchase `paid`: document-level; multi-line purchases share one parent id via `purchaseId`

## Ledger rules

### Stock

Stock is not stored as a column. `InventoryTransaction` is a signed movement
ledger (`PURCHASE`, `SALE`, `ADJUSTMENT`, `RETURN`). Current qty is the sum of
ledger rows per product/variant. Purchases and sales write ledger entries
atomically in the same Prisma transaction as their parent document.

- Variants are the stockable unit; purchase lots preserve supplier and
  traceability metadata (lot/heat/batch numbers).
- FIFO lot consumption determines remaining lots and cost of goods sold.
- `sale-availability.ts` checks ledger balances before sale creation.
- PostgreSQL advisory locks (`stock-locks.ts`) prevent TOCTOU overselling.

### Money

- Mill payable is goods value only; transport/loading/labour/other costs are
  landed cost paid by the business.
- Customer payments settle a selected invoice or the oldest unpaid invoices
  (`settleFifo` in `domain/payment-settlement.ts`). Allocations are stored in
  `PaymentAllocation`.
- Supplier payments FIFO-settle oldest unpaid purchase documents.
- Invoice snapshots do not change when catalogue display names later change.
- Money helpers in `client/src/lib/money.ts` mirror `server/src/domain/money.ts`.

The normalized Prisma models and transaction-safe domain APIs are the source
of truth for every current screen and report.

## Client store

`StoreProvider` (`client/src/lib/store.tsx`) uses React Context (no Redux).
It hydrates from bootstrap, loads transactions in parallel, and refreshes after
mutations via coalesced `refresh()`.

Key derived values:

- `inventory`, `inventoryByVariant`, `stockLots`, `stockMovements` — from
  purchases, sales, and ledger rules
- `salePaid(id)` — uses `Invoice.paid` when present; otherwise FIFO simulation
- `supplierBalance(id)` — groups purchases by parent document id
- `saleGrandTotal(s)` — uses `Invoice.total` when present; rounds like server
- `stats` — dashboard figures; bootstrap `dashboardSummary` for fast first paint

`AuthProvider` (`client/src/lib/auth.tsx`) hydrates the current user from
`/api/auth/me`. Server Actions in `src/app/actions/auth.ts` handle login/logout.

## Security

### Authentication and session

- JWT in httpOnly `session` cookie (`sameSite: strict`, `secure` in production)
- BFF (`/api/tradex/*`) attaches Bearer token server-side; browser never sees it
- `assertSameOrigin()` blocks cross-origin mutations on the BFF
- Logout bumps `User.tokenVersion` — all outstanding JWTs are rejected

### Input validation and caps

- Global Nest `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`)
- `server/src/common/security/limits.ts` — money, qty, line, and daily payment caps
- `sanitizeText` / `sanitizeUiSettings` on free-text and settings payloads
- Logo uploads via `POST /media/business-logo` — Cloudinary + Sharp, size-capped

### Rate limiting

Custom in-memory store (not `@nestjs/throttler`):

- Login: `AuthThrottleGuard` — 10 attempts / 15 min per IP
- API: `ApiThrottleGuard` — 240 reads / 90 writes per min per IP

### Headers

- Nest: `@fastify/helmet` on Fastify adapter
- Next.js: security headers + HSTS in production (`next.config.ts`)
- BFF responses: `Cache-Control: private, no-store`, `X-Frame-Options: DENY`

### SQL injection

Prisma parameterized queries only. No user input is concatenated into SQL.

## Routes

### Public

- `/`, `/login`, `/offline`, `/404`

### Super Admin

- `/admin`, `/admin/overview`, `/admin/businesses`, `/admin/businesses/[ownerId]`,
  `/admin/products`, `/admin/subscriptions`

### Business owner and staff

All under `/{businessSlug}/`:

- `dashboard`, `products`, `purchases`, `inventory`, `sales`, `customers`,
  `suppliers`, `payments`, `expenses`, `reports`, `settings`, `staff`
- Detail: `purchases/[id]`, `sales/[id]`, `invoices/[id]`
- `sales/print`, `audit`, `profit`, `invoices`

Next.js `proxy.ts` provides the cookie-level route gate. `Shell` applies role
and staff-page navigation.

## Resilience and UX

### Errors

- Nest `AllExceptionsFilter` maps Prisma errors (P2002, P2025, P2003) to safe HTTP responses.
- Bootstrap failure blocks tenant pages via `StoreGate` + `ErrorState` (retry reloads ledger).
- Mutation errors show a toast with **Try again**; forms keep local input.

### Loading

- `StoreGate` shows route skeletons until bootstrap succeeds.
- Global mutation bar (`store.pending`) + per-form disabled states prevent double submit.
- Reports tab uses `ReportsSkeleton` while `GET /reports/profit` runs.
- `transactionsReady` gates screens that need the full transaction set.

### Timeouts

| Path | Timeout |
|------|---------|
| Default API | 30s |
| Bootstrap | 45s |
| Reports | 60s |

Implemented in `client/src/lib/fetch-with-timeout.ts` (browser + BFF).

### Pagination

- Invoice list (`/sales` tab) uses `GET /sales?page=&limit=25` via `usePaginatedSales`.
- Bootstrap transaction load uses `fetchAllPages` (100 per page, max 200 pages).
- Server list endpoints use `PaginationDto` (max 100 per page).
- Reports return aggregated period data (not paginated lists).

### Database indexes

- `Invoice(businessId, createdAt)` — invoice list sort
- `Payment(saleId)`, `Payment(businessId, type, date)` — payments and cash reports
- Deploy with `npm run prisma:deploy` in `server/`

## Verification

- Client: `npm run build` in `client/`
- Server: `npm run prisma:generate`, `npm run build`, `npm test` in `server/`
- Database: `npm run prisma:deploy` in `server/`
- Runtime: create an owner, enter a purchase/sale/payment, refresh, and confirm
  inventory, invoice, dashboard, report, and `/{slug}/audit` still reconcile.
- QA: open `/{slug}/audit` — every check should print `[PASS]` on a healthy ledger.

See also: [apis.md](apis.md), [frontend-design.md](frontend-design.md),
[NUMBER_AUDIT.md](NUMBER_AUDIT.md).
