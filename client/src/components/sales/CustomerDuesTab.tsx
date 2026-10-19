"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search } from "lucide-react";
import { RowActionsMenu } from "@/components/ui";
import { useBusinessHref } from "@/components/BusinessLink";
import { Skeleton } from "@/components/skeletons";
import { useStore, saleGrandTotal } from "@/lib/store";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { Sale } from "@/lib/types";
import Decimal from "decimal.js";
import { toDecimal } from "@/lib/decimal";

export default function CustomerDuesTab({ onReceive }: { onReceive: (saleId: string) => void }) {
  const { customers, sales, salePaid, customerBalance, transactionsReady } = useStore();
  const businessHref = useBusinessHref();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const dues = useMemo(() => {
    const salesByCustomer = new Map<string, Sale[]>();
    for (const sale of sales) {
      const customerSales = salesByCustomer.get(sale.customerId) ?? [];
      customerSales.push(sale);
      salesByCustomer.set(sale.customerId, customerSales);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return customers.flatMap((customer) => {
      const amountDue = customerBalance(customer.id);
      if (amountDue <= 0.005) return [];

      let unpaidCount = 0;
      let oldestUnpaid: Sale | null = null;
      for (const sale of salesByCustomer.get(customer.id) ?? []) {
        if (salePaid(sale.id) >= saleGrandTotal(sale) - 0.005) continue;
        unpaidCount += 1;
        if (!oldestUnpaid || sale.date.localeCompare(oldestUnpaid.date) < 0) {
          oldestUnpaid = sale;
        }
      }

      const daysAgo = oldestUnpaid
        ? Math.max(0, Math.floor((today.getTime() - new Date(`${oldestUnpaid.date}T00:00:00`).getTime()) / 86_400_000))
        : 0;
      return [{ customer, amountDue, unpaidCount, oldestUnpaid, daysAgo }];
    }).sort((a, b) => b.amountDue - a.amountDue);
  }, [customers, sales, salePaid, customerBalance]);

  // Money is summed exactly, like the rest of the ledger.
  const totalDue = dues.reduce((sum, row) => sum.plus(toDecimal(row.amountDue)), new Decimal(0)).toNumber();
  const unpaidInvoices = dues.reduce((sum, row) => sum + row.unpaidCount, 0);
  const query = search.trim().toLocaleLowerCase();
  const filteredDues = query
    ? dues.filter(({ customer }) =>
        `${customer.name} ${customer.shop} ${customer.phone}`.toLocaleLowerCase().includes(query),
      )
    : dues;

  const openHistory = (customerId: string) => {
    router.push(businessHref(`customers?view=${encodeURIComponent(customerId)}`));
  };

  const historyMenu = (customerId: string, name: string) => (
    <RowActionsMenu
      ariaLabel={`Actions for ${name}`}
      buttonClassName="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E5E5E5] text-[#171717]/70 transition-colors hover:bg-[#F8F8F7]"
      items={[{ label: "View history", onClick: () => openHistory(customerId) }]}
    />
  );

  const paymentAction = (sale: Sale | null) => (
    <button
      type="button"
      className="btn-ghost whitespace-nowrap"
      disabled={!sale}
      onClick={() => sale && onReceive(sale.id)}
    >
      Receive payment
    </button>
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 sm:p-5">
        <p className="text-xs uppercase tracking-wide text-[#171717]/60">Total customers owe you</p>
        {transactionsReady ? (
          <p className="mt-2 text-2xl font-bold tabular-nums text-destructive">{fmtMoney(totalDue)}</p>
        ) : (
          <Skeleton className="mt-2 h-8 w-40" />
        )}
        <p className="mt-1 text-[13px] text-[#171717]/70">
          {transactionsReady ? `${dues.length} customers · ${unpaidInvoices} unpaid invoices` : "Loading customer balances"}
        </p>
      </div>

      <div className="flex w-full items-center gap-3">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#171717]/50" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, shop or phone"
            aria-label="Search customers by name, shop or phone"
            className="w-full pl-10"
          />
        </label>
      </div>

      {!transactionsReady ? (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[#E5E5E5] bg-white md:block" aria-label="Loading customer dues">
            <div className="grid grid-cols-5 gap-4 bg-[#FAFAF9] px-5 py-3">
              {["w-24", "w-28", "w-28", "w-24", "w-16"].map((width, index) => (
                <Skeleton key={index} className={`h-3 ${width}`} />
              ))}
            </div>
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="grid grid-cols-5 items-center gap-4 border-t border-[#E5E5E5] px-5 py-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="ml-auto h-4 w-24" />
                <Skeleton className="h-10 w-32" />
              </div>
            ))}
          </div>
          <div className="space-y-3 md:hidden" aria-label="Loading customer dues">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </>
      ) : filteredDues.length === 0 ? (
        <div className="rounded-xl border border-[#E5E5E5] bg-white">
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium text-[#171717]">
              {dues.length === 0 ? "No customer owes you money" : "No customers match your search"}
            </p>
            <p className="mt-1.5 text-[13px] text-[#171717]/70">
              {dues.length === 0 ? "Unpaid sales show up here." : "Try another name, shop or phone."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-[#E5E5E5] bg-white md:block">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="bg-[#FAFAF9]">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#171717]/60">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#171717]/60">Unpaid invoices</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#171717]/60">Oldest unpaid</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-[#171717]/60">Amount due</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-[#171717]/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDues.map(({ customer, amountDue, unpaidCount, oldestUnpaid, daysAgo }) => (
                  <tr key={customer.id} className="border-t border-[#E5E5E5] text-sm transition-colors hover:bg-[#F8F8F7]">
                    <td className="px-5 py-4">
                      <p className="font-medium text-[#171717]">{customer.name}</p>
                      <p className="mt-0.5 text-[13px] text-[#171717]/70">{[customer.shop, customer.phone].filter(Boolean).join(" · ") || "No shop or phone"}</p>
                    </td>
                    <td className="px-5 py-4 tabular-nums">{unpaidCount}</td>
                    <td className={`px-5 py-4 ${daysAgo >= 30 ? "text-warning" : "text-[#171717]"}`}>
                      {oldestUnpaid ? <><span>{fmtDate(oldestUnpaid.date)}</span><span className="ml-2 text-[13px]">{daysAgo} days ago</span></> : "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-destructive">{fmtMoney(amountDue)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {paymentAction(oldestUnpaid)}
                        {historyMenu(customer.id, customer.name)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredDues.map(({ customer, amountDue, unpaidCount, oldestUnpaid, daysAgo }) => (
              <article key={customer.id} className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-medium text-[#171717]">{customer.name}</h2>
                    <p className="mt-1 text-[13px] text-[#171717]/70">{[customer.shop, customer.phone].filter(Boolean).join(" · ") || "No shop or phone"}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">{fmtMoney(amountDue)}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#E5E5E5] pt-3 text-sm">
                  <div>
                    <dt className="text-[13px] text-[#171717]/70">Unpaid invoices</dt>
                    <dd className="mt-1 tabular-nums">{unpaidCount}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-[#171717]/70">Oldest unpaid</dt>
                    <dd className={`mt-1 ${daysAgo >= 30 ? "text-warning" : "text-[#171717]"}`}>
                      {oldestUnpaid ? <>{fmtDate(oldestUnpaid.date)}<span className="block text-[13px]">{daysAgo} days ago</span></> : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center gap-2">
                  <div className="min-w-0 flex-1">{paymentAction(oldestUnpaid)}</div>
                  {historyMenu(customer.id, customer.name)}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
