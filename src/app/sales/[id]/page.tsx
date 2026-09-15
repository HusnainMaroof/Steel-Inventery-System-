"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useStore, saleTotal, saleDiscount, saleTax, saleGrandTotal } from "@/lib/store";
import { useBusinessProfile } from "@/lib/auth";
import InvoiceDocument from "@/components/InvoiceDocument";
import { invoiceLineDetail } from "@/lib/invoiceDetail";

export default function SaleInvoicePage() {
  const params = useParams<{ id: string }>();
  const business = useBusinessProfile();
  const { sales, customers, products, categories, variants, attributeDefs, salePaid } = useStore();
  const sale = sales.find((s) => s.id === params.id);
  const ctx = useMemo(
    () => ({ products, categories, variants, attributeDefs }),
    [products, categories, variants, attributeDefs]
  );

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
        loadingCharges={sale.loadingCharges ?? 0}
        transportCharges={sale.transportCharges ?? 0}
        labourCharges={sale.labourCharges ?? 0}
        grandTotal={grand}
        paid={paid}
        due={due}
        lineDetailOf={(l) => invoiceLineDetail(l, ctx)}
      />
    </div>
  );
}
