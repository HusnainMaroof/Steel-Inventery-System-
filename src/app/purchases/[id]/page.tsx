"use client";

import { use } from "react";
import { motion } from "framer-motion";
import { useStore, purchaseTotal, steelAmount } from "@/lib/store";
import { Page, PageTitle } from "@/components/ui";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit, fmtDate, perUnitLabel } from "@/lib/format";

export default function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { purchases, suppliers, inventory, categories, attributeDefs, warehouses, locations } = useStore();

  const purchase = purchases.find((p) => p.id === id);
  const supplier = suppliers.find((s) => s.id === purchase?.supplierId);
  const inv = inventory.find((r) => r.item === purchase?.item);
  const defs = (purchase?.categoryId ? attributeDefs.filter((d) => d.categoryId === purchase!.categoryId && d.active).sort((a, b) => a.sortOrder - b.sortOrder) : []);
  const catName = categories.find((c) => c.id === purchase?.categoryId)?.name;
  const whName = warehouses.find((w) => w.id === purchase?.warehouseId)?.name;
  const locName = locations.find((l) => l.id === purchase?.locationId)?.name;

  if (!purchase) {
    return (
      <Page>
        <PageTitle title="Purchase" sub="Purchase details" />
        <p className="text-neutral-500">Purchase not found.</p>
      </Page>
    );
  }

  const total = purchaseTotal(purchase);
  const costPerUnit = purchase.qty > 0 ? total / purchase.qty : 0;
  const sellPerUnit = purchase.sellRate ?? inv?.avgSellRate ?? 0;
  const perUnit = perUnitLabel(purchase.unit);
  const profitPerUnit = sellPerUnit > 0 ? sellPerUnit - costPerUnit : 0;

  const payable = steelAmount(purchase);
  const paid = purchase.paid ?? 0;
  const remaining = Math.max(0, payable - paid);

  const rows: { label: string; value: string; strong?: boolean; muted?: boolean }[] = [
    { label: "Purchase Date", value: fmtDate(purchase.date) },
    { label: "Supplier", value: supplier?.name ?? purchase.supplierId },
    { label: "Product", value: purchase.product || "—" },
    ...(catName ? [{ label: "Category", value: catName }] : []),
    ...(purchase.attributeSnapshot
      ? defs.filter((d) => purchase.attributeSnapshot![d.key]).map((d) => ({ label: d.name, value: purchase.attributeSnapshot![d.key] }))
      : [
          ...(purchase.spec ? [{ label: "Spec", value: purchase.spec }] : []),
          { label: "Quality", value: purchase.quality || "—" },
        ]),
    ...(purchase.lotNumber || purchase.heatNumber || purchase.batchNumber
      ? [{ label: "Lot / Heat / Batch", value: [purchase.lotNumber, purchase.heatNumber, purchase.batchNumber].filter(Boolean).join(" / ") }]
      : []),
    ...(whName ? [{ label: "Warehouse", value: `${whName}${locName ? " / " + locName : ""}` }] : []),
    { label: "Quantity", value: fmtQtyWithUnit(purchase.qty, purchase.unit) },
    { label: "Buying Price", value: fmtRateWithUnit(purchase.rate, purchase.unit) },
    { label: "Transport Cost", value: fmtMoney(purchase.transport), muted: true },
    { label: "Other Expenses", value: fmtMoney(purchase.otherCost), muted: true },
    // ——— payment summary: what the mill gets ———
    { label: "Total Payable to Mill", value: fmtMoney(payable), strong: true },
    { label: "Already Paid", value: fmtMoney(paid), muted: true },
    { label: "Remaining Due", value: fmtMoney(remaining), strong: remaining > 0, muted: remaining === 0 },
    // ——— your costs & margins ———
    { label: "Actual Cost" + perUnit, value: fmtMoney(costPerUnit), muted: true },
    ...(purchase.sellRate
      ? [{ label: "Your Selling Price", value: fmtRateWithUnit(purchase.sellRate, purchase.unit) }]
      : []),
    { label: "Profit" + perUnit, value: fmtMoney(profitPerUnit), strong: true },
  ];

  return (
    <Page>
      <PageTitle title="Purchase Details" sub="Full details of this purchase, in simple words" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border border-neutral-200 max-w-xl"
      >
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex justify-between items-center gap-4 px-5 py-4 border-b border-neutral-200 last:border-b-0 ${
              r.strong ? "bg-black text-white" : ""
            }`}
          >
            <span
              className={`text-xs uppercase tracking-widest ${
                r.muted ? "text-neutral-400" : r.strong ? "" : "text-neutral-500"
              }`}
            >
              {r.label}
            </span>
            <span className={`tabular-nums text-right shrink-0 ${r.strong ? "font-medium" : "font-medium"}`}>
              {r.value}
            </span>
          </div>
        ))}
      </motion.div>

      <p className="text-xs text-neutral-500 mt-4 max-w-xl">
        Profit = Your Selling Price − Actual Cost, shown per unit of this product&apos;s unit of measure.
      </p>
    </Page>
  );
}
