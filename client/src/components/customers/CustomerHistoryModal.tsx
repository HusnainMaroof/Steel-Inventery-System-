"use client";

import { useMemo } from "react";
import { Modal } from "@/components/ui";
import { Skeleton } from "@/components/skeletons";
import { useStore, saleGrandTotal } from "@/lib/store";
import { resolveDefs } from "@/lib/catalogue";
import { fmtDate, fmtMoney, fmtQtyWithUnit } from "@/lib/format";
import { toDecimal } from "@/lib/decimal";
import Decimal from "decimal.js";
import type { Sale } from "@/lib/types";

type LedgerRow = {
  key: string;
  date: string;
  order: string;
  kind: "sale" | "payment";
  label: string;
  detail: string;
  amount: number;
};

const th = "text-xs font-medium uppercase tracking-wide text-[#171717]/60 px-4 py-3";

/**
 * A customer's dues history: every sale (adds to what they owe) and every
 * payment (takes it down) in date order with a running balance, plus the
 * invoices that are still unpaid.
 */
export default function CustomerHistoryModal({
  customerId,
  onClose,
  onReceive,
}: {
  customerId: string | null;
  onClose: () => void;
  /** take a payment against an unpaid invoice */
  onReceive?: (saleId: string) => void;
}) {
  const { customers, sales, payments, salePaid, products, variants, attributeDefs, transactionsReady } = useStore();
  const customer = customers.find((c) => c.id === customerId);
  const name =
    customer?.name ??
    payments.find((p) => p.type === "customer" && p.partyId === customerId)?.partyName ??
    "Customer";

  const data = useMemo(() => {
    if (!customerId) return null;
    const variantById = new Map(variants.map((v) => [v.id, v]));
    const productById = new Map(products.map((p) => [p.id, p]));
    const itemText = (s: Sale) =>
      s.lines
        .map((l) => {
          const v = l.variantId ? variantById.get(l.variantId) : undefined;
          const product = (v?.productId && productById.get(v.productId)?.name) || l.item;
          const attrs = l.attributeSnapshot
            ? resolveDefs(attributeDefs, { productId: v?.productId, categoryId: l.categoryId ?? v?.categoryId, snapshot: l.attributeSnapshot })
                .map((d) => l.attributeSnapshot![d.key])
                .filter(Boolean)
            : [];
          return `${[product, ...attrs].join(" · ")}, ${fmtQtyWithUnit(l.qty, l.unit)}`;
        })
        .join("; ");

    const custSales = sales.filter((s) => s.customerId === customerId);
    const custPayments = payments.filter((p) => p.type === "customer" && p.partyId === customerId);
    const invoiceNo = new Map(custSales.map((s) => [s.id, s.invoiceNo]));

    const rows: LedgerRow[] = [
      ...custSales.map((s) => ({
        key: `s:${s.id}`,
        date: s.date,
        order: s.createdAt ?? "",
        kind: "sale" as const,
        label: `Sale ${s.invoiceNo}`,
        detail: itemText(s),
        amount: saleGrandTotal(s),
      })),
      ...custPayments.map((p) => {
        const on = [p.saleId, ...(p.allocations ?? []).map((a) => a.saleId)]
          .filter((id): id is string => !!id)
          .map((id) => invoiceNo.get(id))
          .filter(Boolean);
        return {
          key: `p:${p.id}`,
          date: p.date,
          order: p.createdAt ?? "",
          kind: "payment" as const,
          label: `Payment, ${p.method}`,
          detail: [on.length ? `On ${[...new Set(on)].join(", ")}` : "", p.note ?? ""].filter(Boolean).join(" · "),
          amount: p.amount,
        };
      }),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order) || (a.kind === "sale" ? -1 : 1));

    let running = new Decimal(0);
    const ledger = rows.map((r) => {
      running = r.kind === "sale" ? running.plus(toDecimal(r.amount)) : running.minus(toDecimal(r.amount));
      return { ...r, balance: running.toNumber() };
    });

    const total = custSales.reduce((a, s) => a.plus(toDecimal(saleGrandTotal(s))), new Decimal(0)).toNumber();
    const paid = custPayments.reduce((a, p) => a.plus(toDecimal(p.amount)), new Decimal(0)).toNumber();
    const unpaid = custSales
      .map((s) => ({ sale: s, total: saleGrandTotal(s), paid: salePaid(s.id) }))
      .filter((r) => r.total - r.paid > 0.005)
      .sort((a, b) => a.sale.date.localeCompare(b.sale.date));
    const due = unpaid.reduce((a, r) => a.plus(toDecimal(r.total - r.paid)), new Decimal(0)).toNumber();

    return { ledger: ledger.reverse(), total, paid, due, unpaid, count: custSales.length };
  }, [customerId, sales, payments, salePaid, products, variants, attributeDefs]);

  return (
    <Modal open={!!customerId} onClose={onClose} title={`History: ${name}`} size="4xl">
      {customerId && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                {name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[#171717]">{name}</p>
                <p className="text-[13px] text-[#171717]/70">
                  {customer ? [customer.shop, customer.phone].filter(Boolean).join(" · ") || "No shop or phone" : "Not in the active customer list"}
                </p>
              </div>
            </div>
          </div>

          {!transactionsReady || !data ? (
            <div className="space-y-3" role="status" aria-label="Loading history">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Invoices", value: String(data.count), cls: "text-[#171717]" },
                  { label: "Total sales", value: fmtMoney(data.total), cls: "text-[#171717]" },
                  { label: "Paid", value: fmtMoney(data.paid), cls: "text-success" },
                  { label: "Due now", value: data.due > 0 ? fmtMoney(data.due) : "Nothing due", cls: data.due > 0 ? "text-destructive" : "text-success" },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#171717]/60">{c.label}</p>
                    <p className={`mt-1.5 text-lg font-semibold tabular-nums whitespace-nowrap ${c.cls}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {data.unpaid.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[#171717]/60">Unpaid invoices</h3>
                  <div className="divide-y divide-[#E5E5E5] rounded-xl border border-[#E5E5E5] bg-white">
                    {data.unpaid.map(({ sale, total, paid }) => (
                      <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#171717] tabular-nums">
                            {sale.invoiceNo} · {fmtDate(sale.date)}
                          </p>
                          <p className="text-[13px] text-[#171717]/70 tabular-nums">
                            Total {fmtMoney(total)} · Paid {fmtMoney(paid)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-destructive tabular-nums whitespace-nowrap">
                            {fmtMoney(total - paid)} due
                          </span>
                          {onReceive && (
                            <button type="button" className="btn-ghost" onClick={() => onReceive(sale.id)}>
                              Receive payment
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[#171717]/60">Sales and payments</h3>
                {data.ledger.length === 0 ? (
                  <div className="rounded-xl border border-[#E5E5E5] bg-white px-4 py-10 text-center text-sm text-[#171717]/70">
                    No sales or payments for this customer yet.
                  </div>
                ) : (
                  <>
                  {/* phones: one row per entry, amounts always visible */}
                  <div className="divide-y divide-[#E5E5E5] rounded-xl border border-[#E5E5E5] bg-white sm:hidden">
                    {data.ledger.map((r) => (
                      <div key={r.key} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#171717]">{r.label}</p>
                          <p className="text-[13px] text-[#171717]/70 tabular-nums">{fmtDate(r.date)}</p>
                          {r.detail && <p className="text-[13px] text-[#171717]/70">{r.detail}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${r.kind === "payment" ? "text-success" : "text-[#171717]"}`}>
                            {r.kind === "payment" ? "- " : "+ "}
                            {fmtMoney(r.amount)}
                          </p>
                          <p className={`text-[13px] tabular-nums whitespace-nowrap ${r.balance > 0.005 ? "text-destructive" : "text-[#171717]/70"}`}>
                            Balance {fmtMoney(r.balance)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto rounded-xl border border-[#E5E5E5] bg-white sm:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#FAFAF9]">
                          <th className={`${th} text-left`}>Date</th>
                          <th className={`${th} text-left`}>Entry</th>
                          <th className={`${th} text-right`}>Sale</th>
                          <th className={`${th} text-right`}>Payment</th>
                          <th className={`${th} text-right`}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ledger.map((r) => (
                          <tr key={r.key} className="border-t border-[#E5E5E5] align-top">
                            <td className="px-4 py-3 whitespace-nowrap tabular-nums text-[#171717]/70">{fmtDate(r.date)}</td>
                            <td className="px-4 py-3 max-w-[320px]">
                              <span className="block font-medium text-[#171717]">{r.label}</span>
                              {r.detail && <span className="block text-[13px] text-[#171717]/70">{r.detail}</span>}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-[#171717]">
                              {r.kind === "sale" ? fmtMoney(r.amount) : ""}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-success">
                              {r.kind === "payment" ? fmtMoney(r.amount) : ""}
                            </td>
                            <td
                              className={`px-4 py-3 text-right tabular-nums whitespace-nowrap font-medium ${
                                r.balance > 0.005 ? "text-destructive" : "text-[#171717]"
                              }`}
                            >
                              {fmtMoney(r.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
