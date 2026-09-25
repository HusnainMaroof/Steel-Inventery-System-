# Tijaratt APIs

Nest serves REST under `/api/v1` (URI versioning, global prefix `api`).
`GET /health` is unversioned and public.

Except for auth status/login/register and health, routes require
`Authorization: Bearer <JWT>`. Next.js browser code never sends that
header. It uses same-origin BFF handlers so the JWT stays in the httpOnly
`session` cookie.

Full paths below are Nest paths. The browser equivalent is
`/api/tijaratt/<path>` (no `/api/v1` prefix on the BFF URL).

## How the browser talks to Nest

```text
Browser  GET /api/tijaratt/sales?page=1
  → Next.js src/app/api/tijaratt/[...path]/route.ts
      assertSafeProxyPath + assertSameOrigin (mutations)
      tijarattFetch("/api/v1/sales?page=1") with Bearer from cookie
  → Nest SalesController.list
```

| Client | Nest |
|--------|------|
| `/api/tijaratt/ledger/bootstrap` | `GET /api/v1/ledger/bootstrap` |
| `/api/tijaratt/purchases` | `/api/v1/purchases` |
| `/api/auth/me` | `GET /api/v1/auth/me` |
| `/api/auth/status` | `GET /api/v1/auth/status` |
| `/api/health` | `GET /health` (6s timeout, `{ ok: true\|false }`) |

BFF methods: `GET | POST | PUT | PATCH | DELETE`. Multipart logo upload
bypasses the JSON BFF and posts straight to Nest from a Server Action.

Timeouts (`fetch-with-timeout.ts`): default 30s, `/ledger/bootstrap` and
`/ledger/transactions` 45s on the client, `/reports/` 60s.

## Conventions

**Errors** (Nest `AllExceptionsFilter`):

```json
{ "statusCode": 400, "message": "…", "error": "Bad Request" }
```

Prisma P2002 → 409, P2025 → 404, P2003 → 400. Stack traces never leave
the server. BFF error bodies are `{ "message": "…" }` with the Nest
status.

**Pagination** (`PaginationDto`): `?page=1&limit=50`. Default page size
50, max 100 (`LIMITS.MAX_PAGE_SIZE`). Response:

```json
{ "items": [], "page": 1, "limit": 50, "total": 0, "pages": 1 }
```

Customer ledger and supplier payables add `totalDue`.

**Tenant scope:** every controller reads `businessId` from the JWT.
There is no `businessId` query/body override.

**Staff ACL:** `@RequireStaffPage("<page>")` + `StaffAccessGuard`.
Plan `allowedPages` must include the page; staff also need it in
`User.access[]`. Owners (`ADMIN`) pass if the plan allows it.
Super Admin bypasses staff-page checks.

**IDs:** CUID. `:id` params go through `ParseIdPipe`.

**Money / qty caps** (`LIMITS`): money ≤ 999 999 999.99, qty ≤
9 999 999.999, ≤ 50 lines per document, single payment ≤ 100 000 000,
daily payment total per business ≤ 500 000 000.

---

## Health

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | Public | `{ status: "ok", database: "connected" }`. 503 if Postgres is down. `Cache-Control: no-store`. |

---

## Auth

Prefix `/api/v1/auth`. Login and register are throttled
(`AuthThrottleGuard`: 15 / 15 min in production, keyed by email else IP).

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/auth/status` | Public | — | `{ registrationOpen: false }` |
| POST | `/auth/login` | Public | `LoginDto` | `{ accessToken, user }`. JWT includes `sub`, `businessId`, `businessSlug`, `role`, `tokenVersion`. |
| POST | `/auth/register` | Public | `RegisterDto` | Closed. Always 403. Owners are created by Super Admin. |
| GET | `/auth/me` | JWT | — | Current user + business name/slug, `access`, `planPages` |
| POST | `/auth/logout` | JWT | — | Bumps `tokenVersion`; all outstanding JWTs for that user fail |

Next.js session: Server Action `loginAction` stores `accessToken` in the
`session` cookie. `GET /api/auth/me` maps Nest user through `toPublicUser`.

---

## Super Admin — owners

Prefix `/api/v1/owners`. `@Roles("SUPERADMIN")`.

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/owners` | — | Paginated active business owners |
| GET | `/owners/:id` | — | One owner + business + subscription |
| POST | `/owners` | `CreateOwnerDto` | Create `Business` + `ADMIN` login; optional plan + template ids |
| PATCH | `/owners/:id` | `UpdateOwnerDto` | Name / email / password / active |
| PATCH | `/owners/:id/subscription` | `UpdateSubscriptionDto` | Plan, status, expiry |
| POST | `/owners/:id/templates` | `ApplyTemplatesDto` | Apply catalogue templates (skips duplicate product names) |
| DELETE | `/owners/:id` | — | Revoke login (`active: false`). Does **not** delete the business or ledger. |

Called from Server Actions in `client/src/app/actions/users.ts`, not the BFF store.

---

## Super Admin — platform

Prefix `/api/v1/platform`. `@Roles("SUPERADMIN")`.

| Method | Path | Body / query | Purpose |
|--------|------|--------------|---------|
| GET | `/platform/overview` | — | Business counts, subscription mix, 30-day activity |
| GET | `/platform/templates` | — | Built-in + custom template summaries |
| GET | `/platform/templates/full` | — | Full template definitions (catalogue trees) |
| POST | `/platform/templates` | `CreateCatalogTemplateDto` | Custom catalogue template |
| GET | `/platform/subscription-plans` | `?all=1` | Active plans; `all=1` includes inactive |
| POST | `/platform/subscription-plans` | `CreateSubscriptionPlanDto` | Plan with `allowedPages`, billing cycle, price |
| PATCH | `/platform/subscription-plans/:id` | `UpdateSubscriptionPlanDto` | Update plan |

`allowedPages` empty = every business panel module. JWT validation
rejects tenant users whose subscription is `EXPIRED` or `CANCELLED`
(or past `subscriptionEndsAt`) — the cached JWT entries carry the
subscription fields and re-check expiry against the clock on every
request, and every plan/subscription write path invalidates cached
entries eagerly (`PATCH /owners/:id/subscription`, `DELETE /owners/:id`,
and `PATCH /platform/subscription-plans/:id` for all businesses on the
edited plan), so there is no staleness window.

---

## Staff (business owner)

Prefix `/api/v1/users`. `@Roles("ADMIN")`.

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/users` | — | Paginated `SUBADMIN` logins for this business |
| POST | `/users` | `CreateUserDto` | Create staff (title + `access[]`) |
| PATCH | `/users/:id` | `UpdateUserDto` | Update name, title, access, password, active |
| DELETE | `/users/:id` | — | Remove staff login |

---

## Ledger and settings

Staff page: `dashboard` for ledger; settings is owner-only.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/ledger/bootstrap` | JWT + dashboard | Slim hydrate. `{ data: { version: 3, counts, products, productItems, categories, attributeDefs, attributeOptions, variants, warehouses, locations, staff, settings, empty transaction arrays } }`. Catalogue + settings come from an in-process cache invalidated on every catalogue/settings write; `counts` and `staff` are always live. |
| GET | `/ledger/transactions` | JWT + dashboard | `{ data: { customers, suppliers, purchases, sales, payments, expenses, stockChecks } }` — one parallel `findMany` per collection (cap 20 000 rows each), no pagination metadata |
| GET | `/settings` | ADMIN | `{ data: Business.settings }` |
| PUT | `/settings` | ADMIN | `SaveLedgerDto` `{ data }` — sanitized UI/invoice prefs |

Bootstrap does **not** include `dashboardSummary` or transaction rows.
Staff (`SUBADMIN`) payload is filtered by `filterBootstrapForStaff`.

---

## Catalogue — products

Staff page: `products`.

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/products` | paginated | Product list with nested catalogue |
| POST | `/products` | `CreateProductDto` | Product (name, unit, `usesCategories`, `specLabel`) |
| GET | `/products/:id` | — | One product tree |
| PATCH | `/products/:id` | `UpdateProductDto` | Rename / unit / flags |
| DELETE | `/products/:id` | — | Soft-deactivate when history exists; otherwise remove |
| POST | `/products/:id/categories` | `CreateCategoryDto` | Category under a product |
| PATCH | `/products/categories/:id` | `UpdateCategoryDto` | |
| DELETE | `/products/categories/:id` | — | |
| POST | `/products/:id/attributes` | `CreateAttributeDto` | Attribute def (key, name, type, required) |
| PUT | `/products/:id/attributes/order` | `ReorderDto` | |
| PATCH | `/products/attributes/:id` | `UpdateAttributeDto` | |
| DELETE | `/products/attributes/:id` | — | |
| POST | `/products/attributes/:id/options` | `CreateOptionDto` | Option label |
| PUT | `/products/attributes/:id/options/order` | `ReorderDto` | |
| PATCH | `/products/options/:id` | `UpdateOptionDto` | |
| DELETE | `/products/options/:id` | — | |
| POST | `/products/:id/variants` | `CreateVariantDto` | Variant; identity is `identityKey`, not display name |
| PATCH | `/products/variants/:id` | `UpdateVariantDto` | |
| DELETE | `/products/variants/:id` | — | |

Catalogue entities referenced by history are soft-deactivated
(`active: false`), not hard-deleted.

---

## Warehouses

Staff page: `inventory`.

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/warehouses` | paginated | Warehouses with locations |
| POST | `/warehouses` | `CreateWarehouseDto` | |
| PATCH | `/warehouses/:id` | `UpdateWarehouseDto` | |
| DELETE | `/warehouses/:id` | — | |
| POST | `/warehouses/:id/locations` | `CreateLocationDto` | |
| PATCH | `/warehouses/locations/:id` | `UpdateLocationDto` | |
| DELETE | `/warehouses/locations/:id` | — | |

---

## Inventory

Staff page: `inventory`. Stock is **derived** — never a stored balance.

| Method | Path | Query / body | Purpose |
|--------|------|--------------|---------|
| GET | `/inventory/stock` | — | Qty per product (ledger sum) |
| GET | `/inventory/variants` | — | Qty per variant |
| GET | `/inventory/lots` | paginated | Remaining FIFO lots (purchase lines − consumed) |
| GET | `/inventory/movements` | `productId`, `from`, `to`, paginated | Signed `InventoryTransaction` history |
| POST | `/inventory/adjustments` | `AdjustInventoryDto` | Ledgered `ADJUSTMENT` only way to change stock outside purchase/sale |

---

## Purchases

Staff page: `purchases`. Writes `InventoryTransaction` `PURCHASE` rows
and optional initial mill payment atomically.

| Method | Path | Query / body | Purpose |
|--------|------|--------------|---------|
| GET | `/purchases` | `supplierId?`, paginated | Documents with lines + supplier |
| POST | `/purchases` | `CreatePurchaseDto` | Receipt + stock in. `paid` cannot exceed goods total. |
| GET | `/purchases/:id` | — | One document |
| PATCH | `/purchases/:id` | `UpdatePurchaseDto` | Header/charges/lines; stock ledger rewritten in a transaction |
| DELETE | `/purchases/:id` | — | Cascade: lines, ledger rows, related payments as implemented in the service |

Mill payable is **goods value only** (`qty × rate`). Transport / loading /
labour / otherCost are landed cost on the business.

---

## Sales and invoices

Staff page: `sales`. Sale create also creates the `Invoice` (1:1).

| Method | Path | Query / body | Purpose |
|--------|------|--------------|---------|
| GET | `/sales` | `customerId?`, paginated | Sales with lines, customer, invoice |
| POST | `/sales` | `CreateSaleDto` | Availability check + advisory lock + stock out + invoice. Optional `paidNow`. |
| GET | `/sales/:id` | — | One sale |
| DELETE | `/sales/:id` | — | Reversal ledger rows; invoice + allocations removed |
| GET | `/invoices` | `dueOnly=true?`, paginated | Invoice list (sale + customer) |
| GET | `/invoices/:id` | — | One invoice |

Sale lines may set `purchaseId` (source lot). Qty is limited to that
lot's remaining stock; COGS uses that lot's landed cost.

Oversell → 400, inventory and balances unchanged.

---

## Payments

Staff page: `payments`. Never overwrites a balance column.

| Method | Path | Query / body | Purpose |
|--------|------|--------------|---------|
| POST | `/payments` | `CreatePaymentDto` | Customer or supplier payment |
| GET | `/payments` | `type=customer\|supplier?`, paginated | With `allocations[]` |
| GET | `/payments/:id` | — | One payment + allocations |

`CreatePaymentDto`: `date`, `type` (`CUSTOMER` | `SUPPLIER`),
`customerId` / `supplierId`, `amount`, optional `method`
(`CASH` | `BANK` | `CHEQUE`), optional `saleId` (settle that invoice),
optional `note`.

Customer: `saleId` settles that invoice; otherwise FIFO oldest unpaid.
Amount cannot exceed remaining due (document or customer). Allocations
stored on `PaymentAllocation`; `Invoice.paid` updated in the same
transaction.

Supplier: FIFO oldest unpaid purchase documents (goods value).

---

## Customers and suppliers

| Method | Path | Query / body | Purpose |
|--------|------|--------------|---------|
| GET | `/customers` | `search?`, paginated | |
| POST | `/customers` | `CreateCustomerDto` | |
| PATCH | `/customers/:id` | `UpdateCustomerDto` | |
| DELETE | `/customers/:id` | — | Soft-deactivate (`active: false`) |
| GET | `/customers/:id/ledger` | paginated | Sales + payments; adds `totalDue` |
| GET | `/suppliers` | `search?`, paginated | |
| POST | `/suppliers` | `CreateSupplierDto` | |
| PATCH | `/suppliers/:id` | `UpdateSupplierDto` | |
| DELETE | `/suppliers/:id` | — | Soft-deactivate |
| GET | `/suppliers/:id/payables` | paginated | Purchases with remaining due; adds `totalDue` |

Balances are derived from invoices/purchases/payments, never stored.

---

## Expenses and stock checks

| Method | Path | Query / body | Purpose |
|--------|------|--------------|---------|
| GET | `/expenses` | `productId?`, `from?`, `to?`, paginated | |
| POST | `/expenses` | `CreateExpenseDto` | Category `TRANSPORT` \| `LABOR` \| `RENT` \| `UTILITIES` \| `OTHER` |
| GET | `/expenses/:id` | — | |
| DELETE | `/expenses/:id` | — | |
| GET | `/stock-checks` | `from?`, `to?`, paginated | |
| POST | `/stock-checks` | `CreateStockCheckDto` | Physical vs system qty snapshot — does not adjust stock |

---

## Reports

Staff page: `reports`. Aggregated; not a paginated list.

| Method | Path | Query | Purpose |
|--------|------|-------|---------|
| GET | `/reports/profit` | `ProfitReportQueryDto` | Period stock flow, P&L, cash, business value, dues |

Query: `mode=month\|year\|range` (default `month`), `year`, `month`,
`from`, `to`, `productId`. Figures are computed from transaction
records so every number is traceable. Tighter throttle: 20 / min / user.

---

## Media

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/media/business-logo` | SUPERADMIN or ADMIN | Multipart file. Sharp + Cloudinary. Max 8 MB, 1 file. Returns the hosted URL for settings. |

Not proxied through `/api/tradex`. `uploadBusinessLogoAction` posts to
Nest with the Bearer token.

---

## Next.js BFF and Server Actions

**Route handlers**

| Method | Path | Backend |
|--------|------|---------|
| GET | `/api/health` | `GET {TIJARATT_API_URL}/health` |
| GET | `/api/auth/me` | `GET /api/v1/auth/me` |
| GET | `/api/auth/status` | `GET /api/v1/auth/status` |
| * | `/api/tijaratt/[...path]` | `/api/v1/{path}{search}` |

Empty dirs `src/app/api/ledger/` and `src/app/api/preferences/` have no
`route.ts` — they are not live endpoints.

**Server Actions** (`"use server"`)

- `actions/auth.ts` — `loginAction`, `logoutAction`, `clearSessionAction`
- `actions/users.ts` — owners CRUD + staff CRUD
- `actions/platform.ts` — overview, templates, subscription plans
- `actions/media.ts` — `uploadBusinessLogoAction`

---

## Rate limits

In-process store (not Redis). Multi-instance deploys need a shared store.

| Guard | Window | Limit |
|-------|--------|-------|
| `AuthThrottleGuard` | 15 min | 15 (production) / 60 (dev) / 100 (test), keyed by email else IP |
| `ApiThrottleGuard` reads | 1 min / IP | 240 |
| `ApiThrottleGuard` writes | 1 min / IP | 90 |
| Reports | 1 min / user | 20 |

Health, login, and status skip the API throttle (login has its own).

---

## Client store → BFF map

Relative to `/api/tradex`:

| Store method | HTTP |
|--------------|------|
| `addPurchase` / `updatePurchase` / `deletePurchase` | `POST/PATCH/DELETE /purchases/:id` |
| `addSale` / `deleteSale` | `POST /sales`, `DELETE /sales/:id` |
| `addPayment` | `POST /payments` |
| `addCustomer` / `deleteCustomer` | `POST /customers`, `DELETE /customers/:id` |
| `addSupplier` / `deleteSupplier` | `POST /suppliers`, `DELETE /suppliers/:id` |
| `addExpense` / `deleteExpense` | `POST /expenses`, `DELETE /expenses/:id` |
| `recordStockCheck` | `POST /stock-checks` |
| products / categories / attributes / options / variants | `/products…` |
| warehouses / locations | `/warehouses…` |
| staff | `POST/PATCH/DELETE /users` |
| `updateUiPrefs` | `PUT /settings` (no full refresh; rollback on fail) |
