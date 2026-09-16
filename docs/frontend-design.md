# Frontend Design Guide

The UI conventions every screen in this app follows. The look is minimal,
professional, ~90% monochrome — configuration power must never surface as
dense enterprise chrome.

## Colour

| Token | Value | Use |
|---|---|---|
| Canvas | `#F8F8F7` | page background |
| Card | `#FFFFFF` | panels, tables, modals |
| Text | `#171717` | all primary text |
| Border | `#E5E5E5` | all 1px borders |
| Dark highlight | `#111111` | the one priority element per view |

- **No gray text anywhere.** Secondary copy is black at reduced opacity
  (`text-[#171717]/70`), never a gray token. On dark surfaces text is white.
- Colour is reserved for status, in muted tones only:
  - `#a12b1f` — due / shortage / negative
  - `#2e6b2e` — paid / positive
  - `#1f4e8c` — paid-to-mill badge
- The black `#111` treatment is used for exactly one priority element per
  view: the single most important total (e.g. grand total, Net Profit,
  Valuation of Remaining Stock), never sprinkled around.

## Shape & density

- Card/panel radius **8px**; inputs and buttons **6px**; borders 1px solid
  `#E5E5E5`. No gradients, no heavy shadows (only destructive buttons get a
  subtle `shadow-md`).
- Overall density comes from root `font-size: 90%` — never `zoom` or
  transform scaling (zoom breaks the full-bleed layout).
- The app fills the entire viewport width. No max-width containers in the
  app shell; the sidebar is sticky (and `overflow-x: hidden` must never be
  reintroduced on html/body — it kills `position: sticky`).
- Touch targets: controls are at least **44px** tall.

## Typography

- Inter (sans) throughout.
- Labels: 10–11px, uppercase, `letter-spacing: widest`, weight 500–600.
- Numbers: `tabular-nums`; big figures bold; table text weight 500;
  secondary text weight 400 at `/70` opacity.

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
- **Row actions** on read-mostly lists live in a ⋮ kebab menu; destructive
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

## Shared components

- `client/src/components/ui.tsx` — `Page`, `PageTitle`, `CustomSelect`,
  `Modal`, `EmptyState`, `OptionalSection` (collapsible blocks that explain
  themselves in one purpose line).
- `client/src/components/reports/shared.tsx` — `Section` (bordered card with
  uppercase title + optional action), `StatementRow`, `StatementRule`,
  `StatementTotal` (light and dark variants).
- `client/src/components/DataTable.tsx` — generic table with mobile card
  rendering (used by screens not yet converted to date-grouped layouts).

When a component gains a new capability, existing screens keep their
appearance exactly — extensions are opt-in parameters only.
