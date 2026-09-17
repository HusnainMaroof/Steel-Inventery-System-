import { apiFetch } from "./api";
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

export async function fetchServerProfitReport(
  params: ReportFetchParams,
): Promise<ApiProfitReport> {
  const mapped = serverModeOf(params.mode, params.from, params.to);
  const query = new URLSearchParams();
  query.set("mode", mapped.mode);
  query.set("year", String(params.year));
  if (mapped.month) query.set("month", String(mapped.month));
  if (mapped.from) query.set("from", mapped.from);
  if (mapped.to) query.set("to", mapped.to);
  if (params.productId) query.set("productId", params.productId);
  return apiFetch<ApiProfitReport>(`/reports/profit?${query.toString()}`);
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
    const soldQty = Math.max(0, row.totalQty - server.remainingQty);
    return {
      ...row,
      openingQty: server.openingQty,
      remainingQty: server.remainingQty,
      soldQty,
      totalQty: server.openingQty + row.purchaseQty,
    };
  });

  return {
    ...local,
    periodLabel: api.period,
    stock,
    openingValue: stock.reduce((a, r) => a + r.openingValue, 0),
    remainingValue: api.remainingValuation,
    totalStockValue: stock.reduce((a, r) => a + r.openingValue + r.purchaseValue, 0),
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
