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
- The Super Admin's only application page is `/admin`.
- `/admin` shows active business/owner counts and can create or revoke
  business-owner logins.
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
`Business.settings` through `/api/v1/settings`; localStorage is only a browser
cache for immediate rendering.

## Ledger rules

- Stock is purchases minus sales and is also projected as a movement journal.
- Variants are the stockable unit; purchase lots preserve supplier and
  traceability metadata.
- FIFO lot consumption determines remaining lots and cost of goods sold.
- Mill payable is goods value only; transport/loading/labour/other costs are
  landed cost paid by the business.
- Customer payments settle a selected invoice or the oldest unpaid invoices.
- Invoice snapshots do not change when catalogue display names later change.

The normalized Prisma models and transaction-safe domain APIs are the source
of truth for every current screen and report.

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

## Verification

- Client: `npm run build`
- Server: `npm run prisma:generate`, `npm run build`, `npm test`
- Database: `npm run prisma:deploy`
- Runtime: create an owner, enter a purchase/sale/payment, refresh, and confirm
  inventory, invoice, dashboard, report, and `/audit` still reconcile.
