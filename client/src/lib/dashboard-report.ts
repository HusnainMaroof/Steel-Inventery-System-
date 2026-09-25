import type { ReportFetchParams } from "./server-report";
import { normalizeIsoRange, todayIsoDay, type IsoRange } from "./date-range-filter";

export type DashboardPeriod = "today" | "monthly" | "yearly";

/** Map dashboard date controls to the server profit report query. */
export function dashboardReportParams(
  period: DashboardPeriod,
  rangeActive: boolean,
  dateRange: IsoRange,
  productId: string,
): ReportFetchParams {
  const year = new Date().getFullYear();
  const scopedProduct = productId === "all" ? undefined : productId;

  if (rangeActive) {
    const { from, to } = normalizeIsoRange(dateRange);
    return {
      mode: "range",
      year,
      from: from ?? undefined,
      to: to ?? undefined,
      productId: scopedProduct,
    };
  }

  if (period === "today") {
    const day = todayIsoDay();
    return { mode: "range", year, from: day, to: day, productId: scopedProduct };
  }

  if (period === "yearly") {
    return { mode: "year", year, productId: scopedProduct };
  }

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
  ).padStart(2, "0")}`;
  return {
    mode: "range",
    year,
    from: monthStart,
    to: monthEnd,
    productId: scopedProduct,
  };
}

export function dashboardReportCacheKey(
  params: ReportFetchParams,
  dataVersion: number,
): string {
  return `dashboard:${dataVersion}:${params.mode}:${params.year}:${params.month ?? ""}:${params.from ?? ""}:${params.to ?? ""}:${params.productId ?? ""}`;
}
