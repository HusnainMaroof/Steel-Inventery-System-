"use client";

import { useStore } from "@/lib/store";
import { fmtMoney } from "@/lib/format";

/** Simple "who owes who" panel — customers owing you vs. what you owe suppliers. */
export default function CreditDebit() {
  const { customers, customerBalance, suppliers, supplierBalance } = useStore();

  const owingCustomers = customers
    .map((c) => ({ c, bal: customerBalance(c.id) }))
    .filter((x) => x.bal > 0)
    .sort((a, b) => b.bal - a.bal);
  const totalReceivable = owingCustomers.reduce((a, x) => a + x.bal, 0);

  const owingSuppliers = suppliers
    .map((s) => ({ s, bal: supplierBalance(s.id) }))
    .filter((x) => x.bal > 0)
    .sort((a, b) => b.bal - a.bal);
  const totalPayable = owingSuppliers.reduce((a, x) => a + x.bal, 0);

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="border border-neutral-800 bg-black text-white p-4">
        <span className="block text-[11px] uppercase tracking-widest text-neutral-400">
          Customers owe you
        </span>
        <span className="block text-xl font-medium tabular-nums mt-1">{fmtMoney(totalReceivable)}</span>
        {owingCustomers.length > 0 && (
          <ul className="mt-3 space-y-1">
            {owingCustomers.slice(0, 3).map((x) => (
              <li key={x.c.id} className="flex justify-between text-xs text-neutral-300">
                <span className="truncate mr-2">{x.c.name}</span>
                <span className="tabular-nums">{fmtMoney(x.bal)}</span>
              </li>
            ))}
            {owingCustomers.length > 3 && (
              <li className="text-xs text-neutral-500">+ {owingCustomers.length - 3} more</li>
            )}
          </ul>
        )}
      </div>
      <div className="border border-neutral-200 p-4">
        <span className="block text-[11px] uppercase tracking-widest text-neutral-500">
          You owe suppliers
        </span>
        <span className="block text-xl font-medium tabular-nums mt-1">{fmtMoney(totalPayable)}</span>
        {owingSuppliers.length > 0 && (
          <ul className="mt-3 space-y-1">
            {owingSuppliers.slice(0, 3).map((x) => (
              <li key={x.s.id} className="flex justify-between text-xs text-neutral-600">
                <span className="truncate mr-2">{x.s.name}</span>
                <span className="tabular-nums">{fmtMoney(x.bal)}</span>
              </li>
            ))}
            {owingSuppliers.length > 3 && (
              <li className="text-xs text-neutral-400">+ {owingSuppliers.length - 3} more</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
