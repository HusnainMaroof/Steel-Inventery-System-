# Multi-User Simulation Report

Run: `SIM-20261017173040`, 2026-10-17 17:30 UTC, 10 minutes. This replaces the earlier latency reports.

## 1. Setup

| Item | Value |
| --- | --- |
| Database | `tijaratt_test`, Neon **test** project (`ep-royal-voice-...`, us-east-2). Production `tijaratt_main` was not touched |
| API | NestJS `npm run start:dev` (loads `server/.env.e2e`), port 4100 |
| Frontend / BFF | Next.js production build (`next build` + `next start`), port 3000 |
| Path of every request | Script → `http://localhost:3000/api/tijaratt/*` (BFF) with the `session` cookie → Nest → Neon. Writes carry the `Origin` header, like a browser |
| Where it ran | Developer PC. One database round trip from here to Neon us-east-2 is about **255 ms** |
| Login | Token from `POST /api/v1/auth/login`, used as the `session` cookie (the browser gets it through a Server Action) |
| Script | `.e2e-tmp/multi-user-sim.mjs` (gitignored). Raw result: `.e2e-tmp/sim.out.json`, server log: `.e2e-tmp/sim-server.log` |

Users, all at the same time:

| User | Account | Business |
| --- | --- | --- |
| A-1 | E2E owner A, device 1 | `e2e-audit-biz-a-202610151550` |
| A-2 | E2E owner A, device 2 (same business, same customer and lots as A-1) | same |
| B | E2E owner B | `e2e-audit-biz-b-202610151550` (was empty; the run created 1 product, 1 supplier, 1 customer) |

Each user loops with 1.5 to 4 s think time between actions: dashboard load, sales list, save purchase,
save sale (from a purchase lot, 40% with paid-now), receive payment (targeted or FIFO), delete sale, and bad use.
At minute 5 all three users stop for 70 s, then load the dashboard again. Write volume was capped at
15 purchases, 30 sales, 15 payments and 5 deletes.

## 2. Result in one table

| What the user does | n | Median | p95 | Max | Failed |
| --- | --- | --- | --- | --- | --- |
| Dashboard load (me + bootstrap, then transactions + report) | 81 | **2.30 s** | 4.10 s | 5.63 s | 0 |
| Sales list page | 36 | 0.52 s | 1.01 s | 1.49 s | 0 |
| Save sale | 22 | **1.53 s** | 2.05 s | 2.37 s | 0 |
| Save sale with paid-now | 6 | 1.28 s | 2.08 s | 2.08 s | 0 |
| Save purchase (includes the ledger reload the UI waits for) | 12 | 2.30 s | 3.08 s | 3.08 s | 0 |
| Save purchase, paid | 3 | 2.53 s | 4.26 s | 4.26 s | 0 |
| Receive payment, targeted (includes the reload) | 10 | 2.80 s | 4.02 s | 4.02 s | 0 |
| Receive payment, FIFO (includes the reload) | 5 | 2.83 s | 3.28 s | 3.28 s | 0 |
| Delete sale | 5 | 2.29 s | 2.29 s | 2.29 s | 0 |
| **First dashboard after the 70 s idle gap** | 4 | 3.5 to 5.6 s | | | 0 |

1058 requests in total. No 5xx and no 429 at any minute. All 180 user actions succeeded.

## 3. Per request (through the BFF, and the API's own time)

| Request | n | Median (BFF) | p95 (BFF) | Median (Nest log) | Note |
| --- | --- | --- | --- | --- | --- |
| `GET /auth/me` | 81 | 287 ms | 1734 ms | 256 ms | 1 round trip when the token cache is warm |
| `GET /ledger/bootstrap` | 84 | 512 ms | 1322 ms | 504 ms | Catalogue from cache, live counts |
| `GET /ledger/transactions` | 150 | 1022 ms | 2026 ms | 1011 ms | Full bulk load, every time |
| `GET /reports/profit` | 81 | **1769 ms** | 2562 ms | 1763 ms | Slowest read; was 1.0 to 1.3 s with one user |
| `GET /sales?page=1` | 36 | 515 ms | 1008 ms | 999 ms (incl. bursts) | |
| `POST /sales` | 28 | 1294 ms | 2083 ms | 1273 ms | 5 round trips |
| `POST /payments` | 15 | 1787 ms | 2247 ms | 1520 ms | 5 round trips; A-1 and A-2 share one customer lock |
| `POST /purchases` | 15 | 1515 ms | 2498 ms | 1506 ms | 4 round trips |
| `DELETE /sales/:id` | 5 | 2288 ms | 2293 ms | 2227 ms | 6 round trips |

The BFF adds only a few milliseconds: its times match the Nest log within about 10 to 30 ms.
Almost all time is database round trips.

## 4. Bad use

| Attempt | Tries | Expected | Got | OK |
| --- | --- | --- | --- | --- |
| Request without a session | 8 | 401 | 401 | Yes |
| Malformed id in the URL | 7 | 400 | 400 "Invalid id" | Yes |
| Negative quantity | 8 | 400 | 400 "qty must not be less than 0.001" | Yes |
| Sale with no lines | 7 | 400 | 400 "A sale needs at least one line" | Yes |
| Write from another origin (CSRF) | 7 | 403 | 403 "Cross-origin request blocked" | Yes |
| Sell more than the lot has | 7 | 400 | 400 "Insufficient inventory in source purchase lot" | Yes |
| Pay more than the invoice due | 10 | 400 | 400 "Payment (99999.00) exceeds the remaining due (...)" | Yes |
| Read another business's sale | 11 | 404 | 404 "Sale not found" | Yes |
| Delete another business's sale | 4 | 404 | 404 "Sale not found" | Yes |
| Pay into another business's customer | 7 | 400 | 400 "Customer not found" | Yes |
| Burst of 40 parallel reads from one user | 12 | no 429 | no 429 | Yes |
| **Double click on "Save sale"** (two identical POSTs at once) | 1 | 1 sale | **2 sales created** | **No** |

Bad requests that fail in validation answer in about 5 ms. Bad requests that need the database
(oversell, overpay, cross-tenant) take 1 to 1.8 s, because the checks run after the locks and the read.

## 5. Data integrity after the run

| Check | A | B |
| --- | --- | --- |
| No product with negative stock | Pass | Pass |
| Invoice numbers unique | Pass (29) | Pass (13) |
| Invoice `paid` never above `total` | Pass | Pass |
| No purchase lot sold beyond what was bought | Pass | Pass |
| Payment allocations add up to the payment amount | Pass | Pass |
| No other business's sales in its ledger | Pass | Pass |

Note: A's product used in the run has rows in more than one unit, so `/inventory/stock` returns `qty: null`
for it and the negative-stock check cannot judge it. The lot check above covers the same stock.

## 6. Findings

| # | Finding | Evidence | Severity |
| --- | --- | --- | --- |
| S1 | **Double click creates two sales.** `POST /sales` has no idempotency key, and the client guard (`savingSaleRef`) only protects one tab | Section 4 | High (real duplicate invoices and stock) |
| S2 | **Dashboard is 2.3 s median, 4.1 s p95 with three users.** The report call is the longest leg and got slower under load (1.0 to 1.3 s alone, 1.77 s here) | Sections 2, 3 | Medium |
| S3 | **First load after 70 s idle: 3.5 to 5.6 s**, against 2.3 s median | Section 2 | Medium |
| S4 | **Payment and purchase saves wait for the full ledger reload** (about 1 s extra each, and it grows with data) | Sections 2, 3 | Medium |
| S5 | `/ledger/transactions` was called 150 times in 10 minutes, about 1 s each, always the full set | Section 3 | Medium, grows with tenant size |
| S6 | No rate-limit hit. Peak was 192 requests per minute in total, under the shared 240 reads per minute. The limiter key is the BFF's IP, so all users share one budget; about 25% more traffic would start returning 429 | Per-minute counts in `.e2e-tmp/sim.out.json` | Low now, rises with users |
| S7 | Tenant isolation and validation held in every attempt | Sections 4, 5 | Good |

## 7. What these numbers mean

- From this PC every round trip costs about 255 ms, and every number above is a multiple of it.
  On a server close to the database (same region as Neon us-east-2) a round trip is about 1 to 2 ms,
  so the same work would take a small fraction of these times. **The production VPS location and its
  round-trip time to Neon have not been measured.** That number decides whether the remaining latency
  is a code problem or a placement problem.
- A read-only way to get it on the VPS: run `SELECT 1` ten times inside the backend container and print the times.
  Do not run the write scripts there; they create data.
- Issues S1, S4 and S5 do not depend on geography. S1 creates bad data at any latency.

## 8. Changes in the code under test (not committed)

| Area | Change |
| --- | --- |
| Client read path | Dashboard, staff and settings do not wait for transactions; bootstrap runs in parallel with `/auth/me`; login no longer calls `/auth/me` again |
| Client sale save and delete | Merge or remove the sale locally, then reload in the background |
| Server writes | Sale create (5 round trips), payment create (5), purchase create (4), sale delete (6), advisory locks in one statement |
| Known trade-off | Database errors inside the raw SQL writes reach the client as Prisma `P2010` → 400 "The request could not be completed", instead of specific codes |

Verification: server unit tests 132/132, client tests 69/69, DB-backed e2e suites 60/60 on Neon scratch databases.

## 9. Test data left in `tijaratt_test`

Nothing was deleted except the 5 sales the simulation deleted on purpose.

| Rows | Count | Tag |
| --- | --- | --- |
| Purchases | 15 (3 of them half paid) | notes `SIM-20261017173040-<user>` |
| Sales | 30 created (including the 2 from the double click), 5 deleted | notes `SIM-20261017173040-<user>` |
| Customer payments | 15, plus paid-now receipts | note `SIM-20261017173040-<user>` |
| Owner B setup | 1 product, 1 supplier, 1 customer | names contain `SIM-20261017173040` |

Row ids are in `.e2e-tmp/sim.out.json` (`created`).
