"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Page, PageTitle, Stagger, StaggerItem, StatCard, EmptyState } from "@/components/ui";
import { fmtMoney, fmtQtyWithUnit, fmtRateWithUnit } from "@/lib/format";

export default function InventoryPage() {
  const { inventory, inventoryBySource, suppliers } = useStore();
  const [source, setSource] = useState<string>("all");

  // when a source is chosen show per-source rows, else the all-source aggregate
  const rows =
    source === "all" ? inventory : inventoryBySource.filter((r) => r.supplierId === source);
  const supplierName = (id?: string) =>
    (id && suppliers.find((s) => s.id === id)?.name) || "—";

  const totalValue = rows.reduce((a, r) => a + r.stockValue, 0);

  return (
    <Page>
      <PageTitle
        title="Inventory"
        sub="Stock per product item at weighted-average actual cost"
        action={
          <select
            className="w-auto"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">All sources / mills</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        }
      />
      <Stagger className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StaggerItem>
          <StatCard label="Items in stock" value={rows.filter((r) => r.stockQty > 0).length} money={false} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Stock value" value={totalValue} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Rows tracked" value={rows.length} money={false} />
        </StaggerItem>
      </Stagger>

      {rows.length === 0 ? (
        <EmptyState
          emoji="🏷️"
          title={source === "all" ? "No stock yet" : "No stock from this source"}
          hint={
            source === "all"
              ? "Inventory builds itself as you record purchases and sales — nothing to count just yet."
              : "Pick another mill, or add a purchase from this source."
          }
          action={
            <Link href="/purchases" className="btn-primary">
              + Add Purchase
            </Link>
          }
        />
      ) : (
      <>
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Product Item</th>
              <th>Source / Mill</th>
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
            {rows.map((r, i) => {
              const unit = r.unit ?? "";
              return (
                <tr key={`${r.item}-${r.supplierId ?? "all"}-${i}`}>
                  <td className="text-neutral-500">{r.product || "—"}</td>
                  <td className="font-medium">{r.item}</td>
                  <td className="text-neutral-500">{r.supplierId ? supplierName(r.supplierId) : "All"}</td>
                  <td className="text-neutral-500">{r.quality || "—"}</td>
                  <td className="num">{fmtQtyWithUnit(r.purchasedQty, unit)}</td>
                  <td className="num">{fmtQtyWithUnit(r.soldQty, unit)}</td>
                  <td className="num font-medium">{fmtQtyWithUnit(r.stockQty, unit)}</td>
                  <td className="num">{fmtRateWithUnit(r.landedAvg, unit)}</td>
                  <td className="num text-neutral-500">
                    {(r.sellRate ?? r.avgSellRate) > 0
                      ? fmtRateWithUnit(r.sellRate ?? r.avgSellRate, unit)
                      : "—"}
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
        Actual Cost = product + transport + other expenses, shown in each product&apos;s own unit (kg, bag, …). Use the source filter to see stock from one mill at a time.
      </p>
      </>
      )}
    </Page>
  );
}
