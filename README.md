# Tradex — Steel & Cement Inventory System

A depot ledger for stock, sales, payments and profit. Authentication,
business-owner accounts, invoice settings, and each tenant's complete ledger
persist in PostgreSQL through the Nest API.

## Getting Started

1. Configure `server/.env` and `client/.env.local` from their examples.
2. Run `npm install`, `npm run prisma:generate`, and `npm run prisma:deploy`
   in `server/`, then start it with `npm run start:dev`.
3. Run `npm install --include=dev` and `npm run dev` in `client/`.

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Repository layout

```
client/           # Next.js 16 UI
  src/app/        # App Router pages, layouts, and route handlers
  src/components/ # Reusable React components
  src/lib/        # Store, money/stock math, report engine, auth façade
  src/types/      # TypeScript type definitions
  public/         # Static assets (images, icons, fonts)
server/           # NestJS + Prisma API (PostgreSQL on Neon)
docs/             # All project documentation
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — what ships today, the data
  model, how inventory and money flow, page by page.
- [docs/frontend-design.md](docs/frontend-design.md) — the design system:
  colour tokens, typography, layout and UX conventions.
- [docs/apis.md](docs/apis.md) — the implemented REST and BFF contracts.
- [docs/NUMBER_AUDIT.md](docs/NUMBER_AUDIT.md) — the number-reconciliation
  QA checks every figure must pass.

## Scripts (run inside `client/`)

- `npm run dev` — start the dev server
- `npm run build` — create a production build
- `npm run start` — run the production build
- `npm run lint` — run ESLint
