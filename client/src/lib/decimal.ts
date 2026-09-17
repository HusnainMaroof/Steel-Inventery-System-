/** Parse API decimal strings (or legacy numbers) without float drift for display math. */
export function parseDecimal(value: number | string | null | undefined): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
