# Frontend Design Guide

The UI conventions every screen in this app follows. The look is minimal,
professional, ~90% monochrome — configuration power must never surface as
dense enterprise chrome.

How the app is wired (providers, routes, BFF, store) lives in
[ARCHITECTURE.md](ARCHITECTURE.md). This file is the visual/UX contract.

## Colour

Tokens live in `client/src/app/globals.css` (`@theme`). Use the Tailwind
utilities (`bg-primary`, `text-success`, ...), never raw hex for these.

| Token | Value | Use |
|---|---|---|
| Canvas | `#F8F8F7` | page background |
| Card | `#FFFFFF` | panels, tables, modals |
| Text | `#171717` | all primary text |
| Border | `#E5E5E5` | all 1px borders |
| `primary` | `#2e6b2e` | primary actions and the current location |
| `ink` | `#111111` | the one dark priority element per view; active segmented item; tab underline |
| `success` / `destructive` / `warning` | `#2e6b2e` / `#a12b1f` / `#8a5a00` | status only |

- **Green means "do this" or "you are here".** Primary buttons (`btn-primary`),
  the active sidebar item and focus rings use `primary`. Nothing else turns green
  except a positive status.
- **No gray text anywhere.** Secondary copy is `text-[#171717]/70`, table
  headers `/60`. On dark surfaces text is white.
- The `ink` dark card is used for exactly one priority element per view (for
  example Net profit on the dashboard).

## Shape & density

- Cards and panels `rounded-xl` (10 to 12px), controls 8px, pills and badges
  fully rounded. Borders 1px `#E5E5E5`. No gradients, no heavy shadows.
- Root type is 16px on desktop and tablet, 15px on phones (`html` font-size).
  Never use `zoom` or transform scaling.
- Element base styles (inputs, labels, tables, `.btn-*`, `.panel`) live in
  `@layer base`, so Tailwind utilities on an element always win.
- Inputs, selects and buttons are 40px tall (44px on phones), 14px text.
- No card inside a card inside a card. A table sits directly in one card.
- The app fills the viewport width; the sidebar is sticky (`overflow-x: hidden`
  must never be reintroduced on html/body, it breaks `position: sticky`).

## Typography

- Inter throughout.
- Page title 26 to 30px bold (`PageTitle`); section title 16px semibold.
- Body and table cells 14px; secondary text 13px at `/70`.
- Labels, table headers and badges 12px, uppercase where they are labels.
  Nothing smaller than 12px.
- Numbers: `tabular-nums`, right-aligned in tables; big figures bold.

## App shell

- Full-width top bar: business logo (or "Your logo") in the left corner, the
  account menu on the right. No borders.
- Sidebar below the top bar: icon + label items, vertically centred, Help and
  Sign out pinned at the bottom.

## Layout conventions

- **One filter toolbar row** under the page header: search + period filters
  + the primary action button, all in a single wrapping row. Filter option
  sets are generic (every month/year), never derived from what data happens
  to exist. Active filters re-scope summary cards as well as rows.
- **Date-grouped lists** (Purchases, Sales, Payments): the date is the group
  header over a divider; all records of that date sit in one bordered table
  below it; mobile shows one bordered card per record. No aggregates in
  group headers unless the screen's spec calls for them.
- **Numeric columns** are right-aligned — header labels line up exactly over
  their values.
- **Rows are self-describing**: identity on top (product → item → attribute
  lines stacked), supplier/customer column, money bold, actions visible.
  A row must never hide columns on mobile — it re-renders as a card with
  every field.
- **No double-signalling**: payment state shows once (the Due figure), not
  again as a status badge.
- **Row actions** on lists live in the ⋮ kebab menu (`RowActionsMenu`); destructive
  actions sit last inside confirmation flows, never as red buttons per row.
- **Every delete confirms** through a styled dialog that spells out the
  concrete consequences (what disappears, which numbers move) and ends with
  an explicit "cannot be undone" warning. No native `window.confirm`.
- **Money guards**: a payment can never exceed what is owed; rejections show
  a visible error message inside the modal, never a silent clamp.
- **No ₨0 cards**: KPIs and report rows render only when there is a real
  figure. Dashboard dues split by direction (customers owe vs mills owed)
  and show aggregate numbers only — named parties live on their own pages.
- **Plain words**: labels use everyday shopkeeper language ("Money in
  (sales)", "Stock Cost", "Cash in Hand"), never accounting jargon. New
  fields arrive together with a UX upgrade, not as bare inputs.
- **Progressive disclosure**: configurable machinery (attributes,
  warehouses, lot details) hides behind collapsible sections, modals and
  guided flows until invoked.

## Screens

Tenant app lives under `/{businessSlug}/` (dashboard, products, purchases,
inventory, sales & invoices, customers, suppliers, payments, expenses,
reports, staff, settings, audit). Super Admin is `/admin/*`. Public:
`/`, `/login`, `/offline`, `/404`. `invoices` and `profit` redirect into
`sales` and `reports`.

Chrome: `Shell` (sticky sidebar, role redirects) + `StoreGate` (skeleton
until first ledger load). Printable `/sales/[id]` skips the sidebar.

## Shared components

- `client/src/components/ui.tsx` — `Page`, `PageTitle`, `CustomSelect`,
  `Modal`, `EmptyState`, `OptionalSection` (collapsible blocks that explain
  themselves in one purpose line).
- `client/src/components/reports/shared.tsx` — `Section` (bordered card with
  uppercase title + optional action), `StatementRow`, `StatementRule`,
  `StatementTotal` (light and dark variants).
- `client/src/components/DataTable.tsx` — generic table with mobile card
  rendering (used by screens not yet converted to date-grouped layouts).
- Feature folders: `components/sales/`, `catalogue/`, `invoice/`,
  `reports/`, `settings/`, `admin/`.

When a component gains a new capability, existing screens keep their
appearance exactly — extensions are opt-in parameters only.
