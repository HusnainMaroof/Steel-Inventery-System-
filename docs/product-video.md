# Tijartt product video brief

## 1. Title and purpose

This document is the brief for a Remotion product explainer video of
Tijartt. It holds everything the video needs: what the product is, who it
is for, every screen and flow, the brand look, and a ready scene plan with
on screen text and voiceover. The video is a short product explainer, 60 to
90 seconds, in English with an optional Roman Urdu voiceover.

## 2. Product in one line and in one paragraph

**In one line:** Tijartt is a multi-tenant depot ledger for stock, sales,
payments and profit.

**In one paragraph:** Tijartt is a depot ledger for traders such as steel,
cement, wire, paint and tiles depots. A purchase from a mill adds stock, a
sale removes stock, and the dashboard, invoices, dues and reports all come
from the same records. Money is exact: amounts are stored as Prisma
`Decimal`, never floats. Customer payments settle a chosen invoice or the
oldest unpaid invoice first (FIFO) and can never exceed what is owed.
Supplier payments settle the oldest unpaid purchase documents first and
cover goods value only. One depot cannot see another depot's data: every
record belongs to one business, taken from the login.

## 3. Who it is for

| Role | What they do | What they see |
|---|---|---|
| Owner (`ADMIN`), the shopkeeper or depot owner | Sets up the catalogue, records purchases and sales, takes payments, checks profit, manages staff and settings | Home at `/{businessSlug}/dashboard`; every module their subscription plan includes, plus Staff and Settings |
| Staff (`SUBADMIN`), for example a sales manager or store keeper | Records the work they are allowed to do, for example sales or inventory | Only the pages in their access list, and only if the plan includes them; never Staff or Settings |
| Super Admin | Registers business owners, sets plans, keeps catalog templates | The platform panel only: `/admin/overview`, `/admin/businesses`, `/admin/subscriptions`, `/admin/products`; no tenant pages |

Source: `docs/ARCHITECTURE.md` (Roles), `client/src/components/BusinessLink.tsx`, `client/src/app/[businessSlug]/staff/page.tsx`.

## 4. The problem and the promise

The pain:

- Stock lives in a notebook, so what the book says and what sits in the yard do not match.
- Dues are unclear: nobody is sure who owes how much, or since when.
- Profit is a guess, because it is worked out from memory at the end of the month.
- Shop costs (transport, loading, labour, rent) are written down somewhere, or nowhere.

The promise, only where the code supports it:

| Pain | How Tijartt answers it |
|---|---|
| Mismatched stock | Purchases and sales write a signed stock movement, so current quantity is the sum of the ledger. |
| Unknown dues | Customer dues come from invoices, mill dues come from purchases, and both show on the dashboard and on the Dues report. |
| Unclear profit | Net profit comes from the same sales, landed cost and expenses, not from a separate sheet. |
| Scattered costs | Transport, loading, labour and other charges are added to a purchase as landed cost; shop costs are typed on the Expenses page. |
| No proof for the customer | Every sale gets a numbered invoice that can be printed or saved as PDF. |

Source: `docs/ARCHITECTURE.md`, `client/src/app/[businessSlug]/dashboard/page.tsx`, `client/src/app/[businessSlug]/reports/page.tsx`.

## 5. Key messages

- Know what you have, owe, earn
- One ledger for the whole depot
- Stock that matches the yard
- Dues you can actually see
- Profit from the same records
- Buy, sell, print the bill
- Plain shopkeeper words throughout

## 6. Feature tour, screen by screen

Each screen below gives what the user sees, the main action, and the one
visual worth showing in the video.

### Dashboard

- What you see: a dark Net profit card with Sales made under it, then Customer dues, Mill dues, Products in stock (or Stock in hand) and Stock worth. A period switch (Today, This Month, This Year), a date range, and a product picker ("All Products, entire depot").
- Main action: pick a period or a product and read the four figures.
- Visual for the video: the dark Net profit card with a number count up, then the four KPI cards appearing beside it.
- Source: `client/src/app/[businessSlug]/dashboard/page.tsx`, `docs/ARCHITECTURE.md`.

### Products (catalogue)

- What you see: a list of products. Open one to configure it as Product then Attributes (for example Steel), or Product then Categories then Attributes (for example Cement). Attributes can be a dropdown, text, number, yes or no, date or measurement, and each dropdown has its own options. Variants are created automatically the first time stock is bought or sold.
- Main action: Add Product. Start from scratch or from a template such as Steel Trading, Cement Trading, Wire Trading, Paint Trading or Tiles Trading.
- Visual for the video: the catalogue tree opened on one product, with its attributes, then the Variants block filling in.
- Source: `client/src/app/[businessSlug]/products/page.tsx`, `client/src/lib/templates.ts`.

### Purchases

- What you see: purchases grouped by date, with supplier, product identity, quantity, buy rate and sell rate. A second tab, Payment dues, lists every purchase still unpaid to the mill. Opening a purchase shows identity, costs and pricing, and payment and profit, including landed cost per unit and Total Payable to Mill.
- Main action: Add purchase. Pay supplier from the dues tab or from the purchase detail.
- Visual for the video: the Add purchase form filling in, then the same purchase appearing in the dated list with a due badge.
- Source: `client/src/app/[businessSlug]/purchases/page.tsx`, `client/src/components/purchases/NewPurchaseModal.tsx`.

### Inventory

- What you see: two tabs, Stock and Movements. Stock groups variants by product with available stock, stock value, number of lots and a status of In stock, Low stock or Out of stock. Movements show every purchase and sale as a signed quantity with the stock left after it, linked back to the purchase or sale.
- Main action: open a variant to read its lots, supplier, purchased quantity and landed rate, or open the movement journal.
- Visual for the video: the stock table, then one variant opening to its lots and recent movements.
- Source: `client/src/app/[businessSlug]/inventory/page.tsx`, `docs/ARCHITECTURE.md` (How stock and money move).

### Sales and invoices (including the printable bill)

- What you see: three tabs. Invoices pages through sales with invoice number and time, and each row has a payment state (Paid, Partly paid or Unpaid) with the due amount under it. Customer dues lists customers who still owe, with the oldest unpaid invoice and how many days ago. Print opens the batch print pack.
- Main action: New sale, then print the bill, or receive a payment against a sale or a customer.
- Visual for the video: the New sale form with stock picked from what exists, then the printed invoice page with the business logo and totals.
- Source: `client/src/app/[businessSlug]/sales/page.tsx`, `client/src/app/[businessSlug]/sales/[id]/page.tsx`, `client/src/components/sales/PrintPack.tsx`, `client/src/components/InvoiceDocument.tsx`.

### Customers

- What you see: a list of customers with shop or area and phone. Opening a customer shows their dues history: sales and payments with a running balance.
- Main action: New Customer, then receive a payment from inside the history, which can go to a chosen invoice or to the oldest unpaid one.
- Visual for the video: the customer history modal, scrolling the running balance from a due down to a smaller due.
- Source: `client/src/app/[businessSlug]/customers/page.tsx`, `client/src/components/customers/CustomerHistoryModal.tsx`.

### Suppliers

- What you see: a list of mills and suppliers. Opening one shows their purchases by date with day totals and day paid, and what is still owed.
- Main action: New Supplier, then pay a due from the supplier view or the Purchases dues tab.
- Visual for the video: a supplier page with a purchase history and a falling balance to the mill.
- Source: `client/src/app/[businessSlug]/suppliers/page.tsx`, `docs/ARCHITECTURE.md`.

### Payments

- What you see: three figures, Received, Paid and Net, a type filter, a date range and a name search. Payments group by date. The page explains that customer dues are taken on Sales and mill dues are paid on Purchases.
- Main action: filter and read the money that moved.
- Visual for the video: the Received, Paid, Net cards with a number count up, over a dated payment list.
- Source: `client/src/app/[businessSlug]/payments/page.tsx`.

### Expenses

- What you see: two figures, Records and Total spent, then expenses grouped by date with a name and amount. A search box and a date range sit above.
- Main action: Add expense. Type a name and an amount, for example electricity, salary, rent or labour.
- Visual for the video: Add expense typing "Electricity bill" and an amount, then the Total spent figure rising.
- Source: `client/src/app/[businessSlug]/expenses/page.tsx`.

### Reports

- What you see: four tabs with a plain meaning each. Profit: "Did this period make money?". Stock: "What came in and what is left in the yard?". Cash: "How much money is in hand?". Dues: "Who owes who, and for how long?". A product filter and a date range sit above, with an export menu for Excel and PDF.
- Main action: pick a period and a product, read the statement, and export if needed.
- Visual for the video: the Profit tab, scrolling from sales revenue down to net profit, then a quick cut to the Dues tab.
- Source: `client/src/app/[businessSlug]/reports/page.tsx`, `client/src/components/reports/ReportSections.tsx`.

### Staff

- What you see: each staff member with name, email, title and a summary of the pages they can open. The staff form offers only the pages the business plan includes.
- Main action: Add staff member, with own login, a title and a chosen set of pages. Edit or remove later.
- Visual for the video: the staff modal with page checkboxes, then the access summary line on the staff card.
- Source: `client/src/app/[businessSlug]/staff/page.tsx`, `docs/ARCHITECTURE.md` (Auth and gating).

### Settings

- What you see: Bills and invoices, with the factory logo box, factory name, address, city, phone, email on bills and a line at the bottom of the bill. A live bill preview sits beside the form. Your login is the last block.
- Main action: add a logo and fill the invoice details.
- Visual for the video: a logo dropping into the bill header, then the printed bill using that name and logo.
- Source: `client/src/app/[businessSlug]/settings/page.tsx`.

### Super Admin panel: Overview

- What you see: quick action cards (Businesses, Plans, Catalog, System), a platform snapshot (Businesses, Active owners, Active subscriptions, Expired subscriptions), ledger activity for the last 30 days (Sales, Purchases, Payments), a subscription mix, catalog and plan counts, and a Needs attention box.
- Main action: open a quick action, or jump to the list that needs attention.
- Visual for the video: the stat cards and the subscription mix, briefly, to show the platform behind the depots.
- Source: `client/src/app/admin/overview/page.tsx`, `client/src/components/admin/admin-overview.tsx`.

### Super Admin panel: Businesses

- What you see: every registered business with a search box, a status filter (Active, Expired, Login off) and a count of shown businesses. Opening a business leads to its plan, templates and owner login.
- Main action: Register business owner, choose a plan and product templates.
- Visual for the video: the business table with status badges, then the register owner modal.
- Source: `client/src/app/admin/businesses/page.tsx`, `client/src/components/admin/admin-ui.tsx`.

### Super Admin panel: Plans

- What you see: active plans and hidden plans, a count of businesses on a plan, and a card per plan with its billing cycle. The plan editor sets the billing type and the modules each plan unlocks.
- Main action: New plan, edit a plan, or hide an active one.
- Visual for the video: the plan table with the module list per plan, showing that access follows the plan.
- Source: `client/src/app/admin/subscriptions/page.tsx`, `client/src/components/admin/subscription-plans-ui.tsx`.

### Super Admin panel: Catalog templates

- What you see: built in trade types (steel, cement, wire, paint, tiles) and any custom templates. Each template card expands to show the product, its unit, and its attributes or categories.
- Main action: New template, so a new business can start from a ready catalogue.
- Visual for the video: the built in trade type cards expanding once to show a ready made catalogue.
- Source: `client/src/app/admin/products/page.tsx`, `client/src/components/admin/catalog-templates.tsx`.

## 7. The core story flow

The numbers below are sample data for the video. They are not real
customers or real prices. The rules they follow are the real rules: money
is exact, a payment cannot exceed the remaining due, and stock is consumed
oldest lot first (FIFO).

Step 1. The owner buys stock from a mill (Purchases).

| Line | Sample value |
|---|---|
| Product | Cement, Grey Cement category |
| Quantity and rate | 200 bags at Rs 1,250 per bag |
| Goods value | Rs 250,000 |
| Transport | Rs 10,000 |
| Loading | Rs 4,000 |
| Labour | Rs 2,000 |
| Landed cost | Rs 266,000, or Rs 1,330 per bag |
| Total payable to mill | Rs 250,000 (goods only, charges are the business's own cost) |
| Paid now | Rs 100,000 |
| Mill due | Rs 150,000 |

Step 2. The owner sells to a customer (Sales and invoice).

| Line | Sample value |
|---|---|
| Quantity and rate | 60 bags at Rs 1,450 per bag |
| Subtotal | Rs 87,000 |
| Discount, tax, extra charges | None in this example |
| Grand total | Rs 87,000 |
| Paid now | Rs 40,000 |
| Customer due | Rs 47,000 |
| Cost of the 60 bags, FIFO oldest lot first | 60 at Rs 1,330, so Rs 79,800 |
| Profit on this sale | Rs 87,000 minus Rs 79,800, so Rs 7,200 |

FIFO note: this sample has one lot, so all 60 bags come from it. With more
lots, the oldest lot is sold first.

Step 3. The customer pays part of the due (Payments, taken on Sales).

| Line | Sample value |
|---|---|
| Payment received | Rs 30,000 |
| Paid before | Rs 40,000 |
| Paid after | Rs 70,000 of Rs 87,000 |
| Remaining due | Rs 17,000 |
| Rule applied | The amount cannot exceed the remaining due of Rs 47,000; with no invoice chosen, the oldest unpaid invoice receives it |

Step 4. Dashboard and reports update from the same records.

| Figure | Sample value | Where it comes from |
|---|---|---|
| Sales made | Rs 87,000 | The sale |
| Net profit | Rs 7,200 | Sale value minus landed cost, no expenses recorded |
| Customer dues | Rs 17,000 | Invoice total minus payments |
| Mill dues | Rs 150,000 | Purchase goods value minus payments to the mill |
| Products in stock | 140 bags (200 bought, 60 sold) | Signed stock movements |
| Stock worth | Rs 186,200 (140 at Rs 1,330) | Remaining lots at landed cost |

Source: `docs/ARCHITECTURE.md` (How stock and money move), `server/src/domain/payment-settlement.ts`, `client/src/lib/money.ts`.

## 8. Trust points

| Point | What it means |
|---|---|
| Data in PostgreSQL | Businesses, logins and every ledger record are stored in PostgreSQL through Prisma, not in the browser |
| Login cookie is httpOnly | The browser never receives the API token; it stays in an httpOnly session cookie, sameSite strict, 12 hours |
| Staff see only allowed pages | The plan lists the allowed pages first, then the staff member's own access list; Staff and Settings are owner only |
| Subscription plans | Every plan lists the modules it unlocks; an expired or cancelled plan fails login |
| Every delete confirms | A styled dialog spells out what disappears and which numbers move, and says it cannot be undone |
| Printable invoices | Each sale has one invoice that can be printed, and sales can be batch printed |
| Works on phone | A row re-renders as a card with every field on a narrow screen such as 390px, and controls are 44px tall on phones |

Source: `docs/ARCHITECTURE.md` (Security, Accounts and administration), `docs/frontend-design.md`, `client/src/app/globals.css`, `client/src/app/[businessSlug]/sales/page.tsx`.

## 9. Brand and visual style for the video

Colours (from the app theme). Use these values as they are.

| Token | Hex | Use |
|---|---|---|
| Canvas | `#F8F8F7` | page background |
| Card | `#FFFFFF` | panels, tables, modals |
| Text | `#171717` | all primary text |
| Border | `#E5E5E5` | all 1px borders |
| Primary green | `#2E6B2E` | primary action and the current location |
| Ink | `#111111` | the one dark priority element in a view |
| Success | `#2E6B2E` | positive status only |
| Destructive | `#A12B1F` | due and error status only |
| Warning | `#8A5A00` | warning status only |

Style rules:

- Font: Inter throughout. Page title 26 to 30px bold, section title 16px semibold, body and table cells 14px, secondary text 13px at 70 percent, labels and badges 12px uppercase. Numbers use tabular figures and are right aligned in tables.
- Cards and panels use rounded-xl corners (10 to 12px) and 1px `#E5E5E5` borders. No gradients and no heavy shadows.
- Green means "do this" or "you are here". Nothing else turns green except a positive status.
- The dark ink card is used for exactly one priority element per view, for example Net profit on the dashboard.
- There is no gray text: secondary copy is `#171717` at 70 percent.
- Copy tone: plain shopkeeper words, no accounting jargon, no emojis, no em dashes. Examples of the wording the app uses are "Money in (sales)", "Stock Cost" and "Cash in Hand".

Source: `docs/frontend-design.md`, `client/src/app/globals.css`.

## 10. Assets

Files that exist in `client/public/images/`:

| File | Notes |
|---|---|
| `client/public/images/tijartt_home_logo.png` | Approved wordmark (black on transparent). A trimmed 800px copy is `tijartt-logo.png`. |
| `client/public/images/favicon.png` | White mark only, on transparent. Use on dark backgrounds or as the app icon. |
| `client/public/images/feature-dashboard.png` | The image used on the landing feature card. Good for the product intro or the trust scene. |

Screens worth recording, with their URL paths:

| Screen | URL path |
|---|---|
| Dashboard | `/{businessSlug}/dashboard` |
| Products | `/{businessSlug}/products` |
| Purchases | `/{businessSlug}/purchases` |
| Inventory | `/{businessSlug}/inventory` |
| Sales | `/{businessSlug}/sales` |
| Printable bill | `/{businessSlug}/sales/[id]` |
| Customers | `/{businessSlug}/customers` |
| Suppliers | `/{businessSlug}/suppliers` |
| Payments | `/{businessSlug}/payments` |
| Expenses | `/{businessSlug}/expenses` |
| Reports | `/{businessSlug}/reports` |
| Staff | `/{businessSlug}/staff` |
| Settings | `/{businessSlug}/settings` |
| Admin overview | `/admin/overview` |
| Admin businesses | `/admin/businesses` |
| Admin plans | `/admin/subscriptions` |
| Admin catalog | `/admin/products` |

Replace `{businessSlug}` with the demo business slug. The demo business name
and slug are placeholders (owner to confirm).

Missing, all placeholders for the owner to confirm:

- Screen recordings or high resolution screenshots of the demo business.
- The demo data to record: products, a mill, a customer, one purchase, one sale and one payment.
- Voiceover: language choice (English main, Roman Urdu optional) and the voice artist.
- Music track and its licence.
- The public domain to show, if any, and the contact detail for the call to action.
- Any customer names, testimonials or counts. The landing page currently shows "Trusted by 3,000+ businesses", which is marketing copy and is not backed by product data, so it is left out.

## 11. Scene plan for Remotion

| Scene | Duration (s) | Frames at 30 fps | Visual | On screen text | Voiceover | Motion idea |
|---|---|---|---|---|---|---|
| 1 Hook | 6 | 180 | Landing hero headline over `client/public/images/feature-dashboard.png` | Stock, dues, profit. One ledger. | Every depot runs on numbers. Stock, dues and profit. | Fade in, then highlight pulse on "ledger" |
| 2 Problem | 8 | 240 | A notebook page, then the three pains as short lines | Notebooks do not add up | Most shops keep this in notebooks. Stock does not match. Dues are unclear. Profit is a guess. | Slide up per line, cross-fade to the next screen |
| 3 Product intro | 7 | 210 | `/{businessSlug}/dashboard` wide shot | One ledger for the whole depot | Tijartt is one ledger for your whole depot. Buy stock, sell it, and see the truth. | Fade in, slow scale in |
| 4 Catalogue | 6 | 180 | `/{businessSlug}/products` tree opening one product | Your trade, your catalogue | Start with steel, cement, wire, paint or tiles. Add your own products. | Slide up, cross-fade between product and attributes |
| 5 Purchase | 8 | 240 | Add purchase form on `/{businessSlug}/purchases`, then the dated list | Buy from the mill | Record a purchase from the mill. Quantity, rate and costs update your stock. | Fade in per field, number count up on the total |
| 6 Inventory | 6 | 180 | `/{businessSlug}/inventory` stock table, then one variant detail | See what is left | Inventory shows what is left, which lot it came from, and what it is worth. | Slide up, highlight pulse on the stock figure |
| 7 Sale and invoice | 9 | 270 | New sale form on `/{businessSlug}/sales`, then `/{businessSlug}/sales/[id]` printed bill | Sell and print the bill | Make a sale. Tijartt removes the stock and creates a numbered invoice you can print. | Cross-fade from form to bill, scale in on the bill |
| 8 Payment | 7 | 210 | Customer dues tab on `/{businessSlug}/sales`, then the history modal | Part payment. Clear due. | Take a part payment. The due stays open until the customer clears it. | Number count up on the due, highlight pulse on the new due |
| 9 Dashboard and reports | 8 | 240 | `/{businessSlug}/dashboard` KPI cards, then `/{businessSlug}/reports` Profit tab | Numbers that match | The dashboard and reports update from the same records. Dues, stock, cash, profit. | Number count up on each KPI, cross-fade to reports |
| 10 Trust | 7 | 210 | Quick cuts: `/{businessSlug}/staff`, a delete confirm dialog, a phone width card at 390px | Built to be trusted | Your data sits in PostgreSQL. Staff see only their pages. Every delete asks first. | Fade in, cross-fade between the three shots |
| 11 Call to action | 8 | 240 | `client/public/images/tijartt-logo.png` on the canvas colour | Know what you Have, Owe, Earn | Tijartt. Know what you have, owe and earn. Ask us for a demo. | Scale in, fade in, hold |
| **Total** | **80** | **2400** | | | | |

## 12. Full voiceover script

English. Read as one continuous script in the scene order above.

Every depot runs on numbers. Stock, dues and profit. Most shops keep this in
notebooks. Stock does not match. Dues are unclear. Profit is a guess.
Tijartt is one ledger for your whole depot. Buy stock, sell it, and see the
truth. Start with steel, cement, wire, paint or tiles. Add your own
products. Record a purchase from the mill. Quantity, rate and costs update
your stock. Inventory shows what is left, which lot it came from, and what
it is worth. Make a sale. Tijartt removes the stock and creates a numbered
invoice you can print. Take a part payment. The due stays open until the
customer clears it. The dashboard and reports update from the same records.
Dues, stock, cash, profit. Your data sits in PostgreSQL. Staff see only
their pages. Every delete asks first. Tijartt. Know what you have, owe and
earn. Ask us for a demo.

Roman Urdu (optional, same scene order).

Har depot numbers par chalta hai. Stock, udhaar aur munafa. Zyada dukanain
yeh copy mein likhti hain. Stock match nahi karta. Udhaar saaf nahi.
Munafa andaaza hota hai. Tijartt poore depot ke liye ek ledger hai. Stock
kharido, becho, aur sach dekho. Steel, cement, wire, paint ya tiles se
shuru karo. Apne products bhi add karo. Mill se purchase likho. Quantity,
rate aur kharch stock update karte hain. Inventory dikhati hai kya bacha
hai, kis lot se aaya, aur uski value kitni hai. Sale banao. Tijartt stock
kam karta hai aur numbered bill banata hai jo print ho sakta hai. Aadha
payment lo. Baqi udhaar tab tak khula rehta hai jab tak customer clear na
kare. Dashboard aur reports inhi records se update hote hain. Udhaar,
stock, cash, munafa. Aapka data PostgreSQL mein hai. Staff sirf apne pages
dekhta hai. Har delete pehle poochta hai. Tijartt. Jano kya hai, kitna
dena hai, aur kitna kamaya. Demo ke liye raabta karein.

## 13. Remotion build notes

- Composition: id `TijarattProductVideo`, `width` 1920, `height` 1080, `fps` 30, `durationInFrames` 2400 (80 seconds).
- One `Composition` with one `Sequence` per scene. Each `Sequence` `from` is the sum of the earlier durations, and `durationInFrames` is the scene's frames from the table.
- Put screen recordings and stills in the Remotion project's `public/` folder, and place them with `Video` for recordings and `Img` for stills. Pass a `staticFile` path.
- Keep the brand colours from section 9 in one constants file and read them from there, so a colour change is one edit.
- Load Inter as the only font, matching the app.
- Keep the total at 80 seconds unless the brief changes; the scene table is the single source for durations.
- This is a content brief, not a code project. Do not add Remotion dependencies to the Tijartt client.

## 14. Open questions for the owner

- Is there a public domain or website address to show on screen?
- What contact detail should the call to action use?
- Which language should the voiceover be in, English, Roman Urdu, or both, and who records it?
- Which music track, and is its licence cleared?
- Which demo business name and slug should be used for the recordings?
- Should the demo data be the sample numbers in section 7, or separate data?
- Should the landing page line "Trusted by 3,000+ businesses" appear in the video? It is marketing copy and is not backed by product data.
- Are there any real customer names or testimonials that are approved for use?
- Are prices or plan names to be shown, or should plans stay general?
- Which currency format should the video use? The app shows amounts with the rupee sign, for example Rs 1,250.
