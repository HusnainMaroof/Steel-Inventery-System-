export const fmtMoney = (n: number) =>
  "₨ " + Math.round(n).toLocaleString("en-US");

export const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return "₨ " + (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return "₨ " + (n / 1_000).toFixed(1) + "K";
  return fmtMoney(n);
};

// plural quantity label — "kg" stays, count nouns pluralize ("bag" → "bags")
export const qtyUnitLabel = (u?: string) =>
  u === "bag" || u === "sack" || u === "box" || u === "roll" || u === "dozen"
    ? `${u}s`
    : u ?? "";

// quantities are stored and shown directly in the product's own unit (kg, bag, …)
export const fmtQtyWithUnit = (qty: number, unit?: string) => {
  const n = (Math.round(qty * 100) / 100).toLocaleString("en-US");
  return unit ? `${n} ${qtyUnitLabel(unit)}` : n;
};

// rate is stored per product unit; shown per that unit when known
export const fmtRateWithUnit = (rate: number, unit?: string) => {
  const money = fmtMoney(rate);
  return unit ? `${money} / ${unit}` : money;
};

// "per unit" label — always singular ("/ bag", "/ kg")
export const perUnitLabel = (u?: string) => (u ? ` / ${u}` : "");

export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
// for full ISO timestamps — shows date and clock time
export const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
};

export const monthKey = (iso: string) => iso.slice(0, 7);

export const monthLabel = (key: string) =>
  new Date(key + "-01T00:00:00").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
