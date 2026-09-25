export interface IsoRange {
  from: string | null;
  to: string | null;
}

export function normalizeIsoRange(range: IsoRange): IsoRange {
  let { from, to } = range;
  if (from && !to) to = from;
  if (to && !from) from = to;
  return { from, to };
}

/** Normalize any record date to `yyyy-MM-dd` for comparisons. */
export function isoDay(date: string): string {
  if (!date) return "";
  return date.length >= 10 ? date.slice(0, 10) : date;
}

/** True when `date` falls inside the range (inclusive). Empty range → no filter. */
export function dateInIsoRange(date: string, range: IsoRange): boolean {
  if (!range.from && !range.to) return true;
  const day = isoDay(date);
  if (!day) return false;
  const { from, to } = normalizeIsoRange(range);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function todayIsoDay(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Last calendar day included in the active dashboard filter (for stock “as of”). */
export function dashboardPeriodEnd(
  period: "today" | "monthly" | "yearly",
  rangeActive: boolean,
  range: IsoRange,
): string {
  if (rangeActive) {
    const { to, from } = normalizeIsoRange(range);
    return to ?? from ?? todayIsoDay();
  }
  return todayIsoDay();
}

export function dateOnOrBefore(date: string, endIso: string): boolean {
  const day = isoDay(date);
  const end = isoDay(endIso);
  if (!day || !end) return false;
  return day <= end;
}
