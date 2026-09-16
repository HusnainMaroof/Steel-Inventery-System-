# Tradex — Steel & Cement Inventory System

A single-depot inventory and money system built with Next.js (client-side
today, server-ready layout).

## Getting Started

```bash
cd client
npm install --include=dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Repository layout

```
client/           # the complete Next.js app
  src/app/        # App Router pages, layouts, and route handlers
  src/components/ # Reusable React components
  src/lib/        # Store, money/stock math, report engine
  src/types/      # TypeScript type definitions
  public/         # Static assets (images, icons, fonts)
server/           # Empty scaffold, reserved for the future backend
docs/             # All project documentation
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — what the system is, the data
  model, how inventory and money flow, page by page.
- [docs/frontend-design.md](docs/frontend-design.md) — the design system:
  colour tokens, typography, layout and UX conventions.
- [docs/apis.md](docs/apis.md) — the current client data API and the REST
  contract the future server will implement.
- [docs/NUMBER_AUDIT.md](docs/NUMBER_AUDIT.md) — the number-reconciliation
  QA checks every figure must pass.

## Scripts (run inside `client/`)

- `npm run dev` — start the dev server
- `npm run build` — create a production build
- `npm run start` — run the production build
- `npm run lint` — run ESLint
