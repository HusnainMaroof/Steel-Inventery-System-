# Tradex — Steel & Cement Inventory System

A multi-tenant depot ledger for stock, sales, payments and profit.
Authentication, business-owner accounts, invoice settings, and each
tenant's complete ledger persist in PostgreSQL through the Nest API.

The browser talks only to Next.js. Nest JWTs stay in an httpOnly
`session` cookie; `/api/tradex/*` attaches them server-side.

## Getting Started

1. Configure `server/.env` and `client/.env.local` from their examples.
2. Run `npm install --include=dev`, `npm run prisma:generate`, and
   `npm run prisma:deploy` in `server/`, then start it with
   `npm run start:dev`.
3. Run `npm install --include=dev` and `npm run dev` in `client/`.

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Repository layout

```text
client/           # Next.js 16 UI (App Router, React 19)
  src/app/        # Pages, layouts, Server Actions, BFF route handlers
  src/components/ # Shell, StoreGate, sales / catalogue / reports UI
  src/lib/        # Store, money/stock math, BFF, auth, types
  src/hooks/      # Paginated sales, platform admin data
  src/proxy.ts    # Cookie + known-path gate
  public/         # Static assets (images, icons, fonts)
server/           # NestJS 11 + Fastify + Prisma (PostgreSQL on Neon)
docs/             # All project documentation
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — frontend and backend
  architecture, data model, stock and money flow, pages.
- [docs/apis.md](docs/apis.md) — REST `/api/v1`, BFF `/api/tradex/*`,
  Server Actions.
- [docs/frontend-design.md](docs/frontend-design.md) — design system:
  colour tokens, typography, layout and UX conventions.
- [docs/NUMBER_AUDIT.md](docs/NUMBER_AUDIT.md) — number-reconciliation
  QA checks every figure must pass.
- [docs/DATABASE_OPTIMIZATION.md](docs/DATABASE_OPTIMIZATION.md) —
  query/index work (historical audit; see the current-state note).
- [docs/OPS_VERIFICATION.md](docs/OPS_VERIFICATION.md) — deploy-time
  ops checklist.

## Scripts

**Client** (`cd client`)

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint

**Server** (`cd server`)

- `npm run start:dev` — Nest watch
- `npm run build` / `npm run start:prod`
- `npm run prisma:generate` / `prisma:deploy`
- `npm test` — unit tests (no database)
