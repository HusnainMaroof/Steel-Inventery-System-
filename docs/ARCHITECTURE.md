# Tradex architecture

Tradex is a multi-tenant depot ledger built with Next.js 16, NestJS 11,
Prisma, and PostgreSQL. Purchases add stock, sales remove stock, and the
dashboard, invoices, dues, and reports are derived from the same persisted
records.

## Runtime

```text
Browser
  -> Next.js pages and StoreProvider
  -> Next.js /api BFF (httpOnly session cookie)
  -> Nest /api/v1 (Bearer JWT)
  -> Prisma / PostgreSQL
```

The browser never receives the Nest access token. Login stores it in the
Next.js `session` cookie. Browser data requests go through route handlers,
which attach the token server-side.

## Accounts and administration

- One `SUPERADMIN` is bootstrapped from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- The Super Admin's only application page is `/admin` (Platform control panel).
- `/admin` sidebar routes:
  - `/admin/overview` — business counts, subscription mix, 30-day sales/purchases/payments, recent activity
  - `/admin/businesses` — owner logins, subscription plan/status, assigned templates, per-tenant activity
- Super Admin can register owners with:
  - **Subscription plan:** `MONTHLY`, `YEARLY`, or `LIFETIME`
  - **Product templates:** steel, cement, wire, paint, tiles (provisioned server-side on registration)
- `PATCH /owners/:id/subscription` updates plan, status, and expiry.
- `POST /owners/:id/templates` applies product templates to an existing business (skips duplicate product names).
- Expired or cancelled subscriptions block tenant API access (JWT validation).
- Each `ADMIN` is one business owner and operates that business's depot.
- Staff logins and the owner-facing Staff panel are no longer part of the
  product. The administration migration removes old `SUBADMIN` login rows.
- Revoking an owner sets the login inactive. It never deletes the business or
  its ledger.

## Persisted tenant data

Each catalogue and trading record is stored in its normalized Prisma table.
`GET /api/v1/ledger/bootstrap` returns the authenticated business's records for
initial screen hydration. Every create, update, delete, payment, and stock
check then uses its dedicated domain endpoint and refreshes from PostgreSQL
after success. There is no JSON ledger snapshot or runtime demo seed.

All controllers derive `businessId` from the JWT, so callers cannot select
another tenant. Business invoice/profile preferences are stored on
`Business.settings` through `/api/v1/settings`; settings are also included in
`/ledger/bootstrap` so the client never uses localStorage.

### Bootstrap shape (client normalization)

`client/src/lib/backend-adapters.ts` maps the API payload into store types:

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

- Stock is purchases minus sales and is also projected as a movement journal.
- Variants are the stockable unit; purchase lots preserve supplier and
  traceability metadata.
- FIFO lot consumption determines remaining lots and cost of goods sold.
- Mill payable is goods value only; transport/loading/labour/other costs are
  landed cost paid by the business.
- Customer payments settle a selected invoice or the oldest unpaid invoices.
  Allocations are stored in `PaymentAllocation` and returned in bootstrap.
- Supplier payments FIFO-settle oldest unpaid purchase documents.
- Invoice snapshots do not change when catalogue display names later change.

The normalized Prisma models and transaction-safe domain APIs are the source
of truth for every current screen and report.

## Client store

`StoreProvider` (`client/src/lib/store.tsx`) hydrates from bootstrap and
refreshes after mutations. Key derived values:

- `salePaid(id)` — uses `Invoice.paid` when present; otherwise FIFO simulation
- `supplierBalance(id)` — groups purchases by parent document id
- `saleGrandTotal(s)` — uses `Invoice.total` when present; rounds like server
- Money helpers in `client/src/lib/money.ts` mirror `server/src/domain/money.ts`

## Security

### Authentication and session

- JWT in httpOnly `session` cookie (`sameSite: strict`, `secure` in production)
- BFF (`/api/tradex/*`) attaches Bearer token server-side; browser never sees it
- `assertSameOrigin()` blocks cross-origin mutations on the BFF

### Input validation and caps

- Global Nest `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`)
- `server/src/common/security/limits.ts` — money, qty, line, and daily payment caps
- `sanitizeText` / `sanitizeUiSettings` on free-text and settings payloads
- Logo uploads: data-URL only (PNG/JPEG/WebP base64), size-capped

### Rate limiting

- Login: `AuthThrottleGuard` — 10 attempts / 15 min per IP
- API: `ApiThrottleGuard` — 240 reads / 90 writes per min per IP

### Headers

- Nest: `@fastify/helmet`
- Next.js: security headers + HSTS in production (`next.config.ts`)
- BFF responses: `Cache-Control: private, no-store`, `X-Frame-Options: DENY`

### SQL injection

Prisma parameterized queries only. No user input is concatenated into SQL.

## Routes

- Public: `/`, `/login`
- Super Admin: `/admin`
- Business owner: `/dashboard`, `/products`, `/purchases`, `/inventory`,
  `/sales`, `/customers`, `/suppliers`, `/payments`, `/expenses`, `/reports`,
  `/settings`
- Printable: `/sales/[id]`, `/invoices/[id]`
- Reconciliation: `/audit`

Next.js `proxy.ts` provides the cookie-level route gate. `Shell` applies role
navigation: Super Admin is confined to `/admin`, and owners cannot open it.

## Resilience and UX

### Errors

- Nest `AllExceptionsFilter` maps Prisma errors (P2002, P2025, P2003) to safe HTTP responses.
- Bootstrap failure blocks tenant pages via `StoreGate` + `ErrorState` (retry reloads ledger).
- Mutation errors show a toast with **Try again**; forms keep local input.

### Loading

- `StoreGate` shows route skeletons until bootstrap succeeds.
- Global mutation bar (`store.pending`) + per-form disabled states prevent double submit.
- Reports tab uses `ReportsSkeleton` while `GET /reports/profit` runs.

### Timeouts

| Path | Timeout |
|------|---------|
| Default API | 30s |
| Bootstrap | 45s |
| Reports | 60s |

Implemented in `client/src/lib/fetch-with-timeout.ts` (browser + BFF).

### Pagination

- Invoice list (`/sales` tab) uses `GET /sales?page=&limit=25` via `usePaginatedSales`.
- Server list endpoints use `PaginationDto` (max 100 per page).
- Reports return aggregated period data (not paginated lists).

### Database indexes

- `Invoice(businessId, createdAt)` — invoice list sort
- `Payment(saleId)`, `Payment(businessId, type, date)` — payments and cash reports
- Deploy with `npm run prisma:deploy` in `server/`

## Verification

- Client: `npm run build`
- Server: `npm run prisma:generate`, `npm run build`, `npm test`
- Database: `npm run prisma:deploy`
- Runtime: create an owner, enter a purchase/sale/payment, refresh, and confirm
  inventory, invoice, dashboard, report, and `/audit` still reconcile.
- QA: open `/audit` — every check should print `[PASS]` on a healthy ledger.
