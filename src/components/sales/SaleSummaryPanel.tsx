"use client";

import { fmtMoney } from "@/lib/format";

const numVal = (n: number) => (n === 0 ? "" : String(n));

export default function SaleSummaryPanel({
  subtotal,
  discountPct,
  setDiscountPct,
  taxPct,
  setTaxPct,
  discAmt,
  taxAmt,
  grandTotal,
  paidNow,
  setPaidNow,
  remaining,
  payError,
  customerName,
  canSave,
}: {
  subtotal: number;
  discountPct: number;
  setDiscountPct: (n: number) => void;
  taxPct: number;
  setTaxPct: (n: number) => void;
  discAmt: number;
  taxAmt: number;
  grandTotal: number;
  paidNow: number;
  setPaidNow: (n: number) => void;
  remaining: number;
  payError?: string;
  customerName: string;
  canSave: boolean;
}) {
  return (
    <div className="border border-neutral-200 rounded-xl bg-white p-5 xl:sticky xl:top-6">
      <p className="text-xs uppercase tracking-widest text-neutral-500 mb-4">Summary</p>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-neutral-500">Subtotal</span>
          <span className="tabular-nums font-medium">{fmtMoney(subtotal)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="!mb-1">Discount (%)</label>
            <input
              type="number" min="0" max="100" step="any" placeholder="0"
              value={numVal(discountPct)}
              onChange={(e) => setDiscountPct(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="!mb-1">Tax (%)</label>
            <input
              type="number" min="0" max="100" step="any" placeholder="0"
              value={numVal(taxPct)}
              onChange={(e) => setTaxPct(Number(e.target.value))}
            />
          </div>
        </div>
        {discAmt > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-neutral-500">Discount</span>
            <span className="tabular-nums text-neutral-500">− {fmtMoney(discAmt)}</span>
          </div>
        )}
        {taxAmt > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-neutral-500">Tax</span>
            <span className="tabular-nums text-neutral-500">+ {fmtMoney(taxAmt)}</span>
          </div>
        )}
        <div className="flex justify-between items-center py-2.5 px-3 bg-black text-white -mx-3">
          <span className="text-xs uppercase tracking-widest text-neutral-400">Grand Total</span>
          <span className="tabular-nums font-semibold">{fmtMoney(grandTotal)}</span>
        </div>

        {/* Paid Now — the settle-now action, given distinct weight */}
        <div className="border-2 border-amber-400 bg-amber-50/60 -mx-1 px-3 py-3 rounded-lg">
          <label className="!mb-1 text-[11px] uppercase tracking-widest text-amber-700 font-medium">
            Paid Now
          </label>
          <input
            type="number" min="0" step="any" placeholder="0"
            className="!border-amber-300 !py-2.5 text-base"
            value={numVal(paidNow)}
            onChange={(e) => setPaidNow(Number(e.target.value))}
          />
          {payError && (
            <div className="mt-2 border border-red-200 bg-red-50 text-red-700 text-[11px] px-2.5 py-2">
              {payError}
            </div>
          )}
        </div>

        <div className={`flex justify-between items-center px-3 py-2.5 border border-dashed -mx-3 ${remaining > 0 ? "border-neutral-400" : "border-neutral-300"}`}>
          <span className="text-xs uppercase tracking-widest text-neutral-500">Remaining Due</span>
          <span className={`tabular-nums font-semibold ${remaining > 0 ? "" : "text-neutral-400"}`}>{fmtMoney(remaining)}</span>
        </div>
      </div>

      <button type="submit" className="btn-primary w-full mt-5" disabled={!canSave}>
        Save Sale
      </button>
      <p className="text-[11px] text-neutral-400 text-center mt-2.5">
        Invoice for {customerName} created on save
      </p>
    </div>
  );
}