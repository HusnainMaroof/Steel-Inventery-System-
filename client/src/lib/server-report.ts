import { apiFetch } from "./api";
import { round2, round3, sumDecimal, toDecimal } from "./decimal";
import {
  buildProfitReport,
  type ProfitReport,
  type ProfitReportInput,
  type ReportMode,
} from "./profitReport";

export type ApiProfitReport = {
  period: string;
  productScope: string;
  profit: {
    salesRevenue: number;
    stockCost: number;
    profitOnSales: number;
    totalExpenses: number;
    /** product view: this product's share of shop-wide expenses */
    sharedExpenses?: number;
    netProfit: number;
    profitPct: number;
  };
  stock: Array<{
    productId: string;
    productName: string;
    unit: string;
    openingQty: number;
    remainingQty: number;
  }>;
  dues: { customerDue: number; supplierDue: number };
  cash: {
    cashReceived: number;
    cashPaid: number;
    expenses: number;
    cashInHand: number;
  };
  remainingValuation: number;
  businessValue: number;
  salesGrandTotals?: number[];
};

export type ReportFetchParams = {
  mode: ReportMode;
  year: number;
  month?: number;
  from?: string;
  to?: string;
  productId?: string;
};

function serverModeOf(mode: ReportMode, from?: string, to?: string): {
  mode: "month" | "year" | "range";
  from?: string;
  to?: string;
  month?: number;
} {
  if (mode === "range" || from || to) {
    return {
      mode: "range",
      from: from || "2000-01-01",
      to: to || new Date().toISOString().slice(0, 10),
    };
  }
  if (mode === "all") {
    return {
      mode: "range",
      from: "2000-01-01",
      to: new Date().toISOString().slice(0, 10),
    };
  }
  if (mode === "year") {
    return { mode: "year" };
  }
  return { mode: "month", month: new Date().getMonth() + 1 };
}

/** Build the canonical query string + API URL for a report request. */
function buildReportQuery(params: ReportFetchParams): { key: string; url: string } {
  const mapped = serverModeOf(params.mode, params.from, params.to);
  const query = new URLSearchParams();
  query.set("mode", mapped.mode);
  query.set("year", String(params.year));
  if (mapped.month) query.set("month", String(mapped.month));
  if (mapped.from) query.set("from", mapped.from);
  if (mapped.to) query.set("to", mapped.to);
  if (params.productId) query.set("productId", params.productId);
  const key = query.toString();
  return { key, url: `/reports/profit?${key}` };
}

/** In-flight dedupe: identical concurrent report requests share one promise
 * (React Strict Mode remounts + the store's two dataVersion bumps used to
 * fire the same heavy report query up to four times at once). */
const inFlightReports = new Map<string, Promise<ApiProfitReport>>();

/** An early report older than this is not trusted for the first load. */
const EARLY_REPORT_MAX_AGE_MS = 15_000;

type EarlyReportSlot = {
  key: string;
  startedAt: number;
  request: Promise<ApiProfitReport | null>;
};
let earlyReport: EarlyReportSlot | null = null;

/**
 * On a full page load of a tenant dashboard, the default profit report
 * starts right away, in parallel with /api/auth/me and the bootstrap,
 * instead of after the store becomes ready. Both requests carry the same
 * session cookie. The dashboard adopts the response once; any failure or
 * key mismatch falls back to a normal fetch.
 */
export function startEarlyProfitReport(params: ReportFetchParams): void {
  if (typeof window === "undefined" || earlyReport) return;
  const { key, url } = buildReportQuery(params);
  earlyReport = {
    key,
    startedAt: Date.now(),
    request: apiFetch<ApiProfitReport>(url).catch(() => null),
  };
}

export function fetchServerProfitReport(
  params: ReportFetchParams,
): Promise<ApiProfitReport> {
  const { key, url } = buildReportQuery(params);
  const existing = inFlightReports.get(key);
  if (existing) return existing;
  // The adopted early request is registered as in flight too, so a Strict Mode
  // remount shares it instead of firing a second report.
  const early = takeEarlyProfitReport(key);
  const request = (
    early
      ? early.then((result) => result ?? apiFetch<ApiProfitReport>(url))
      : apiFetch<ApiProfitReport>(url)
  ).finally(() => {
    inFlightReports.delete(key);
  });
  inFlightReports.set(key, request);
  return request;
}

/** Hands out the early report at most once, and only for the same query. */
function takeEarlyProfitReport(key: string): Promise<ApiProfitReport | null> | null {
  const early = earlyReport;
  earlyReport = null;
  if (!early || early.key !== key || Date.now() - early.startedAt > EARLY_REPORT_MAX_AGE_MS) {
    return null;
  }
  return early.request;
}

/**
 * Server is the source of truth for P&L, stock totals, cash, and dues.
 * Client-only enrichments (aging, expense rows, stock checks) still come
 * from the in-memory ledger via buildProfitReport.
 */
export function mergeServerReport(
  api: ApiProfitReport,
  input: ProfitReportInput,
): ProfitReport {
  const local = buildProfitReport(input);

  const stockByProduct = new Map(api.stock.map((row) => [row.productId, row]));
  const stock = local.stock.map((row) => {
    const server = stockByProduct.get(row.productId);
    if (!server) return row;
    const soldQty = Math.max(0, round3(toDecimal(row.totalQty).minus(server.remainingQty)));
    return {
      ...row,
      openingQty: server.openingQty,
      remainingQty: server.remainingQty,
      soldQty,
      totalQty: round3(toDecimal(server.openingQty).plus(row.purchaseQty)),
    };
  });

  return {
    ...local,
    periodLabel: api.period,
    stock,
    openingValue: round2(sumDecimal(stock.map((r) => r.openingValue))),
    remainingValue: api.remainingValuation,
    totalStockValue: round2(
      sumDecimal(stock.map((r) => toDecimal(r.openingValue).plus(r.purchaseValue))),
    ),
    salesRevenue: api.profit.salesRevenue,
    stockCost: api.profit.stockCost,
    profitOnSales: api.profit.profitOnSales,
    expenses: api.profit.totalExpenses,
    netProfit: api.profit.netProfit,
    profitPct: api.profit.profitPct,
    cashReceived: api.cash.cashReceived,
    cashPaid: api.cash.cashPaid,
    cashExpenses: api.cash.expenses,
    cashInHand: api.cash.cashInHand,
    customerDue: api.dues.customerDue,
    supplierDue: api.dues.supplierDue,
    businessValue: api.businessValue,
  };
}
