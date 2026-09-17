"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { fmtMoney } from "@/lib/format";
import { Page, PageTitle, Modal, useToggle } from "@/components/ui";
import SaleDetailModal from "@/components/SaleDetailModal";
import ReceivePaymentModal from "@/components/ReceivePaymentModal";
import SalesTable from "@/components/sales/SalesTable";
import NewSaleModal from "@/components/sales/NewSaleModal";
import PrintPack from "@/components/sales/PrintPack";
import { useSaleDraft } from "@/components/sales/useSaleDraft";
import { productUsesCategories, resolveDefs } from "@/lib/catalogue";
import { useUiPreferences } from "@/lib/preferences";

export default function SalesPage() {
  const { sales, customers, inventory, products, categories, attributeDefs, addSale, addCustomer, deleteSale, salePaid } = useStore();
  const activeCustomers = customers.filter((customer) => customer.active !== false);
  const api = useSaleDraft();
  const { prefs } = useUiPreferences();
  const [viewId, setViewId] = useState<string | null>(null);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [tab, setTab] = useState<"invoices" | "print">(() => {
    if (typeof window === "undefined") return "invoices";
    return new URLSearchParams(window.location.search).get("tab") === "print"
      ? "print"
      : "invoices";
  });

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
    setExistingId(activeCustomers[0]?.id ?? "");
    setNewOpen(true);
  };

  const saveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name.trim()) return;
    const id = await addCustomer({
      name: newCust.name.trim(),
      shop: newCust.shop.trim(),
      phone: newCust.phone.trim(),
    });
    setExistingId(id);
    setNewCust({ name: "", shop: "", phone: "" });
    onNewCustClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const paying = Number(paidNow) || 0;
    if (paying > grandTotal + 0.001) {
      setPayError(`Amount paid (${fmtMoney(paying)}) can't be more than this invoice's total of ${fmtMoney(grandTotal)}.`);
      return;
    }
    setPayError("");
    const saleId = await addSale({
      date: saleDate,
      customerId: existingId,
      discountPct,
      taxPct,
      loadingCharges: chargesAmt > 0 ? Number(loadingCharges) || 0 : 0,
      transportCharges: chargesAmt > 0 ? Number(transportCharges) || 0 : 0,
      labourCharges: chargesAmt > 0 ? Number(labourCharges) || 0 : 0,
      paidNow: paying,
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
    api.removeAll();
    setNewOpen(false);
    setViewId(saleId);
  };

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;
  const customer = customers.find((c) => c.id === existingId);
  // legacy fallbacks (pre-dynamic records have no snapshot)
  const productOf = (item: string) => inventory.find((r) => r.item === item)?.product ?? "";
  const qualityOf = (item: string) => inventory.find((r) => r.item === item)?.quality ?? "";
  const productOfLine = (l: { categoryId?: string; item: string; variantId?: string }) => {
    const variant = l.variantId ? api.varById.get(l.variantId) : undefined;
    if (variant?.productId) {
      const p = products.find((x) => x.id === variant.productId);
      if (p) return p.name;
    }
    if (l.categoryId) {
      const cat = categories.find((c) => c.id === l.categoryId);
      if (cat) {
        const p = products.find((x) => x.id === cat.productId);
        if (p) return p.name;
      }
    }
    return productOf(l.item);
  };
  const categoryNameOf = (l: { categoryId?: string; variantId?: string }) => {
    const variant = l.variantId ? api.varById.get(l.variantId) : undefined;
    const prod = variant?.productId ? products.find((x) => x.id === variant.productId) : undefined;
    if (prod && !productUsesCategories(prod)) return "";
    const catId = l.categoryId ?? variant?.categoryId;
    if (!catId) return "";
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return "";
    const p = prod ?? products.find((x) => x.id === cat.productId);
    return productUsesCategories(p) ? cat.name : "";
  };
  const attrRowsOf = (l: { categoryId?: string; variantId?: string; attributeSnapshot?: Record<string, string>; quality?: string; item: string }) => {
    if (l.attributeSnapshot) {
      const variant = l.variantId ? api.varById.get(l.variantId) : undefined;
      const cat = l.categoryId ? categories.find((c) => c.id === l.categoryId) : undefined;
      const defs = resolveDefs(attributeDefs, {
        productId: variant?.productId ?? cat?.productId,
        categoryId: l.categoryId ?? variant?.categoryId,
        snapshot: l.attributeSnapshot,
      });
      return defs
        .filter((d) => l.attributeSnapshot![d.key])
        .map((d) => ({ label: d.name, value: l.attributeSnapshot![d.key] }));
    }
    const q = l.quality || qualityOf(l.item);
    return q ? [{ label: "Quality", value: q }] : [];
  };

  return (
    <Page>
      {/* ================= SALES LIST ================= */}
      <PageTitle
        title="Sales & Invoices"
        sub="Every sale is an invoice — create, open, print or receive payment"
        action={
          tab === "invoices" ? (
            <button className="btn-primary" onClick={startNewSale}>
              + New Sale
            </button>
          ) : undefined
        }
      />

      <div className="flex gap-6 border-b border-neutral-200 mb-4">
        {([
          ["invoices", "Invoices"],
          ["print", "Print pack"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              const next = key === "print" ? "/sales?tab=print" : "/sales";
              window.history.replaceState(null, "", next);
            }}
            className={`pb-2 text-xs uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              tab === key ? "border-black text-black font-bold" : "border-transparent text-black font-normal hover:opacity-60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "invoices" ? (
        <SalesTable
          sales={sales}
          customerName={customerName}
          customers={customers}
          hasInventory={api.hasStock}
          productOfLine={productOfLine}
          categoryNameOf={categoryNameOf}
          attrRowsOf={attrRowsOf}
          salePaid={salePaid}
          onView={(id) => setViewId(id)}
          onReceive={(id) => setPaySaleId(id)}
          onDelete={(id) => deleteSale(id)}
          onNewSale={startNewSale}
        />
      ) : (
        <PrintPack sales={sales} salePaid={salePaid} />
      )}

      <SaleDetailModal saleId={viewId} onClose={() => setViewId(null)} />
      <ReceivePaymentModal saleId={paySaleId} onClose={() => setPaySaleId(null)} />

      {/* ================= NEW SALE — large overlay popup (~80% of screen) ================= */}
      <NewSaleModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSubmit={submit}
        saleDate={saleDate}
        setSaleDate={setSaleDate}
        customers={activeCustomers}
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
