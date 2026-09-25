export type PurchaseDraftLine = {
  key: string;
  productId: string;
  productName: string;
  categoryId?: string;
  variantId: string;
  item: string;
  attributeSnapshot: Record<string, string>;
  qty: number;
  unit: string;
  rate: number;
  sellRate?: number;
  loading: number;
  transport: number;
  labour: number;
  otherCost: number;
  paidToSupplier: number;
  lotNumber?: string;
  heatNumber?: string;
  batchNumber?: string;
  warehouseId?: string;
  locationId?: string;
};

export function lineGoods(qty: number, rate: number) {
  return qty * rate;
}

export function lineCharges(
  line: Pick<PurchaseDraftLine, "loading" | "transport" | "labour" | "otherCost">,
) {
  return line.loading + line.transport + line.labour + line.otherCost;
}

export function linePaidError(line: PurchaseDraftLine): string | undefined {
  const goods = lineGoods(line.qty, line.rate);
  if (line.paidToSupplier > goods + 0.001) {
    return `Paid to supplier cannot exceed goods (${goods.toFixed(0)} max for this line).`;
  }
  return undefined;
}

export function draftLineTotals(lines: PurchaseDraftLine[]) {
  const millGoodsTotal = lines.reduce((s, l) => s + lineGoods(l.qty, l.rate), 0);
  const totalCharges = lines.reduce((s, l) => s + lineCharges(l), 0);
  const totalPaidToSupplier = lines.reduce((s, l) => s + (l.paidToSupplier || 0), 0);
  const dueToSupplier = Math.max(0, millGoodsTotal - totalPaidToSupplier);
  const landedTotal = millGoodsTotal + totalCharges;
  return { millGoodsTotal, totalCharges, totalPaidToSupplier, dueToSupplier, landedTotal };
}
