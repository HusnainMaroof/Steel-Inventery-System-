# Tradex Server

NestJS + Fastify + Prisma backend (modular monolith) for the Tradex depot
system. PostgreSQL is hosted on Neon and accessed only through Prisma.

## Stack

Node.js · NestJS (Fastify adapter) · TypeScript (strict) · Prisma ·
PostgreSQL (Neon) · REST `/api/v1`

## Setup

1. Copy the env template and fill in your Neon credentials:

   ```bash
   cp .env.example .env
   # .env
   # DATABASE_URL=postgresql://...   (Neon pooled connection)
   # DIRECT_URL=postgresql://...     (Neon direct connection, for migrations)
   # JWT_SECRET=<long random string>
   # ADMIN_EMAIL=admin@tradex.app
   # ADMIN_PASSWORD=<at least 8 characters>
   ```

2. Install dependencies and prepare the database:

   ```bash
   npm install
   npm run prisma:generate
   npm run prisma:deploy
   ```

3. Run:

   ```bash
   npm run start:dev      # development (watch)
   npm run build && npm run start:prod   # production
   ```

## API

Every route is versioned under `/api/v1` and (except `POST /api/v1/auth/login`
and `GET /api/v1/auth/status`) requires a JWT `Authorization: Bearer <token>`
header. `POST /api/v1/auth/register` is closed (403).

Modules: auth · owners · ledger/preferences · products (categories, attributes, variants) ·
inventory (derived stock + movements + adjustments) · purchases · sales ·
customers · suppliers · payments · invoices · expenses · stock-checks ·
reports.

Errors always return `{ statusCode, message, error }`. List endpoints accept
`?page=1&limit=20` and return `{ items, page, limit, total, pages }`.

## Architecture rules (binding)

- Modular monolith — one NestJS app, one PostgreSQL database.
- Controllers are thin; business logic lives in services.
- Multi-record business operations run inside `prisma.$transaction`.
- Inventory is derived from `InventoryTransaction` records — never edited
  arbitrarily. Every stock change has a traceable source.
- Customer/supplier balances are derived from transactions, never stored.
- Money columns are Prisma `Decimal` — never floats.
- Schema changes only via Prisma migrations.
- Normalized Prisma tables are the only source of truth. The client hydrates
  through `/ledger/bootstrap` and writes through tenant-scoped domain routes.

## Tests

```bash
npm test
```

Unit tests cover the critical money/inventory domain logic (FIFO payment
settlement, sale availability, landed cost, profit) and run without a
database. The e2e suite in `test/` requires a reachable `DATABASE_URL`.
