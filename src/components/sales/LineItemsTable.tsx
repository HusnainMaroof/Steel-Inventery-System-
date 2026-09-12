"use client";

import { fmtMoney, fmtRateWithUnit } from "@/lib/format";
import type { SaleDraftApi, SaleDraftLine } from "./useSaleDraft";

const numVal = (n: number) => (n === 0 ? "" : String(n));

export default function LineItemsTable({
  api,
}: {
  api: SaleDraftApi;
}) {
  const { lines } = api;
  if (lines.length === 0) {
    return (
      <div className="border border-dashed border-neutral-200 rounded-lg p-10 text-center bg-neutral-50/30">
        <p className="text-[14px] text-neutral-500 font-medium">No items yet</p>
        <p className="text-[13px] text-neutral-400 mt-1">Pick stock above and press Add item.</p>
      </div>
    );
  }

  const sourceLabel = (l: SaleDraftLine) => {
    if (l.purchaseId) {
      const lot = api.lotsOf(l.variantId).find((x) => x.purchaseId === l.purchaseId);
      if (lot) return lot.label;
    }
    const v = api.varById.get(l.variantId);
    const cat = v ? api.catById.get(v.categoryId) : undefined;
    return `${api.catById.get(l.categoryId ?? "")?.name ?? cat?.name ?? ""}`;
  };

  return (
    <div className="border border-neutral-200 rounded-lg overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Attributes / Source</th>
            <th>Quality Name</th>
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const over = api.lineOver(l);
            const rate = Number(l.rate) || 0;
            const qty = Number(l.qty) || 0;
            const attrText = l.snapshot
              ? api.attrTextOf(l.variantId, l.snapshot)
              : "";
            return (
              <tr key={i}>
                <td className="font-medium whitespace-nowrap">{l.item}</td>
                <td className="text-neutral-500 text-xs whitespace-nowrap">
                  {attrText ? `${attrText} · ` : ""}
                  {sourceLabel(l)}
                </td>
                <td>
                  <input
                    className="!w-36"
                    placeholder="e.g. 60 Grade"
                    title="Quality name printed on the invoice"
                    value={l.qualityName ?? ""}
                    onChange={(e) => api.setLine(i, { qualityName: e.target.value })}
                  />
                </td>
                <td className="num">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <input
                      type="number" min="0" step="any"
                      className={`!w-24 text-right ${over ? "!border-red-600" : ""}`}
                      value={numVal(l.qty)}
                      onChange={(e) => api.setLine(i, { qty: Number(e.target.value) })}
                      required
                    />
                  </div>
                  {over && <span className="block text-[10px] text-red-600 font-normal">Over stock!</span>}
                </td>
                <td className="num tabular-nums text-neutral-600">
                  {rate > 0 ? fmtRateWithUnit(rate, l.unit) : "—"}
                </td>
                <td className="num tabular-nums font-medium">{fmtMoney(qty * rate)}</td>
                <td className="num">
                  <button
                    type="button"
                    onClick={() => api.removeLine(i)}
                    className="text-neutral-400 hover:text-red-600 text-sm"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
