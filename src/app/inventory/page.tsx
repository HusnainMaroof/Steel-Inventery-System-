"use client";

import { useStore } from "@/lib/store";
import { Page, PageTitle, Stagger, StaggerItem, StatCard } from "@/components/ui";
import { fmtMoney, fmtQty } from "@/lib/format";

export default function InventoryPage() {
  const { inventory } = useStore();
  const totalStock = inventory.reduce((a, r) => a + r.stockQty, 0);
  const totalValue = inventory.reduce((a, r) => a + r.stockValue, 0);

  return (
    <Page>
      <PageTitle
        title="Inventory"
        sub="Stock per item at weighted-average landed cost"
      />
      <Stagger className="grid grid-cols-3 gap-4 mb-8">
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
              <th>Item</th>
              <th className="num">Purchased</th>
              <th className="num">Sold</th>
              <th className="num">In stock</th>
              <th className="num">Landed cost /t</th>
              <th className="num">Avg sell /t</th>
              <th className="num">Stock value</th>
              <th className="num">Status</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((r) => (
              <tr key={r.item}>
                <td className="font-medium">{r.item}</td>
                <td className="num">{fmtQty(r.purchasedQty)}</td>
                <td className="num">{fmtQty(r.soldQty)}</td>
                <td className="num font-medium">{fmtQty(r.stockQty)}</td>
                <td className="num">{fmtMoney(r.landedAvg)}</td>
                <td className="num text-neutral-500">{fmtMoney(r.avgSellRate)}</td>
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
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 mt-3">
        Landed cost = (mill price + transport + other costs) ÷ quantity, averaged across all purchases of the item.
      </p>
    </Page>
  );
}
