"use client";

import { useStore, purchaseTotal } from "@/lib/store";
import { Page, PageTitle } from "@/components/ui";
import { fmtMoney } from "@/lib/format";

export default function SuppliersPage() {
  const { suppliers, purchases, payments, supplierBalance } = useStore();

  return (
    <Page>
      <PageTitle
        title="Mills / Suppliers"
        sub="Purchases, payments and what you still owe"
      />
      <div className="border border-neutral-200 overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Mill</th>
              <th>City</th>
              <th>Phone</th>
              <th className="num">Loads</th>
              <th className="num">Purchased</th>
              <th className="num">Paid</th>
              <th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => {
              const sp = purchases.filter((p) => p.supplierId === s.id);
              const purchased = sp.reduce((a, p) => a + purchaseTotal(p), 0);
              const paid = payments
                .filter((p) => p.type === "supplier" && p.partyId === s.id)
                .reduce((a, p) => a + p.amount, 0);
              const bal = supplierBalance(s.id);
              return (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-neutral-500">{s.mill}</td>
                  <td>{s.phone}</td>
                  <td className="num">{sp.length}</td>
                  <td className="num">{fmtMoney(purchased)}</td>
                  <td className="num">{fmtMoney(paid)}</td>
                  <td className="num font-medium">
                    {bal > 0 ? fmtMoney(bal) : <span className="text-neutral-500">settled</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
