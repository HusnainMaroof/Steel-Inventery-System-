# Tradex — Project Architecture

How the Tradex business-ledger app is built, and how inventory (and everything
else) is managed under the hood.

## 1. What the system is

Tradex is a single-page-style web app (built on Next.js App Router) that runs a
whole trading business in one ledger:

- **Buy** stock from suppliers (recorded as purchases).
- **Stock** is kept automatically — no manual stock counts.
- **Sell** to customers with printed invoices.
- **Track payments** on both sides — what customers owe you and what you owe suppliers/mills.
- **See profit** — real profit, counted only when money is actually collected.

One entry (a purchase or a sale) drives every other screen. There is no second
copy of the numbers anywhere: dashboard, inventory, sales, customers,
suppliers, payments and reports are all *derived* from the same raw records.

The catalogue is **configuration-driven, not product-specific**: businesses
shape their own `Product → Category → Attributes → Variant` model and the same
engine handles steel, cement, wire, paint or anything else — no hard-coded
Grade/Brand/Gauge/Factor fields and no `if product === "steel"` UI logic.

## 2. Big picture

```
┌────────────────────────────────────────────────────────────┐
│  Browser (React 19, client-side rendering)                 │
│                                                            │
│  src/app — pages by route                                  │
│    public:  / (homepage), /login                           │
│    owner:   /dashboard /purchases /products /inventory     │
│             /sales /customers /suppliers /payments /reports│
│    admin:   /admin (Owners panel, super admin only)        │
│    prints:  /sales/[id], /invoices/[id] (no sidebar)       │
│                                                            │
│  src/components — Shell (sidebar/gate), shared UI,         │
│                  catalogue/ (AttributeFields, VariantBadge)│
│                  sales/ (New Sale flow)                    │
│  src/lib/store.tsx — THE single source of truth + derived  │
│                      inventory, lots, costs, dues, stats   │
│  src/lib/seed.ts — starter catalogue & demo data           │
│  src/lib/catalogue.ts — variant keys, generic helpers      │
│  src/lib/auth.tsx — roles (super admin / owners)           │
│  src/lib/types.ts — record shapes                          │
└────────────────────────────────────────────────────────────┘
```

### Where the state lives

- The whole ledger lives in one React context (`StoreProvider` in
  `src/lib/store.tsx`), seeded from `src/lib/seed.ts`.
- Data is **in-memory only**: no database, no localStorage. A page refresh
  re-seeds the demo state. This is intentional for the current demo stage —
  there is no backend yet.
- All money and stock math happens in pure helper functions (`purchaseTotal`,
  `saleGrandTotal`, FIFO lot costing, …) that any screen can call, so two
  screens can never disagree.

## 3. The records (data model)

Everything is typed in `src/lib/types.ts`. New records carry a `businessId`
so a future backend can isolate businesses; today everything belongs to one
demo business.

### Dynamic catalogue (the identity of "what something is")

```
Product (Steel)
  └─ Category (Rebar)
       └─ AttributeDefs (Size = dropdown, Grade = dropdown, …)
            └─ AttributeOptions (3 Sutar…8 Sutar / 40·60·75 Grade)
                 └─ Variant (Rebar · 3 Sutar · 60 Grade)  ← stockable unit
```

| Record | What it holds |
|---|---|
| `Product` | Broad material family (`name`, base `unit`, `active`). |
| `ProductCategory` | A type inside a product (Rebar under Steel, Grey Cement under Cement). |
| `AttributeDef` | One property a category is described by: `name`, stable `key`, `type` (text/number/select/boolean/date/measurement), `required`, optional `unit`, `sortOrder`, `active`. |
| `AttributeOption` | Choices for a `select` attribute (each with `active`, never hard-deleted when history uses it). |
| `Variant` | One stockable/sellable combination of attribute values, deduped by a deterministic `key` (`categoryId + sorted key=value pairs`); friendly `shortName` is editable. |
| `Warehouse` / `WarehouseLocation` | Physical places stock can sit (Main Yard → Yard A, Rack 01) — optional, chosen per purchase lot. |

### Transactions (the business events)

| Record | What it holds |
|---|---|
| `Supplier` | A mill/company you buy from. |
| `Customer` | Someone who buys from you. |
| `Purchase` | One bought lot: supplier, variant identity, qty/unit, buying `rate`, `transport`, `otherCost`, planned `sellRate`, optional lot traceability (lot/heat/batch number, warehouse/location), and `paid`/payment history toward the mill. |
| `Sale` | One invoice: customer, lines, discount %, tax %. Carries `invoiceNo` and `createdAt` (exact recording time). |
| `SaleLine` | One sold item: qty, rate, unit, source (supplier and/or exact purchase lot). |
| `Payment` | Money in (customer) or out (supplier), with method (Cash/Bank/Cheque) and optionally the invoice it settles. |
| `Expense` | Shop running costs (Transport, Labor, Rent, Utilities, Other). |

**Snapshots keep history frozen.** Every purchase and sale line stores
`variantId` + `categoryId` + an `attributeSnapshot` (attribute key → value) at
entry time, *and* keeps legacy `product`/`item`/`spec`/`quality` mirror strings
so old math and displays keep working. Renaming or deactivating an attribute
later never rewrites an old invoice or purchase.

Key rules:
- **Every quantity is in its product's own natural unit** (kg stays kg, bag
  stays bag). There is no unit conversion and no kg↔ton math anywhere.
- **Supplier is not a product attribute** — it belongs to the lot/purchase.
  The same variant can be bought from different mills.
- Seed transactions (2 purchases / 2 sales / payments) carry both the legacy
  strings and the new variant identity, so existing numbers are untouched by
  the migration.

## 4. How inventory works

Inventory is **not stored as rows you edit** — it is recomputed from the
purchase and sale ledger every time the store changes (`useMemo` in
`store.tsx`). That is the heart of the design:

```
purchases (buy qty)  −  sales (sell qty)   =   current stock
```

### 4.1 Variant-level stock (`inventoryByVariant`)

The unit a business actually stocks and sells is the **variant**. The store
groups every purchase and sale by `variantId` and derives per-variant
purchased / sold / remaining qty, landed cost, stock value and sell rate.
Pre-dynamic records (no variant) roll up under an `item:` key so nothing is
lost.

### 4.2 Lot-level stock and FIFO costing (`stockLots`, `lineUnitCost`)

Each purchase is a **lot** that can only shrink (oldest-first FIFO):

- Sale lines that pick a specific lot consume only that lot.
- Lines without a chosen lot consume FIFO across the variant's lots (legacy
  lines fall back to item + supplier matching).
- The **true cost of goods sold** per sale line is the weighted landed cost of
  the lots it actually consumed (`lineUnitCost(saleId, lineIndex)`) — profit is
  computed from that, not a blended average.

### 4.3 Where it sits (`warehouses/locations`, optional)

A lot can record a warehouse and location. Purchases offer "Lot details
(optional)": lot/heat/batch numbers + warehouse/location. The Inventory page
expands each variant to list its remaining lots with supplier, heat/batch,
location and landed cost.

### 4.4 Stock movements (a derived journal)

`stockMovements` is a **projection**, not a second truth: every purchase
produces one `PURCHASE_RECEIPT` (+qty) and every sale line one `SALE` (−qty),
each carrying variant/snapshot/lot/supplier context. The movement types
(returns, transfers, adjustments, damage…) are reserved for future real
operations. The Inventory page shows this journal under its "Movements" tab.

### 4.5 Selling price

Inventory shows the purchase-recorded `sellRate` (weighted across lots) — the
planned invoice price. Sales auto-fill it from the chosen stock lot, falling
back to landed cost + ~15%. Prices are never part of variant identity.

### 4.6 Deleting / hiding

- Deleting a variant with stock cascades: its purchases and its sales (plus
  their payments) are removed together — no orphans, no negative stock.
- A sold-out variant is removed from the list **cosmetically only** (numbers
  untouched); legacy item rows behave the same.
- Catalogue entities (product/category/attribute/option/variant) referenced by
  history are **deactivated, never hard-deleted**.

## 5. How the money flows

### Buying

```
Purchase total (what it costs you) = qty × rate + transport + otherCost
Mill dues        (what you owe)     = qty × rate  (transport & other are yours)
```

`paid` on the purchase tracks money paid to the mill; the mill's balance is
`Σ (steel amount − paid)`. Supplier payments are also journaled as
`Payment` rows for the record, but never double-counted.

### Selling

One invoice per sale:

```
Subtotal   = Σ line qty × rate
Discount   = Subtotal × discount%
Taxable    = Subtotal − Discount
Tax        = Taxable × tax%
Grand total= Taxable + Tax
```

Every money figure in the app comes from these helpers
(`saleTotal`, `saleDiscount`, `saleTax`, `saleGrandTotal`).

### Dues and allocation

- **Customer balance** = all their invoices − all their payments
  (accrual basis; a credit shows negative).
- Payments can target a specific invoice (`saleId`). Unallocated customer
  payments settle that customer's **oldest unpaid invoice first (FIFO)** — two
  bills never merge.
- **Supplier balance** = what we still owe the mill from purchases
  (steel amount only).
- Overpayments are blocked with a visible error wherever money is entered.

### Profit (the important one)

Profit is **realized, cash-basis**, not accrual:

- An invoice's profit is recognized when the customer actually pays toward it,
  matched per invoice (`profit × received ÷ grand total`).
- Unallocated receipts are spread using the depot's blended margin.
- Whole-depot net profit subtracts shop expenses for the period.
- The dashboard, P&L and Reports all use this same memo so every number agrees.

## 6. Roles and sign-in

`src/lib/auth.tsx` holds the login logic (demo-only, client-side):

- **Super admin** (`SUPER_ADMIN` const, demo `admin`/`admin123`) — sees only
  `/admin`, the Owners panel, where they create owner logins (name, business
  name, username, password) for each new business.
- **Owners** (seeded `kashif`/`demo123` + any added in the panel) — sign in and
  use the whole depot app. The logged-in owner's **business/factory name is
  displayed in the brand spot** (sidebar top, mobile top bar) where the public
  Tradex name otherwise sits.
- `Shell` (`src/components/Shell.tsx`) is the gatekeeper: public routes
  (`/`, `/login`) render bare; everything else is role-checked and redirected
  (logged out → `/login`, owner → `/dashboard`, super admin → `/admin`).
- All in-memory: accounts and sessions reset on refresh, consistent with the
  demo data. Edit the `SUPER_ADMIN` / `SEED_OWNERS` consts to change the demo
  logins.

## 7. Pages and what each one does

| Route | For | Purpose |
|---|---|---|
| `/` | Public | Tradex product homepage (Business Ledger) |
| `/login` | Public | Sign in (owner or super admin) |
| `/dashboard` | Owner | Stats-only KPIs: stock, stock worth, sales, net profit, dues (customer vs mills), scoped per product |
| `/products` | Owner | **Catalogue configurator** — a flow: product chips → category rail → stage showing that category's attributes (dropdown options, reorder, hide) and variants created by real stock; warehouses & locations live in one collapsed, self-explaining section |
| `/purchases` | Owner | Dynamic purchase form: product → category → configured attribute fields → money; optional lot details (lot/heat/batch, warehouse/location). Supplier payable + payment history unchanged |
| `/sales` | Owner | Sales & Invoices — pick a **stocked variant** (optional specific lot), snapshot saved per line, printable invoice |
| `/inventory` | Owner | Stock at **variant level**: each row expands to its remaining lots (supplier, heat/batch, location); search across variant/attributes/lot numbers/supplier; a Movements tab with the derived +/− journal |
| `/customers` | Owner | Customers, their bills, balances and transaction history (renders variant attributes) |
| `/suppliers` | Owner | Mills/suppliers, what each is owed, and purchase history receipts (renders variant attributes) |
| `/payments` | Owner | Payments journal |
| `/reports` | Owner | Reports & Profit — P&L and monthly summaries (tabs), one shared month-stats memo |
| `/profit`, `/invoices`, `/audit` | Owner | Legacy/redirect + reconciliation self-checks |
| `/sales/[id]`, `/invoices/[id]` | Owner | Printable invoice/bill (no sidebar for clean print) |
| `/admin` | Super admin | Owners panel — add/delete owner accounts |

## 8. The dynamic forms engine

`src/components/catalogue/AttributeFields.tsx` renders a category's
`AttributeDefs` generically — `select → dropdown`, `number → number input`,
`measurement → number + unit suffix`, `text → text`, `boolean → Yes/No`,
`date → date`. Required attributes block saving (visible red message). The
same component drives Purchase entry; no component anywhere knows that
"Grade" belongs to steel.

Helpers in `src/lib/catalogue.ts`: deterministic `variantKey`,
`defaultShortName` (attribute values joined in definition order), ordered
attribute rows and display text. `VariantBadge` renders one identity block
(short name + attribute chips) wherever sales/purchases/inventory show a line.

## 9. Design and UX conventions

- Monochrome, professional look: white/gray/black (`#F8F8F7` canvas, `#171717`
  text, `#E5E5E5` borders), 8px radius cards, 1px borders, no gradients.
  Color only for status: muted red = due/warning, muted green = paid.
- Typography: Inter; small labels uppercase, tracked; numbers bold tabular.
- Screens favour a **guided flow over stacked panels**: the Products page leads
  product → category → attributes/variants on one focused stage; heavy or rare
  configuration (warehouses) collapses into self-explaining sections.
- Row actions are quiet icon buttons with tooltips (▲▼ reorder, ⏻ deactivate,
  ✎ rename, ✕ delete) rather than repeated labelled buttons.
- Lists are fully responsive: desktop tables become stacked mobile cards that
  never drop a column.
- Every destructive delete asks through a styled confirm dialog that spells
  out exactly what will change (a "this cannot be undone" frame).
- Entry forms are modals with clear section order (date → party → items →
  money → totals) and no nested popups.
- Reduced-motion is respected globally.

## 10. Reconciliation and trust in the numbers

- Because every screen derives from the same ledger, "buying raises stock,
  selling lowers it, and all reports reconcile" is a property of the design,
  not an afterthought.
- `src/app/audit/page.tsx` re-computes figures from the raw records and
  checks the surfaces agree: item-level stock, per-source rows, and now
  **variant-level conservation** (`Σ purchases − Σ sales per variant == stock ==
  Σ its remaining lots`) plus **movement journal** checks (each purchase has one
  +qty movement, each sale line one −qty movement). `NUMBER_AUDIT.md` documents
  the end-to-end number check.

## 11. Current limits / next steps

- **No backend**: in-memory demo data resets on refresh; login is a cosmetic
  gate. Real persistence + real auth is the obvious next layer.
- **One shared dataset**: all owners currently run the same demo ledger;
  per-owner/business isolation is deliberately deferred (records already carry
  `businessId` for when a backend lands).
- **Returns, transfers, adjustments** are reserved movement types without UI
  yet; movements are currently derived from purchases and sales.
- **Unit conversions** (ton↔kg, bag↔kg) are not implemented — qty + unit are
  stored as entered, per product.
- **Planned price lists** are not implemented — the current lot-level
  `sellRate` behavior is kept.
- Running it: `npm run dev` (develop), `npm run build` + `npm start`
  (production). Lint: `npx eslint .` (`next lint` is not available in
  Next 16).
