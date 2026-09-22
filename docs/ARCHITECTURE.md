# Tradex architecture

Tradex is a multi-tenant depot ledger. Purchases add stock, sales remove
stock, and the dashboard, invoices, dues, and reports are derived from the
same persisted records. There is no JSON ledger snapshot and no runtime
demo seed.

**Stack:** Next.js 16 (App Router, React 19) · NestJS 11 (Fastify) · Prisma 6 ·
PostgreSQL (Neon). One Nest app, one database. Controllers stay thin;
business logic lives in services. Money is Prisma `Decimal`, never floats.

## Repository layout

```text
client/                         # Next.js 16 UI
  src/app/                      # Pages, layouts, Server Actions, BFF
    layout.tsx                  # AuthProvider → StoreProvider → Shell
    page.tsx                    # Public marketing home
    login/ offline/ 404/
    admin/                      # Super Admin panel
    [businessSlug]/             # Tenant app (StoreGate layout)
    actions/                    # login, owners, staff, platform, media
    api/health                  # Browser health probe
    api/auth/{me,status}        # Session user + registration flag
    api/tradex/[...path]        # Catch-all BFF → Nest /api/v1
  src/components/               # Shell, StoreGate, feature UI
  src/lib/                      # Store, adapters, money, BFF, types
  src/hooks/                    # Paginated sales, platform admin
  src/proxy.ts                  # Cookie + known-path gate (Next 16)

server/                         # NestJS + Prisma API
  src/main.ts                   # Fastify, helmet, prefix, versioning
  src/app.module.ts             # Modular monolith wiring
  src/auth/                     # Login, JWT, tokenVersion + cache, Super Admin seed
  src/users/                    # Staff CRUD + Super Admin owners
  src/ledger/                   # Bootstrap (+ catalogue cache), transactions bulk, settings
  src/products/                 # Catalogue (categories, attributes, variants)
  src/warehouses/               # Warehouses and locations
  src/inventory/                # Derived stock, lots, movements, adjustments
  src/purchases/                # Purchase receipts + stock in
  src/sales/                    # Sales + invoice creation + stock out
  src/payments/                 # Customer/supplier payments (FIFO)
  src/invoices/                 # Invoice list/read (1:1 with sale)
  src/customers/                # Customers + per-customer ledger
  src/suppliers/                # Suppliers + payables
  src/expenses/                 # Shop and per-product expenses
  src/stock-checks/             # Physical vs system qty
  src/reports/                  # Period profit / stock / cash / dues
  src/platform/                 # Super Admin overview, templates, plans
  src/media/                    # Cloudinary business-logo upload
  src/subscription/             # Plan window + active-subscription checks
  src/domain/                   # Pure money, FIFO, profit, availability
  src/common/                   # Guards, pagination, audit, locks, limits
  prisma/                       # Schema and migrations

docs/                           # Architecture, APIs, design, QA
```

Types live in `client/src/lib/types.ts` (`client/src/types/` is empty).

## Runtime

```text
Browser
  → Next.js pages (/{businessSlug}/… or /admin/…)
  → AuthProvider + StoreProvider → ServerStatusMonitor + Shell
  → Next.js /api BFF (httpOnly session cookie)
  → Nest /api/v1 (Authorization: Bearer JWT)
  → Prisma / PostgreSQL
```

The browser never receives the Nest access token. Login stores it in the
Next.js `session` cookie (httpOnly, `sameSite: strict`, 12 hours, `secure`
in production). Browser data requests go through `/api/tradex/*`, which
attaches the token server-side via `tradexFetch`. CSP `connect-src 'self'`
enforces that — Nest is not called from the browser.

CORS on Nest is locked to `CLIENT_ORIGIN`. Super Admin and staff mutations
that are not JSON BFF (logo upload, owner CRUD) use Server Actions, which
also call Nest with the cookie-held JWT.

---

## Frontend architecture

### Stack

| Piece | Version / notes |
|-------|-----------------|
| Next.js | `^16.3.4` App Router |
| React | `^19.0.0` |
| Tailwind | `^4` (`@tailwindcss/postcss`) |
| Tables / motion | `@tanstack/react-table`, `framer-motion`, `gsap` |
| State | React Context (`StoreProvider`, `AuthProvider`) — no Redux, no React Query |

`next.config.ts` sets security headers and CSP. There are no rewrites or
redirects in Next config; tenant redirects live in page files and `Shell`.

### Provider tree

`client/src/app/layout.tsx`:

```text
AuthProvider
  StoreProvider
    ServerStatusMonitor     # probes GET /api/health every 45s
    Shell                   # sidebar / role redirects / print chrome skip
      {children}
```

Tenant layouts wrap children in `StoreGate`. Super Admin never waits on
the ledger store.

### Routing

Canonical paths are `isKnownAppPath` in `client/src/lib/app-routes.ts`.
Unknown paths redirect to `/404?from=…`.

**Public:** `/`, `/login`, `/offline`, `/404`.

**Super Admin:** `/admin` → `/admin/overview`, `/admin/businesses`,
`/admin/businesses/[ownerId]`, `/admin/products`, `/admin/subscriptions`.

**Tenant** (all under `/{businessSlug}/`):

| Path | Screen |
|------|--------|
| `dashboard` | KPI overview |
| `products` | Catalogue configurator |
| `purchases`, `purchases/[id]` | Purchases + detail |
| `inventory` | Stock / lots / movements |
| `sales`, `sales/[id]`, `sales/print` | Sales & invoices, printable bill, batch print |
| `customers`, `suppliers` | Parties |
| `payments` | Receive / pay |
| `expenses` | Shop expenses |
| `reports` | Profit, stock, cash, dues |
| `staff` | Owner-only staff logins |
| `settings` | Owner-only invoice / UI prefs |
| `audit` | Number-reconciliation QA |

Legacy aliases redirect: `invoices` → `sales`, `invoices/[id]` → `sales/[id]`,
`profit` → `reports`. Unprefixed paths (`/dashboard`, `/sales`, …) are
rewritten by `Shell` to `/{businessSlug}…`. Bare `/{slug}` is not a page.

Printable routes (`/sales/*` and `/invoices/*` after the slug is stripped)
render without sidebar chrome.

`BusinessLink` prefixes `user.businessSlug` so tenant hrefs can stay
`/sales`-style.

### Auth and gating

Three layers:

1. **`src/proxy.ts`** (Next 16 proxy, compiled as middleware) — unknown path
   → `/404`; missing `session` cookie on a non-public path → `/login?next=`.
   Cookie presence only; no role check here.
2. **`Shell`** — Super Admin cannot open tenant routes; tenants cannot open
   `/admin`; wrong slug rewrites to the user's own slug; `canOpenPath`
   (`staff-access.ts`) enforces plan pages + staff `access[]`.
3. **`StoreGate`** — tenant pages wait until `authReady` and first
   `storeReady` + `dataReady`. Later refreshes do not re-skeleton.
   Bootstrap failure shows `ErrorState` with retry.

Roles (`SUPERADMIN` | `ADMIN` | `SUBADMIN`):

| Role | Home | Nav |
|------|------|-----|
| Super Admin | `/admin/overview` | Platform nav only |
| Owner (`ADMIN`) | `/{slug}/dashboard` | All modules on the subscription plan, including staff/settings |
| Staff (`SUBADMIN`) | first allowed page | `access[]` ∩ staff pages; never staff/settings |

`invoices` maps to `sales`; `profit` maps to `reports`. Subscription
`allowedPages` gates both sidebar and Nest `StaffAccessGuard`.

Login / logout are Server Actions (`src/app/actions/auth.ts`):
`POST /api/v1/auth/login` then `createSession`; logout calls
`POST /api/v1/auth/logout` (bumps `tokenVersion`) then deletes the cookie.
`AuthProvider` hydrates from `GET /api/auth/me`.

### Data layer

**Two-phase tenant hydration** (`client/src/lib/store.tsx`):

1. **Bootstrap** — `GET /ledger/bootstrap` (via BFF). Catalogue, warehouses,
   staff (owners only), UI settings, record **counts**. Transaction arrays
   in this payload are empty. `version: 3`. There is no `dashboardSummary`.
2. **Transactions** — `GET /ledger/transactions`. One round-trip that bulk-
   loads customers, suppliers, purchases, sales, payments, expenses, and
   stock checks (one parallel `findMany` per collection on the server, cap
   20 000 rows each). Sets `transactionsReady` / `dataReady`.

`StoreProvider` skips load when there is no user or the user is Super
Admin. Tenant change (`user.id:user.businessId`) resets and re-bootstraps.
`refresh()` coalesces full bootstrap + transactions
(`refresh-coalesce.ts`).

`backend-adapters.ts` maps Nest records into store types:

| Server | Client |
|--------|--------|
| `Purchase` + `lines[]` | One row per line; parent `paid` copied; multi-line id `${purchaseId}::${lineId}` |
| `Sale` + `invoice` | `invoiceNo` / `invoicePaid` / `invoiceTotal` from `Invoice` |
| `Payment` + `allocations[]` | FIFO settlements exposed per payment |
| Supplier payments | Replayed FIFO client-side onto `purchase.paymentHistory` |

**Authoritative money**

- Customer paid/due: `Invoice.paid` / `Invoice.total`
- Mill payable: goods value only (`qty × rate` per purchase document)
- Purchase `paid`: document-level; multi-line rows share one parent id

**Derived on the client** (not stored): `inventory`, `inventoryByVariant`,
`stockLots`, `stockMovements`, `salePaid`, `customerBalance`,
`supplierBalance`, `stats`. FIFO lot consume and money helpers in
`client/src/lib/money.ts` mirror `server/src/domain/money.ts`. Dashboard
KPIs come from this derived `stats` object after transactions load.

Timeouts (`apiFetch` / `tradexFetch`): default 30s, bootstrap/transactions
45s (client `apiFetch`; server `tradexFetch` special-cases bootstrap 45s
and reports 60s), reports 60s. 502/503/504 → `/offline`; 404 → `/404`.

List screens that page on the server use `usePaginatedSales` /
`useServerPaginated` (`limit` 25). Super Admin data uses
`usePlatformAdminData` + Server Actions, cached in `admin-cache.ts`.

### Mutations

Tenant writes go through `StoreProvider.mutate` → `apiFetch` → BFF → Nest,
then `await refresh()`. Not optimistic, except UI prefs (`PUT /settings`)
and local hide/delete of sold-out inventory rows (cosmetic; no API).

`addProductItem` / `addQuality` / `deleteProductItem` / `deleteQuality`
are no-ops — the catalogue is configuration-driven via products,
categories, attributes, options, and variants.

Super Admin pages never use the ledger store. They call Server Actions
against `/api/v1/owners` and `/api/v1/platform/*`. Logo upload is
multipart (`uploadBusinessLogoAction`), not JSON BFF.

### Feature UI

| Folder | Role |
|--------|------|
| `components/sales/` | New sale modal, table, draft hook, print pack |
| `components/catalogue/` | Attribute fields, variant badge |
| `components/invoice/` | Brand header |
| `components/reports/` | Report sections |
| `components/settings/` | Warehouse panel |
| `components/admin/` | Overview, templates, subscription plans |
| Shared | `InvoiceDocument`, `ReceivePaymentModal`, `SaleDetailModal`, `DataTable`, `ui.tsx` |

---

## Backend architecture

### Stack

| Piece | Notes |
|-------|--------|
| NestJS 11 | Fastify adapter (`@nestjs/platform-fastify`) |
| Prisma 6 | Sole DB access; Neon pooled `DATABASE_URL` + `DIRECT_URL` for migrations |
| Auth | Passport JWT, bcryptjs, `tokenVersion` |
| Uploads | `@fastify/multipart` + Sharp + Cloudinary |
| Validation | Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`) |

`main.ts`: global prefix `api` (health excluded), URI version `1` so
tenant routes are `/api/v1/…`. Helmet on Fastify, CORS credentials to
`clientOrigin`, `AllExceptionsFilter`, logging + JSON-normalization
interceptors. Listen fails if Postgres is unreachable.

### Modular monolith

`AppModule` imports domain modules. There are no microservices, Redis, or
queues. Rate limits are an in-process store (`rate-limit-store.ts`) — a
shared store is required only if you run multiple API instances.

| Module | Controller prefix | Guard |
|--------|-------------------|-------|
| Auth | `auth` | Public login/status; JWT on me/logout |
| Users | `users` | `ADMIN` |
| Owners | `owners` | `SUPERADMIN` |
| Platform | `platform` | `SUPERADMIN` |
| Ledger | `ledger` | JWT + staff page `dashboard` |
| Settings | `settings` | `ADMIN` |
| Products | `products` | staff page `products` |
| Warehouses | `warehouses` | staff page `inventory` |
| Inventory | `inventory` | staff page `inventory` |
| Purchases | `purchases` | staff page `purchases` |
| Sales | `sales` | staff page `sales` |
| Invoices | `invoices` | staff page `sales` |
| Payments | `payments` | staff page `payments` |
| Customers | `customers` | staff page `customers` |
| Suppliers | `suppliers` | staff page `suppliers` |
| Expenses | `expenses` | staff page `expenses` |
| Stock checks | `stock-checks` | staff page `inventory` |
| Reports | `reports` | staff page `reports` |
| Media | `media` | `SUPERADMIN` or `ADMIN` |
| Health | `health` | Public, unversioned |

`StaffAccessGuard` (used with `@RequireStaffPage`): plan `allowedPages`
first, then staff `access[]`. Super Admin bypasses staff-page checks.
`businessId` is always taken from the JWT. Callers cannot select another
tenant.

### Bootstrap and transactions

`LedgerService.bootstrap` (payload `version: 3`) returns catalogue,
warehouses/locations, staff (ADMIN only), settings, and SQL counts.
Catalogue + settings are served from an in-process cache
(`ledger/catalogue-cache.ts`) that **every** catalogue/settings write
invalidates synchronously in the same service method — no TTL, so a
renamed product shows on the next bootstrap. Counts and staff are always
live. Transaction collections are empty arrays.

`GET /ledger/transactions` (`LedgerTransactionsService`) loads every
trading collection with **one parallel `findMany` per collection** via
each service's `listAll` (no pagination counts — the client bulk-load
path reads only the row arrays), capped at 20 000 rows per collection.
This replaced N paginated list calls from the client.

There is **no** dashboard-summary service. Dashboard KPIs are computed
in the client store from the transaction set.

`filterBootstrapForStaff` strips catalogue/settings the staff page list
does not need.

Settings (`GET|PUT /settings`) store invoice/UI preferences on
`Business.settings` JSON, sanitized and size-capped
(`MAX_SETTINGS_BYTES`).

### Domain layer

Pure functions under `server/src/domain/`:

- `money.ts` — landed cost, sale totals, mill goods amount
- `payment-settlement.ts` — `settleFifo` for invoices and purchases
- `sale-availability.ts` — remaining lot qty before a sale is accepted
- `profit.ts` — period P&L building blocks

`stock-locks.ts` takes PostgreSQL advisory transaction locks
(`pg_advisory_xact_lock`) per business/product/variant (and per lot on
sourced sales) so concurrent sales cannot pass the same stock check.

Purchases, sales, payments, and adjustments run inside
`prisma.$transaction`. Failure rolls the whole document back.

### Prisma model overview

**Tenant hub:** `Business` (slug, settings JSON, subscription fields)

**Auth:** `User` (role, `tokenVersion`, `access[]`, `title`)

**Platform:** `SubscriptionPlanDefinition` (`allowedPages`),
`CatalogTemplate`, `AuditLog`

**Catalogue:** `Product`, `ProductCategory`, `ProductItem`, `AttributeDef`,
`AttributeOption`, `Variant` (`identityKey` unique per business)

**Storage:** `Warehouse`, `Location`

**Parties:** `Supplier`, `Customer` (soft-deactivate via `active`)

**Trading:** `Purchase` + `PurchaseLine`, `Sale` + `SaleLine` (optional
`purchaseId` source lot), `Invoice` (1:1 with sale, `paid`/`total`),
`Payment` + `PaymentAllocation`

**Operations:** `Expense`, `StockCheck`, `InventoryTransaction` (signed qty)

Enums: `Role`, `PaymentType`, `PaymentMethod`, `ExpenseCategory`,
`InventoryTxType` (`PURCHASE` | `SALE` | `ADJUSTMENT` | `RETURN`),
`BillingCycle`, `SubscriptionStatus`.

### How stock and money move

Stock is **not** a column. `InventoryTransaction` is a signed movement
ledger. Current qty is the sum of ledger rows per product/variant.

- Purchase create writes `PURCHASE` rows in the same transaction as the
  document. Charges (transport/loading/labour/other) are landed cost paid
  by the business — they are **not** mill payable.
- Sale create checks availability, locks keys, writes `SALE` rows, and
  creates the `Invoice` snapshot (`number`, `total`, initial `paid`).
- Sale delete writes reversal ledger rows and removes the invoice and
  allocations.
- `POST /inventory/adjustments` is the only non-purchase/sale stock
  change, and it is still a ledgered `ADJUSTMENT`.
- Customer payments allocate to a chosen invoice or FIFO oldest unpaid
  (`PaymentAllocation`). Amount cannot exceed remaining due.
- Supplier payments FIFO-settle oldest unpaid purchase documents (goods
  value only).
- Invoice snapshots do not change when catalogue names later change.
  Historical lines store `attributeSnapshot`, `productName`, unit, rate.

---

## Accounts and administration

One `SUPERADMIN` is created at API boot from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` if none exists. Public registration is closed
(`POST /auth/register` → 403). Owners are created by Super Admin.

Expired or cancelled subscriptions fail JWT validation with 403.
Revoking an owner sets the login inactive; it never deletes the business
or its ledger.

Owners manage staff at `/{slug}/staff` via `/api/v1/users` (`SUBADMIN`
logins with title + page access). Logout increments `User.tokenVersion`
so every outstanding JWT for that user is rejected.

---

## Caching (in-process, single instance)

Two caches cut a Neon round trip from the hot paths; neither holds
trading (transaction) data.

| Cache | File | Key | Invalidation | Staleness |
|-------|------|-----|--------------|-----------|
| JWT `tokenVersion` | `auth/token-version-cache.ts` | userId, TTL 45s | eager on every `TokenVersionService.bump()` (logout, password change, deactivate); `invalidateBusiness()` on subscription PATCH, platform plan edit, and business deletion | Revocation: immediate. Subscription expiry: re-evaluated against the clock on every hit — immediate. Business slug/name: ≤45s (cosmetic) |
| Bootstrap catalogue | `ledger/catalogue-cache.ts` | businessId, no TTL | every product/category/attribute/option/variant/warehouse/location/settings write in its own service method (enforced by `catalogue-invalidation.spec.ts`) | none — synchronous |

Both are single-instance only. A shared store (Redis) is required only
if the API runs multiple instances behind a load balancer. The cache
entries carry the business's subscription fields, and cache hits
re-evaluate `isSubscriptionActive` against the current time, so
subscription expiry is enforced with no staleness window. Every write
path that changes subscription or plan state invalidates eagerly:
`PATCH /owners/:id/subscription` and `DELETE /owners/:id` per business,
`PATCH /platform/subscription-plans/:id` for every business on that
plan (plan edits change `billingCycle`/`allowedPages` on all of them).
Measured impact (SCALE≈200, dev machine → Neon ap-southeast-1): every
authenticated endpoint lost ~215ms (one RTT); bootstrap p50 1342→108ms;
`/ledger/transactions` 2027→864ms.

---

## Security

- JWT in httpOnly `session` cookie; BFF attaches Bearer server-side.
- `assertSameOrigin()` + `assertSafeProxyPath()` on BFF mutations.
- Logout / deactivate / password change bump `tokenVersion`, and the
  in-process cache entry for that user is deleted in the same call, so
  revocation is immediate (see Caching).
- Global ValidationPipe; DTOs + `LIMITS` (money, qty, lines, daily
  payment total, settings size).
- `sanitizeText` / `sanitizeUiSettings` on free-text and settings.
- Logo: `POST /media/business-logo`, Sharp + Cloudinary, 8 MB multipart cap.
- Throttle: login 15 / 15 min in production (keyed by email, else IP);
  60 / 15 min in development; API 240 reads / 90 writes per min per IP;
  reports 20 / min per user.
- Nest Helmet; Next security headers + HSTS in production; BFF
  `Cache-Control: private, no-store`.
- Prisma parameterized queries only.

---

## Resilience and UX

- Nest `AllExceptionsFilter` maps Prisma P2002/P2025/P2003 to safe
  `{ statusCode, message, error }` — no stack traces to the client.
- Bootstrap failure blocks tenant pages (`StoreGate` + retry).
- Mutation errors toast with **Try again**; forms keep local input.
- Global `store.pending` + disabled submit buttons prevent double-post.
- Reports use `ReportsSkeleton` while `GET /reports/profit` runs.
- List endpoints: `PaginationDto` default 50, max 100
  (`{ items, page, limit, total, pages }`).
- Invoice list on the sales page uses `GET /sales?page=&limit=25`.

---

## Verification

- Client: `npm run build` in `client/`
- Server: `npm run prisma:generate`, `npm run build`, `npm test` in `server/`
- Database: `npm run prisma:deploy` in `server/`
- Runtime: create an owner, enter a purchase / sale / payment, refresh,
  and confirm inventory, invoice, dashboard, reports, and
  `/{slug}/audit` still reconcile.
- QA: `/{slug}/audit` — every check should print `[PASS]` on a healthy
  ledger.

Unit tests cover domain money/FIFO, purchases, ledger bootstrap,
staff-access, invoice atomicity, and settings sanitization. The e2e
suite in `server/test/` needs a reachable `DATABASE_URL`.

See also: [apis.md](apis.md), [frontend-design.md](frontend-design.md),
[NUMBER_AUDIT.md](NUMBER_AUDIT.md),
[DATABASE_OPTIMIZATION.md](DATABASE_OPTIMIZATION.md).
