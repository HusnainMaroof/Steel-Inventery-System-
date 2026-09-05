"use client";

import { use } from "react";
import { motion } from "framer-motion";
import { useStore, purchaseTotal } from "@/lib/store";
import { Page, PageTitle } from "@/components/ui";
import { fmtMoney, fmtQty, fmtDate } from "@/lib/format";

export default function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { purchases, suppliers, inventory } = useStore();

  const purchase = purchases.find((p) => p.id === id);
  const supplier = suppliers.find((s) => s.id === purchase?.supplierId);
  const inv = inventory.find((r) => r.item === purchase?.item);

  if (!purchase) {
    return (
      <Page>
        <PageTitle title="Purchase" sub="Purchase details" />
        <p className="text-neutral-500">Purchase not found.</p>
      </Page>
    );
  }

  const total = purchaseTotal(purchase);
  const costPerTon = purchase.qty > 0 ? total / purchase.qty : 0;
  const sellPerTon = inv?.avgSellRate ?? 0;
  const profitPerTon = sellPerTon - costPerTon;

  const rows: { label: string; value: string; strong?: boolean; muted?: boolean }[] = [
    { label: "Purchase Date", value: fmtDate(purchase.date) },
    { label: "Supplier", value: supplier?.name ?? purchase.supplierId },
    { label: "Steel Type", value: purchase.item },
    { label: "Quantity", value: `${fmtQty(purchase.qty)} tons` },
    { label: "Buying Price / Ton", value: fmtMoney(purchase.rate) },
    { label: "Transport Cost", value: fmtMoney(purchase.transport) },
    { label: "Other Expenses", value: fmtMoney(purchase.otherCost) },
    { label: "Total Purchase Cost", value: fmtMoney(total), strong: true },
    { label: "Actual Cost / Ton", value: fmtMoney(costPerTon) },
    ...(purchase.sellRate
      ? [{ label: "Your Selling Price / Ton", value: fmtMoney(purchase.sellRate) }]
      : []),
    { label: "Average Selling Price / Ton", value: fmtMoney(sellPerTon) },
    { label: "Profit / Ton", value: fmtMoney(profitPerTon), strong: true },
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
        Average selling price is based on what this item has sold for so far. Profit / ton = selling price − total cost per ton.
      </p>
    </Page>
  );
}
