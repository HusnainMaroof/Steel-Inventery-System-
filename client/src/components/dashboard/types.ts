/**
 * View models for the owner dashboard. Pages build these from the store and the
 * server profit report (see lib/dashboard-view.ts); components only render them.
 */

/** Change against the previous period of the same length. Omitted when not computable. */
export type Delta = {
  /** Percent change, e.g. 5 for +5 %, -5 for -5 %. */
  percent: number;
  /** Text after the badge, e.g. "vs last month". */
  label: string;
};

export type StatCardData = {
  id: string;
  label: string;
  /** Money in rupees, or a plain count when `kind` is "count". */
  value: number;
  kind?: "money" | "count";
  /** Unit after a count, e.g. "products". */
  suffix?: string;
  delta?: Delta;
  /** The one highlighted card: primary background, primary-foreground text. */
  highlight?: boolean;
  /** Optional colour of the value: "in" = money owed to us, "out" = money we owe. */
  tone?: "in" | "out";
  /** Where the small round icon button in the corner links to. */
  href?: string;
};

export type MonthlyPoint = {
  /** First day of the month, ISO yyyy-mm-dd. */
  month: string;
  /** Sales invoice totals in the month (rupees). */
  sales: number;
  /** Purchase goods value (qty x rate) in the month (rupees). */
  purchases: number;
};

export type ActivityStatus = "paid" | "partly-paid" | "unpaid";

export type ActivityRow = {
  id: string;
  /** Invoice number, e.g. INV-0012. */
  reference: string;
  /** Customer name. */
  title: string;
  /** Short line under the title, e.g. "3 items". */
  subtitle?: string;
  /** Invoice total (rupees). */
  amount: number;
  status: ActivityStatus;
  /** ISO datetime (createdAt) or ISO date. */
  date: string;
  /** Link to the sale detail. */
  href: string;
};

export type CollectionProgress = {
  /** Received against sales invoices in the period (rupees). */
  collected: number;
  /** Total of sales invoices in the period (rupees). */
  billed: number;
};
