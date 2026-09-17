# Number reconciliation audit

`/audit` evaluates the authenticated business's API-backed ledger. It does not
depend on fixed fixture values, so it is valid for an empty new business and
for live trading data.

The audit verifies:

- purchased quantity minus sold quantity equals inventory;
- variant inventory equals the sum of its remaining source lots;
- each purchase and sale line has the matching signed stock movement;
- stock value equals remaining quantity times landed cost;
- invoice grand total equals subtotal, discount, tax, and charges;
- customer billing equals receipts plus outstanding balances;
- mill dues equal goods purchased minus amounts paid;
- payment references resolve to existing parties and invoices;
- dashboard totals equal sums recomputed directly from raw records;
- FIFO line costs, report stock flow, profit, cash, and dues reconcile;
- catalogue, variant, warehouse, and stock-check references remain valid.

Run the application, sign in as a business owner, and open `/audit`. An empty
ledger should pass with zero totals. After recording a purchase, sale, payment,
and expense, refresh the page before rerunning the audit; this verifies both
the arithmetic and persistence path.
