"use client";

import { fmtMoney, fmtQtyWithUnit } from "@/lib/format";
import type { PurchaseDraftApi } from "./usePurchaseDraft";

const numVal = (n: number) => (n === 0 ? "" : String(n));

export default function PurchaseSummaryPanel({
  api,
  supplierName,
  hideSubmit = false,
}: {
  api: PurchaseDraftApi;
  supplierName: string;
  hideSubmit?: boolean;
}) {
  const { pick, product, category, productUnit } = api;
  const perLabel = productUnit ? `/${productUnit}` : "";
  const fullyPaid = api.dueToSupplier < 0.005 && api.goodsTotal > 0;
  const hasDraft = pick.qty > 0.001 || pick.rate > 0;

  return (
    <div className="border border-neutral-200 rounded-xl bg-white p-5 xl:sticky xl:top-6">
      <p className="text-xs uppercase tracking-widest text-neutral-500 mb-4">Live summary</p>

      {hasDraft && product ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 py-2.5 mb-4 text-[12px]">
          <p className="font-medium text-neutral-900">{product.name}</p>
          {category?.name ? <p className="text-neutral-500">{category.name}</p> : null}
          <p className="text-neutral-600 tabular-nums mt-1">
            {fmtQtyWithUnit(pick.qty, productUnit)} × {fmtMoney(pick.rate || 0)}
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-neutral-500">Goods total (mill)</span>
          <span className="tabular-nums font-medium">{fmtMoney(api.goodsTotal)}</span>
        </div>

        <div
          className={`border rounded-lg px-3 py-3 ${
            api.chargesTotal > 0 ? "border-neutral-300 bg-neutral-50/70" : "border-dashed border-neutral-200"
          }`}
        >
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[11px] uppercase tracking-widest text-neutral-500 font-medium">Charges</span>
            {api.chargesTotal > 0 && (
              <span className="text-[11px] tabular-nums text-neutral-500">+ {fmtMoney(api.chargesTotal)}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["loading", "Loading"],
                ["transport", "Transport"],
                ["labour", "Labour"],
                ["otherCost", "Other"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="!mb-0.5 !text-[10px] text-neutral-500">{label}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="!py-1.5 !text-[12px]"
                  value={numVal(pick[key])}
                  onChange={(e) => api.setPick({ [key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center py-2.5 px-3 bg-black text-white -mx-3">
          <span className="text-xs uppercase tracking-widest text-neutral-400">Landed total</span>
          <span className="tabular-nums font-semibold">{fmtMoney(api.landedTotal)}</span>
        </div>

        {pick.qty > 0.001 ? (
          <div className="flex justify-between items-center text-sm">
            <span className="text-neutral-500">Landed cost{perLabel}</span>
            <span className="tabular-nums font-medium">{fmtMoney(api.landedPerUnit)}</span>
          </div>
        ) : null}

        {pick.sellRate > 0 && pick.qty > 0.001 ? (
          <div
            className={`rounded-lg px-3 py-2 flex justify-between text-[12px] ${
              api.marginPerUnit >= 0
                ? "border border-[#cfe3cd] bg-[#f4faf3] text-[#2e6b2e]"
                : "border border-[#f0d2cc] bg-[#fdf1ef] text-[#a12b1f]"
            }`}
          >
            <span className="font-medium">Expected profit{perLabel}</span>
            <span className="font-bold tabular-nums">{fmtMoney(api.marginPerUnit)}</span>
          </div>
        ) : null}

        <div className="border-2 border-amber-400/80 bg-amber-50/50 rounded-lg px-3 py-3">
          <label className="!mb-1 !text-[11px] uppercase tracking-widest text-amber-800 font-medium">
            Paid to supplier
          </label>
          <input
            type="number"
            min="0"
            step="any"
            max={api.goodsTotal > 0 ? api.goodsTotal : undefined}
            className={`!py-2.5 !text-[13px] !border-amber-200 ${api.payError ? "!border-red-600" : ""}`}
            value={numVal(pick.paidToSupplier)}
            onChange={(e) => api.setPick({ paidToSupplier: Number(e.target.value) })}
          />
          <p className="text-[10px] text-neutral-500 mt-1">Max goods total — charges are not paid to the mill</p>
          {api.payError ? (
            <p className="text-[11px] text-red-600 mt-2" role="alert">
              {api.payError}
            </p>
          ) : null}
        </div>

        {fullyPaid ? (
          <div className="flex justify-between items-center px-3 py-2.5 rounded-lg border border-[#cfe3cd] bg-[#f0f7ef]">
            <span className="text-xs uppercase tracking-widest text-[#2e6b2e] font-medium">Due to supplier</span>
            <span className="tabular-nums font-semibold text-[#2e6b2e]">Fully paid</span>
          </div>
        ) : (
          <div className="flex justify-between items-center px-3 py-2.5 border border-dashed border-neutral-400 -mx-1 rounded-lg">
            <span className="text-xs uppercase tracking-widest text-neutral-500">Due to supplier</span>
            <span className="tabular-nums font-semibold">{fmtMoney(api.dueToSupplier)}</span>
          </div>
        )}
      </div>

      {hideSubmit ? (
        <p className="text-[11px] text-neutral-400 text-center mt-4">
          Purchase from {supplierName} · save when ready
        </p>
      ) : null}
    </div>
  );
}
