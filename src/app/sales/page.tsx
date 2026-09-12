"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { fmtMoney } from "@/lib/format";
import { Page, PageTitle, Modal, useToggle } from "@/components/ui";
import SaleDetailModal from "@/components/SaleDetailModal";
import ReceivePaymentModal from "@/components/ReceivePaymentModal";
import SalesTable from "@/components/sales/SalesTable";
import NewSaleModal from "@/components/sales/NewSaleModal";
import { useSaleDraft } from "@/components/sales/useSaleDraft";
import { groupDefsByCategory, attrsValuesLine } from "@/lib/catalogue";
import { useUiPreferences } from "@/lib/preferences";

export default function SalesPage() {
  const { sales, customers, inventory, products, categories, attributeDefs, addSale, addPayment, addCustomer, salePaid } = useStore();
  const api = useSaleDraft();
  const { prefs } = useUiPreferences();
  const [viewId, setViewId] = useState<string | null>(null);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // customer add (the only popup left — a secondary action)
  const { open: newCustOpen, onOpen: onNewCustOpen, onClose: onNewCustClose } = useToggle();
  const [newCust, setNewCust] = useState({ name: "", shop: "", phone: "" });

  /* ---- sale header ---- */
  const [existingId, setExistingId] = useState(customers[0]?.id ?? "");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountPct, setDiscountPct] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [loadingCharges, setLoadingCharges] = useState(0);
  const [transportCharges, setTransportCharges] = useState(0);
  const [labourCharges, setLabourCharges] = useState(0);
  const [paidNow, setPaidNow] = useState(0);
  const [payError, setPayError] = useState("");

  /* ---- money on the current draft ---- */
  const subtotal = api.lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
  const discAmt = subtotal * (discountPct / 100);
  const taxable = subtotal - discAmt;
  const taxAmt = taxable * (taxPct / 100);
  const chargesAmt =
    (Number(loadingCharges) || 0) + (Number(transportCharges) || 0) + (Number(labourCharges) || 0);
  const grandTotal = taxable + taxAmt + chargesAmt;
  const remaining = Math.max(0, grandTotal - (Number(paidNow) || 0));
  const canSave =
    api.lines.length > 0 &&
    api.lines.every((l) => l.variantId && (Number(l.qty) || 0) > 0 && (Number(l.rate) || 0) > 0 && !api.lineOver(l)) &&
    !!existingId;

  const startNewSale = () => {
    api.resetDraft();
    api.removeAll();
    setDiscountPct(0);
    setTaxPct(0);
    setLoadingCharges(0);
    setTransportCharges(0);
    setLabourCharges(0);
    setPaidNow(0);
    setPayError("");
    setSaleDate(new Date().toISOString().slice(0, 10));
    setExistingId(customers[0]?.id ?? "");
    setNewOpen(true);
  };

  const saveNewCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name.trim()) return;
    const id = addCustomer({
      name: newCust.name.trim(),
      shop: newCust.shop.trim(),
      phone: newCust.phone.trim(),
    });
    setExistingId(id);
    setNewCust({ name: "", shop: "", phone: "" });
    onNewCustClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const paying = Number(paidNow) || 0;
    if (paying > grandTotal + 0.001) {
      setPayError(`Amount paid (${fmtMoney(paying)}) can't be more than this invoice's total of ${fmtMoney(grandTotal)}.`);
      return;
    }
    setPayError("");
    const saleId = addSale({
      date: saleDate,
      customerId: existingId,
      discountPct,
      taxPct,
      loadingCharges: chargesAmt > 0 ? Number(loadingCharges) || 0 : 0,
      transportCharges: chargesAmt > 0 ? Number(transportCharges) || 0 : 0,
      labourCharges: chargesAmt > 0 ? Number(labourCharges) || 0 : 0,
      lines: api.lines.map((l) => ({
        item: l.item,
        qty: Number(l.qty),
        rate: Number(l.rate),
        unit: l.unit,
        qualityName: l.qualityName?.trim() || undefined,
        categoryId: l.categoryId || undefined,
        variantId: l.variantId || undefined,
        attributeSnapshot: l.snapshot,
        supplierId: l.supplierId || undefined,
        purchaseId: l.purchaseId || undefined,
      })),
    });
    if (paying > 0) {
      addPayment({
        date: saleDate,
        type: "customer",
        partyId: existingId,
        amount: paying,
        method: "Cash",
        note: "Paid at time of sale",
        saleId,
      });
    }
    api.removeAll();
    setNewOpen(false);
    setViewId(saleId);
  };

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;
  const customer = customers.find((c) => c.id === existingId);
  // legacy fallbacks (pre-dynamic records have no snapshot)
  const productOf = (item: string) => inventory.find((r) => r.item === item)?.product ?? "";
  const qualityOf = (item: string) => inventory.find((r) => r.item === item)?.quality ?? "";
  // snapshot-aware display helpers for sale rows
  const productOfLine = (l: { categoryId?: string; item: string }) => {
    if (l.categoryId) {
      const cat = categories.find((c) => c.id === l.categoryId);
      if (cat) {
        const p = products.find((x) => x.id === cat.productId);
        if (p) return p.name;
      }
    }
    return productOf(l.item);
  };
  const attrTextOf = (l: { categoryId?: string; attributeSnapshot?: Record<string, string>; quality?: string; item: string }) =>
    l.attributeSnapshot
      ? attrsValuesLine(groupDefsByCategory(attributeDefs)[l.categoryId ?? ""] ?? [], l.attributeSnapshot)
      : l.quality || qualityOf(l.item) || "";

  return (
    <Page>
      {/* ================= SALES LIST ================= */}
      <PageTitle
        title="Sales & Invoices"
        sub="Every sale is an invoice — create, open, print or receive payment"
        action={
          <button className="btn-primary" onClick={startNewSale}>
            + New Sale
          </button>
        }
      />

      <SalesTable
        sales={sales}
        customerName={customerName}
        customers={customers}
        hasInventory={api.hasStock}
        productOfLine={productOfLine}
        attrTextOf={attrTextOf}
        salePaid={salePaid}
        onView={(id) => setViewId(id)}
        onReceive={(id) => setPaySaleId(id)}
        onNewSale={startNewSale}
      />

      <SaleDetailModal saleId={viewId} onClose={() => setViewId(null)} />
      <ReceivePaymentModal saleId={paySaleId} onClose={() => setPaySaleId(null)} />

      {/* ================= NEW SALE — large overlay popup (~80% of screen) ================= */}
      <NewSaleModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSubmit={submit}
        saleDate={saleDate}
        setSaleDate={setSaleDate}
        customers={customers}
        existingId={existingId}
        setExistingId={setExistingId}
        onNewCustOpen={onNewCustOpen}
        api={api}
        entSummary={{
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
          setPaidNow: (n: number) => { setPaidNow(n); setPayError(""); },
          remaining,
          payError,
          customerName: customer?.name ?? "customer",
          canSave,
        }}
        itemsCount={api.lines.length}
        showOptionalDetails={prefs.showOptionalDetails}
      />

      {/* add customer popup — the only popup left */}
      <Modal open={newCustOpen} onClose={onNewCustClose} title="New Customer">
        <form onSubmit={saveNewCustomer} className="grid gap-4">
          <div>
            <label>Name *</label>
            <input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} required autoFocus />
          </div>
          <div>
            <label>Shop / Area</label>
            <input value={newCust.shop} onChange={(e) => setNewCust({ ...newCust, shop: e.target.value })} />
          </div>
          <div>
            <label>Phone</label>
            <input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onNewCustClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!newCust.name.trim()}>
              Add Customer
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
