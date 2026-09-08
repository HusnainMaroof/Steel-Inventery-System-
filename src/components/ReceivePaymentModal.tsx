"use client";

import { useState } from "react";
import { useStore, saleGrandTotal } from "@/lib/store";
import { Modal } from "@/components/ui";
import { fmtMoney, fmtDate } from "@/lib/format";

const numVal = (n: number) => (n === 0 ? "" : String(n));

/* Small popup to record a payment against ONE invoice. Updates that
   invoice's paid amount immediately (stock & balances follow). */
export default function ReceivePaymentModal({
  saleId,
  onClose,
}: {
  saleId: string | null;
  onClose: () => void;
}) {
  const { sales, customers, salePaid } = useStore();
  const sale = sales.find((s) => s.id === saleId) ?? null;

  // amount already paid on THIS invoice (explicit + FIFO allocation)
  const paidOnSale = sale ? salePaid(sale.id) : 0;
  const total = sale ? saleGrandTotal(sale) : 0;
  const due = Math.max(0, total - paidOnSale);

  if (!sale) return null;
  const cust = customers.find((c) => c.id === sale.customerId);

  return (
    <Modal open={!!sale} onClose={onClose} title="Receive Payment">
      {/* key remounts the form per invoice so Amount starts at the due */}
      <PaymentForm key={sale.id} saleId={sale.id} due={due} defaultAmount={due} custName={cust?.name ?? ""} onClose={onClose} />
    </Modal>
  );
}

function PaymentForm({
  saleId,
  due,
  defaultAmount,
  custName,
  onClose,
}: {
  saleId: string;
  due: number;
  defaultAmount: number;
  custName: string;
  onClose: () => void;
}) {
  const { sales, addPayment } = useStore();
  const sale = sales.find((s) => s.id === saleId) ?? null;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<"Cash" | "Bank" | "Cheque">("Cash");
  const [amount, setAmount] = useState(defaultAmount);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  if (!sale) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      setErr("Enter the amount you're receiving.");
      return;
    }
    if (amt > due + 0.001) {
      const totalAmt = saleGrandTotal(sale);
      setErr(`You can't receive more than the remaining due of ${fmtMoney(due)} — ${fmtMoney(totalAmt)} is the invoice total and ${fmtMoney(totalAmt - due)} is already paid.`);
      return;
    }
    setErr("");
    addPayment({
      date,
      type: "customer",
      partyId: sale.customerId,
      amount: amt,
      method,
      saleId: sale.id,
      note: note.trim() || `Payment on ${sale.invoiceNo}`,
    });
    onClose();
  };

  return (
    <>
      <div className="mb-4 border border-neutral-200 p-3">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">{sale.invoiceNo} · {fmtDate(sale.date)}</span>
          <span className="tabular-nums">{custName}</span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-neutral-500">Total</span>
          <span className="tabular-nums font-medium">{fmtMoney(saleGrandTotal(sale))}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-neutral-500">Already paid</span>
          <span className="tabular-nums">{fmtMoney(saleGrandTotal(sale) - due)}</span>
        </div>
        <div className="flex justify-between text-sm mt-1 font-medium">
          <span>Remaining due</span>
          <span className="tabular-nums">{fmtMoney(due)}</span>
        </div>
      </div>

      <form onSubmit={submit} noValidate className="grid grid-cols-2 gap-4">
        <div>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label>Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option>Cash</option>
            <option>Bank</option>
            <option>Cheque</option>
          </select>
        </div>
        <div className="col-span-2">
          <label>Amount</label>
          <input
            type="number" min="0" max={due || undefined} step="any"
            placeholder="0"
            value={numVal(amount)}
            onChange={(e) => { setAmount(Number(e.target.value)); setErr(""); }}
            required
          />
          {err && (
            <div className="col-span-2 border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">{err}</div>
          )}
        </div>
        <div className="col-span-2">
          <label>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Payment on ${sale.invoiceNo}`} />
        </div>
        <div className="col-span-2 flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!(Number(amount) > 0)}>
            Save Payment
          </button>
        </div>
      </form>
    </>
  );
}
