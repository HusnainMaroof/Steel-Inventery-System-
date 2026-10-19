"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
import { BusyButton, NumberInput } from "@/components/ui";
import { fmtMoney } from "@/lib/format";

const round2 = (n: number) => Math.round(n * 100) / 100;

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-3 text-sm">
      <span className="text-[#171717]/70">{label}</span>
      <span className={`tabular-nums ${muted ? "text-[#171717]/70" : "font-medium text-[#171717]"}`}>{value}</span>
    </div>
  );
}

export default function SaleSummaryPanel({
  subtotal,
  discountPct,
  setDiscountPct,
  taxPct,
  setTaxPct,
  discAmt,
  taxAmt,
  loadingCharges,
  setLoadingCharges,
  transportCharges,
  setTransportCharges,
  labourCharges,
  setLabourCharges,
  chargesAmt,
  grandTotal,
  paidNow,
  setPaidNow,
  remaining,
  payError,
  customerName,
  canSave,
  hideSubmit = false,
  submitting = false,
}: {
  subtotal: number;
  discountPct: number;
  setDiscountPct: (n: number) => void;
  taxPct: number;
  setTaxPct: (n: number) => void;
  discAmt: number;
  taxAmt: number;
  loadingCharges: number;
  setLoadingCharges: (n: number) => void;
  transportCharges: number;
  setTransportCharges: (n: number) => void;
  labourCharges: number;
  setLabourCharges: (n: number) => void;
  chargesAmt: number;
  grandTotal: number;
  paidNow: number;
  setPaidNow: (n: number) => void;
  remaining: number;
  payError?: string;
  customerName: string;
  canSave: boolean;
  hideSubmit?: boolean;
  submitting?: boolean;
}) {
  const total = round2(grandTotal);
  const paid = Number(paidNow) || 0;
  const due = round2(remaining);
  const hasTotal = total > 0;
  const over = hasTotal && paid > total + 0.005;
  const fullyPaid = hasTotal && !over && due < 0.005;
  const payMessage =
    payError || (over ? `Paid now can't be more than the total of ${fmtMoney(total)}.` : "");

  return (
    <div className="border border-[#E5E5E5] rounded-xl bg-white p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[#171717]/60 mb-4">Summary</p>

      <div className="space-y-4">
        <Row label="Subtotal" value={fmtMoney(subtotal)} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sale-discount" className="!mb-1">Discount (%)</label>
            <NumberInput id="sale-discount" placeholder="0" value={discountPct} onValue={setDiscountPct} />
          </div>
          <div>
            <label htmlFor="sale-tax" className="!mb-1">Tax (%)</label>
            <NumberInput id="sale-tax" placeholder="0" value={taxPct} onValue={setTaxPct} />
          </div>
        </div>
        {(discAmt > 0 || taxAmt > 0) && (
          <div className="space-y-2">
            {discAmt > 0 && <Row label={`Discount (${discountPct}%)`} value={`- ${fmtMoney(discAmt)}`} muted />}
            {taxAmt > 0 && <Row label={`Tax (${taxPct}%)`} value={`+ ${fmtMoney(taxAmt)}`} muted />}
          </div>
        )}

        {/* loading / transport / labour: optional flat amounts */}
        <div className="rounded-lg bg-[#F8F8F7] p-3">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-medium text-[#171717]/60">Extra charges (optional)</span>
            {chargesAmt > 0 && <span className="text-xs tabular-nums text-[#171717]/70">+ {fmtMoney(chargesAmt)}</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["sale-loading", "Loading", loadingCharges, setLoadingCharges],
                ["sale-transport", "Transport", transportCharges, setTransportCharges],
                ["sale-labour", "Labour", labourCharges, setLabourCharges],
              ] as const
            ).map(([id, label, value, set]) => (
              <div key={id} className="min-w-0">
                <label htmlFor={id} className="!mb-1">{label}</label>
                <NumberInput id={id} placeholder="0" value={value} onValue={set} className="bg-white" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center gap-3 rounded-lg bg-ink text-white px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-white/70">Grand total</span>
          <span className="text-lg font-semibold tabular-nums">{fmtMoney(total)}</span>
        </div>

        {/* paid now: what the customer pays today */}
        <div>
          <label htmlFor="sale-paid-now" className="!mb-1">Paid now</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#171717]/60">Rs</span>
            <NumberInput
              id="sale-paid-now"
              placeholder="0"
              value={paidNow}
              onValue={setPaidNow}
              aria-invalid={!!payMessage}
              aria-describedby={payMessage ? "sale-paid-error" : undefined}
              className={`!pl-10 text-base font-medium tabular-nums ${payMessage ? "!border-destructive" : ""}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => setPaidNow(0)}
              disabled={!hasTotal}
              aria-pressed={hasTotal && paid === 0}
              className={`min-h-10 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 ${
                hasTotal && paid === 0
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-[#171717] border-[#E5E5E5] hover:bg-[#F8F8F7]"
              }`}
            >
              On credit
            </button>
            <button
              type="button"
              onClick={() => setPaidNow(total)}
              disabled={!hasTotal}
              aria-pressed={fullyPaid}
              className={`min-h-10 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 ${
                fullyPaid
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-[#171717] border-[#E5E5E5] hover:bg-[#F8F8F7]"
              }`}
            >
              Fully paid
            </button>
          </div>
          {payMessage ? (
            <p id="sale-paid-error" role="alert" className="mt-1.5 text-[13px] text-destructive">{payMessage}</p>
          ) : null}
        </div>

        {/* what is left after today's payment */}
        {hasTotal && !over && (
          fullyPaid ? (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              Fully paid. Nothing left to collect.
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-warning/10 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-warning">
                <Clock3 className="size-4 shrink-0" aria-hidden />
                {paid > 0 ? "Remaining due" : "Full amount on credit"}
              </span>
              <span className="text-sm font-semibold tabular-nums text-warning">{fmtMoney(due)}</span>
            </div>
          )
        )}
      </div>

      {!hideSubmit && (
        <>
          <BusyButton type="submit" className="w-full mt-5" loading={submitting} disabled={!canSave}>
            Save Sale
          </BusyButton>
          <p className="text-[13px] text-[#171717]/70 text-center mt-2.5">
            Invoice for {customerName} is created on save.
          </p>
        </>
      )}
      {hideSubmit && (
        <p className="text-[13px] text-[#171717]/70 text-center mt-4">
          Invoice for {customerName}. Save with the button below.
        </p>
      )}
    </div>
  );
}
