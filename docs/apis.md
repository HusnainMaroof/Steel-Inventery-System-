# Tradex APIs

Nest serves REST under `/api/v1`. Except for auth status/login, routes require
`Authorization: Bearer <JWT>`. Next.js browser code uses same-origin BFF route
handlers so the JWT remains in the httpOnly `session` cookie.

## Auth and owners

- `GET /auth/status`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/register` — closed, returns 403
- `GET /owners` — SUPERADMIN; active business owners
- `POST /owners` — SUPERADMIN; creates a Business and its ADMIN login
- `DELETE /owners/:id` — SUPERADMIN; revokes the login without deleting data

There is no public registration or staff-account API in the active product.

## Tenant data APIs

- `GET /ledger/bootstrap` — normalized initial data for all owner screens
- `GET|PUT /settings` — invoice and UI preferences
- `/products` and nested categories, attributes, options, and variants
- `/warehouses` and nested locations
- `/customers` and `/customers/:id/ledger`
- `/suppliers` and `/suppliers/:id/payables`
- `/purchases` — create/read/update/delete
- `/sales` — create/read/delete
- `/payments` — customer invoice allocation and supplier settlement
- `/invoices`
- `/expenses` — create/read/delete
- `/inventory/stock`, `/inventory/variants`, `/inventory/lots`,
  `/inventory/movements`, `/inventory/adjustments`
- `/stock-checks`
- `/reports/profit`

Browser calls use `/api/tradex/<path>`, which forwards method, query, body, and
the server-held JWT. All controllers obtain tenant scope from that JWT. Core
purchase, sale, and payment writes use Prisma transactions. Errors use
`{ "statusCode", "message", "error" }`; paginated lists use
`{ "items", "page", "limit", "total", "pages" }`.

## Health

`GET /health` is unversioned and public. It verifies database reachability.
