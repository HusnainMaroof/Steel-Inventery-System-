"use client";

import { useStore } from "@/lib/store";
import { Page, PageTitle, Stagger, StaggerItem, StatCard } from "@/components/ui";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit } from "@/lib/format";

export default function InventoryPage() {
  const { inventory } = useStore();
  const totalStock = inventory.reduce((a, r) => a + r.stockQty, 0);
  const totalValue = inventory.reduce((a, r) => a + r.stockValue, 0);

  return (
    <Page>
      <PageTitle
        title="Inventory"
        sub="Stock per product item at weighted-average actual cost"
      />
      <Stagger className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StaggerItem>
          <StatCard label="Total stock" value={totalStock} money={false} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Stock value" value={totalValue} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Items tracked" value={inventory.length} money={false} />
        </StaggerItem>
      </Stagger>

      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Product Item</th>
              <th>Quality</th>
              <th className="num">Purchased</th>
              <th className="num">Sold</th>
              <th className="num">In stock</th>
              <th className="num">Actual Cost</th>
              <th className="num">Your Selling Price</th>
              <th className="num">Stock value</th>
              <th className="num">Status</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((r) => {
              const unit = r.unit ?? "ton";
              return (
                <tr key={r.item}>
                  <td className="text-neutral-500">{r.product || "—"}</td>
                  <td className="font-medium">{r.item}</td>
                  <td className="text-neutral-500">{r.quality || "—"}</td>
                  <td className="num">{fmtQtyWithUnit(r.purchasedQty, unit)}</td>
                  <td className="num">{fmtQtyWithUnit(r.soldQty, unit)}</td>
                  <td className="num font-medium">{fmtQtyWithUnit(r.stockQty, unit)}</td>
                  <td className="num">{fmtRateWithUnit(r.landedAvg, unit)}</td>
                  <td className="num text-neutral-500">
                    {r.avgSellRate > 0 ? fmtRateWithUnit(r.avgSellRate, unit) : "—"}
                  </td>
                  <td className="num">{fmtMoney(r.stockValue)}</td>
                  <td className="num">
                    {r.stockQty <= 5 ? (
                      <span className="text-xs border border-black px-2 py-0.5">
                        LOW
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400 px-2 py-0.5">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 mt-3">
        Actual Cost = product + transport + other expenses, per kg or per ton based on how the purchases were recorded. Your Selling Price is the average of your recorded selling prices.
      </p>
    </Page>
  );
}
