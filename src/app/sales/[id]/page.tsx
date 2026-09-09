"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useStore, saleTotal, saleDiscount, saleTax, saleGrandTotal } from "@/lib/store";
import { useBusinessProfile } from "@/lib/auth";
import { attrsInOrder, groupDefsByCategory } from "@/lib/catalogue";
import InvoiceDocument, { type InvoiceLineDetail } from "@/components/InvoiceDocument";
import type { SaleLine } from "@/lib/types";
import { useMemo } from "react";

export default function SaleInvoicePage() {
  const params = useParams<{ id: string }>();
  const business = useBusinessProfile();
  const { sales, customers, products, categories, variants, attributeDefs, salePaid } = useStore();
  const sale = sales.find((s) => s.id === params.id);

  const defsByCat = useMemo(() => groupDefsByCategory(attributeDefs), [attributeDefs]);

  const lineDetailOf = (l: SaleLine): InvoiceLineDetail => {
    const cat = l.categoryId ? categories.find((c) => c.id === l.categoryId) : undefined;
    const product = cat ? products.find((p) => p.id === cat.productId) : undefined;
    const variant = l.variantId ? variants.find((v) => v.id === l.variantId) : undefined;
    const defs = l.categoryId ? defsByCat[l.categoryId] ?? [] : [];

    const attributes = l.attributeSnapshot
      ? attrsInOrder(defs, l.attributeSnapshot).map((r) => ({
          label: r.def.name,
          value: r.value,
        }))
      : [l.spec, l.quality]
          .filter(Boolean)
          .map((v, i) => ({ label: i === 0 ? "Spec" : "Grade", value: v! }));

    return {
      product: product?.name ?? null,
      category: cat?.name ?? null,
      item: variant?.shortName ?? l.item,
      attributes,
    };
  };

  if (!sale)
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="text-neutral-500">Invoice not found.</p>
      </div>
    );

  const cust = customers.find((c) => c.id === sale.customerId);
  const subtotal = saleTotal(sale);
  const disc = saleDiscount(sale);
  const tax = saleTax(sale);
  const grand = saleGrandTotal(sale);
  const paid = salePaid(sale.id);
  const due = Math.max(0, grand - paid);

  return (
    <div className="min-h-screen bg-[#f8f8f7] py-4 sm:py-8 px-4 sm:px-6">
      <div className="max-w-[210mm] mx-auto flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6 no-print">
        <Link href="/sales" className="text-[13px] text-neutral-500 hover:text-black underline-offset-2 hover:underline">
          ← Back to sales
        </Link>
        <button type="button" className="btn-primary !py-2.5 !px-5" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <InvoiceDocument
        sale={sale}
        customer={cust}
        business={business}
        subtotal={subtotal}
        discount={disc}
        discountPct={sale.discountPct ?? 0}
        tax={tax}
        taxPct={sale.taxPct ?? 0}
        grandTotal={grand}
        paid={paid}
        due={due}
        lineDetailOf={lineDetailOf}
      />
    </div>
  );
}
