# Number Audit Report — Minimal Inventory Demo

**Date:** 2026-09-08
**Result:** ✅ ALL 41 AUDIT CHECKS PASSED — zero failures.
**Verification:** typecheck + lint clean; `/audit` QA page re-run green after the seed simplification.

---

## 1. What the demo now contains

A deliberately minimal setup so every flow is easy to follow:

| Counterparty | Count | Name |
|---|---|---|
| Suppliers | 1 | Amreli Steels |
| Customers | 1 | Rahim Builders |

| Transaction | Count | Details |
|---|---|---|
| Purchases | 1 | 2,000 kg 3 Sutar @ ₨240/kg + ₨2,500 transport — **unpaid** (mill due exists) |
| Sales | 1 | 500 kg of that steel @ ₨280/kg to Rahim Builders — **unpaid** (customer due exists) |
| Payments | 0 | none recorded yet |
| Expenses | 0 | none recorded yet |

Product catalogue is unchanged (Steel kg, Wire kg, Cement bag with their items/qualities) so the entry forms still have everything to pick from. Date is today (08 Sep 2026) so the dashboard's Today / This Month / This Year periods all show this activity.

---

## 2. Master numbers (single source, printed by the audit page)

| Figure | Amount |
|---|---|
| Stock purchased (mill amount) | ₨ 480,000 |
| Owed to the mill (dues) | ₨ 480,000 |
| Billed to the customer (INV-001) | ₨ 140,000 |
| Customer dues (outstanding) | ₨ 140,000 |
| Stock in hand (1,500 kg @ ₨241.25 landed) | ₨ 361,875 |
| COGS of the 500 kg sold | ₨ 120,625 |
| Revenue − COGS = Net profit | ₨ 19,375 |

Landed cost per kg = (480,000 + 2,500) / 2,000 = **₨241.25**, so selling 500 kg costs 500 × 241.25 = ₨120,625 and leaves 1,500 kg worth ₨361,875.

---

## 3. Per-surface numbers — everything agrees

**Inventory:** `3 Sutar (kg): purchased 2,000 − sold 500 = stock 1,500`. Source lots non-negative; stock worth ₨361,875 = Σ row stockValue.

**Invoices / Sales:**

| Invoice | Customer | Grand | Paid | Due | Status |
|---|---|---|---|---|---|
| INV-001 | Rahim Builders | ₨ 140,000 | ₨ 0 | ₨ 140,000 | Unpaid |

**Customers:** Rahim Builders owes ₨140,000 — same figure on the dashboard, invoices list, customer balance and Credit/Debit.

**Suppliers:** Amreli Steels is owed ₨480,000 — same figure on the dashboard, Purchases → Payment Dues tab, supplier balance and Credit/Debit.

**Payments page:** Received ₨0 · Paid to mills ₨0 · Net ₨0 (nothing paid yet — expected).

**Dashboard:** Sales ₨140,000 (collected ₨0) · **Net Profit ₨0** — profit is realized/cash-basis, i.e. it counts only as customer payments arrive (the demo has none yet, so the card reads "Counts as customers clear their dues") · Customer Payment Dues ₨140,000 · Mills Payment Dues ₨480,000.

**Profit & Loss:** Revenue ₨140,000 − COGS ₨120,625 − Expenses ₨0 = **Net ₨19,375** (income-statement/accrual view — the bill was raised, even if not yet collected). The dashboard deliberately shows the realized net instead, so the two pages answer different questions.

**Reports:** Money in ₨140,000 · Stock purchased ₨480,000 · Profit left ₨19,375 · Stock worth ₨361,875 · receivable ₨140,000 / payable ₨480,000.

**Printable invoice:** `/invoices/s1` serves 200 and prints INV-001 = ₨140,000 with the recorded date and time.

---

## 4. How the flows were proven (checks on `/audit`)

The hidden QA page (`http://localhost:3000/audit`, not in the sidebar) recomputes every figure from the raw ledger and compares it to what the app shows. All 41 checks passed, including:

- Stock identity: purchased 2,000 − sold 500 = stock 1,500.
- Simulated scenario on 3 Sutar (stock 1,500 kg):
  - **Buy 100** → stock 1,600 kg, stock worth +₨24,125.
  - **Sell 25 @ ₨280** → stock 1,475 kg, revenue +₨7,000.
- Invoice grand ₨140,000 = paid + due; customer balance = invoice due = dashboard = Credit/Debit.
- Mill due ₨480,000 = billed − paid; supplier balance = dashboard.
- Revenue / COGS / net identities; all invoice numbers unique.

---

## 5. Bugs found & fixed (kept from the earlier audit)

1. **Supplier payments now reach the Payments page** — paying a mill in Purchases → Payment Dues also journals a supplier payment, and mill dues are derived only from `purchase.paid` (no double-count).
2. **Invoice numbers can no longer repeat** — new invoices number one past the highest existing `INV-xxx`.

These fixes remain in the store code; with no payments recorded yet in this minimal demo the relevant audit checks trivially pass (₨0 = ₨0) and will stay green as you record real payments through the app.

---

## 6. How to reproduce

```bash
npm run build        # clean build (TypeScript checked)
npm run dev          # or next start
# open http://localhost:3000/audit  → "AUDIT SUMMARY: ALL CHECKS PASSED"
```

Every figure can be hand-checked from `src/lib/seed.ts` — one purchase, one sale, nothing else.
