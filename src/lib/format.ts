export const fmtMoney = (n: number) =>
  "₨ " + Math.round(n).toLocaleString("en-US");

export const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return "₨ " + (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return "₨ " + (n / 1_000).toFixed(1) + "K";
  return fmtMoney(n);
};

export const fmtQty = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString("en-US") + " t";

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
