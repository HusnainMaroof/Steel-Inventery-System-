# Tradex Server

NestJS + Fastify + Prisma backend (modular monolith) for the Tradex depot
system. PostgreSQL is hosted on Neon and accessed only through Prisma.

## Stack

Node.js · NestJS 11 (Fastify adapter) · TypeScript (strict) · Prisma 6 ·
PostgreSQL (Neon) · REST `/api/v1`

## Setup

1. Copy the env template and fill in your Neon credentials:

   ```bash
   cp .env.example .env
   # DATABASE_URL=postgresql://...   (Neon pooled connection)
   # DIRECT_URL=postgresql://...     (Neon direct connection, for migrations)
   # JWT_SECRET=<long random string>
   # ADMIN_EMAIL=admin@tradex.app
   # ADMIN_PASSWORD=<at least 8 characters>
   ```

2. Install dependencies and prepare the database:

   ```bash
   npm install --include=dev
   npm run prisma:generate
   npm run prisma:deploy
   ```

3. Run:

   ```bash
   npm run start:dev      # development (watch)
   npm run build && npm run start:prod   # production
   ```

## API

Every route except `GET /health` is versioned under `/api/v1`. Except
`POST /api/v1/auth/login`, `GET /api/v1/auth/status`, and
`POST /api/v1/auth/register` (closed, 403), routes require
`Authorization: Bearer <token>`.

The Next.js app never sends that header from the browser. It stores the
JWT in an httpOnly cookie and proxies through `/api/tradex/*`.

**Auth / platform:** `auth`, `owners` (SUPERADMIN), `users` (staff),
`platform` (overview, templates, subscription plans), `media` (logo).

**Tenant hydrate:** `GET /ledger/bootstrap` (catalogue + counts) then
`GET /ledger/transactions` (all trading rows, one round-trip).
`GET|PUT /settings` stores invoice/UI prefs on `Business.settings`.

**Domain:** products (categories, attributes, variants) · warehouses ·
inventory (derived stock, lots, movements, adjustments) · purchases ·
sales · invoices · customers · suppliers · payments · expenses ·
stock-checks · reports.

Errors always return `{ statusCode, message, error }`. List endpoints
accept `?page=1&limit=50` (max 100) and return
`{ items, page, limit, total, pages }`.

See [docs/apis.md](../docs/apis.md) for the full route table.

## Architecture rules (binding)

- Modular monolith — one NestJS app, one PostgreSQL database.
- Controllers are thin; business logic lives in services.
- Multi-record business operations run inside `prisma.$transaction`.
- Inventory is derived from `InventoryTransaction` records — never edited
  arbitrarily. Every stock change has a traceable source.
- Customer/supplier balances are derived from transactions, never stored.
- Money columns are Prisma `Decimal` — never floats.
- Schema changes only via Prisma migrations.
- Normalized Prisma tables are the only source of truth. The client
  hydrates through `/ledger/bootstrap` + `/ledger/transactions` and
  writes through tenant-scoped domain routes.

## Tests

```bash
npm test
```

Unit tests cover the critical money/inventory domain logic (FIFO payment
settlement, sale availability, landed cost, profit) and run without a
database. The e2e suite in `test/` requires a reachable `DATABASE_URL`.
