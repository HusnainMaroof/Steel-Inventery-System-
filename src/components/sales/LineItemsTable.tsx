"use client";

import { fmtMoney, fmtRateWithUnit } from "@/lib/format";

interface LineForm {
  product: string;
  item: string;
  quality: string;
  supplierId: string;
  purchaseId?: string;
  qty: number;
  rate: number;
}

const numVal = (n: number) => (n === 0 ? "" : String(n));

export default function LineItemsTable({
  lines,
  setLine,
  removeLine,
  unitOf,
  supplierName,
  lineOver,
}: {
  lines: LineForm[];
  setLine: (i: number, patch: Partial<LineForm>) => void;
  removeLine: (i: number) => void;
  unitOf: (item: string) => string;
  supplierName: (id: string) => string;
  lineOver: (l: LineForm) => boolean;
}) {
  if (lines.length === 0) {
    return (
      <div className="border border-dashed border-neutral-300 p-8 text-center">
        <p className="text-sm text-neutral-400">Nothing added yet</p>
        <p className="text-xs text-neutral-400 mt-1">Pick a product above and press “+ Add Item”.</p>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Quality / Source</th>
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const unit = unitOf(l.item);
            const over = lineOver(l);
            const rate = Number(l.rate) || 0;
            const qty = Number(l.qty) || 0;
            return (
              <tr key={i}>
                <td className="font-medium whitespace-nowrap">{l.item}</td>
                <td className="text-neutral-500 text-xs whitespace-nowrap">
                  {l.quality ? `${l.quality} · ` : ""}{supplierName(l.supplierId)}
                </td>
                <td className="num">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <input
                      type="number" min="0" step="any"
                      className={`!w-24 text-right ${over ? "!border-red-600" : ""}`}
                      value={numVal(l.qty)}
                      onChange={(e) => setLine(i, { qty: Number(e.target.value) })}
                      required
                    />
                  </div>
                  {over && <span className="block text-[10px] text-red-600 font-normal">Over stock!</span>}
                </td>
                <td className="num tabular-nums text-neutral-600">
                  {rate > 0 ? fmtRateWithUnit(rate, unit) : "—"}
                </td>
                <td className="num tabular-nums font-medium">{fmtMoney(qty * rate)}</td>
                <td className="num">
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
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