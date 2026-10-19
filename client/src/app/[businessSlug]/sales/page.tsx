"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePaginatedSales } from "@/hooks/use-paginated-sales";
import { useStore } from "@/lib/store";
import { fmtMoney } from "@/lib/format";
import { BusyButton, Page, PageTitle, Modal, useToggle, InlineFormError } from "@/components/ui";
import { userFacingError } from "@/lib/user-error";
import { useBusinessHref } from "@/components/BusinessLink";
import SaleDetailModal from "@/components/SaleDetailModal";
import ReceivePaymentModal from "@/components/ReceivePaymentModal";
import SalesTable from "@/components/sales/SalesTable";
import NewSaleModal from "@/components/sales/NewSaleModal";
import PrintPack from "@/components/sales/PrintPack";
import CustomerDuesTab from "@/components/sales/CustomerDuesTab";
import { useSaleDraft } from "@/components/sales/useSaleDraft";
import { productUsesCategories, resolveDefs } from "@/lib/catalogue";
import { useUiPreferences } from "@/lib/preferences";
import Decimal from "decimal.js";
import { toDecimal } from "../../../lib/decimal";

export default function SalesPage() {
  const { sales, customers, inventory, products, categories, attributeDefs, addSale, addCustomer, deleteSale, salePaid, customerBalance, isPending, transactionsReady } = useStore();
  const invoiceList = usePaginatedSales();
  const activeCustomers = customers.filter((customer) => customer.active !== false);
  const api = useSaleDraft();
  const { prefs } = useUiPreferences();
  const businessHref = useBusinessHref();
  const [viewId, setViewId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [tab, setTab] = useState<"invoices" | "dues" | "print">("invoices");
  const duesCustomerCount = useMemo(() => customers.filter((customer) => customerBalance(customer.id) > 0.005).length, [customers, customerBalance]);
  useEffect(() => {
    const initialTab = new URLSearchParams(window.location.search).get("tab");
    if (initialTab !== "dues" && initialTab !== "print") return;
    const frame = window.requestAnimationFrame(() => setTab(initialTab));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // customer add (the only popup left — a secondary action)
  const { open: newCustOpen, onOpen: onNewCustOpen, onClose: onNewCustClose } = useToggle();
  const [newCust, setNewCust] = useState({ name: "", shop: "", phone: "" });
  const [newCustError, setNewCustError] = useState("");

  /* ---- sale header ---- */
  const [existingId, setExistingId] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountPct, setDiscountPct] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [loadingCharges, setLoadingCharges] = useState(0);
  const [transportCharges, setTransportCharges] = useState(0);
  const [labourCharges, setLabourCharges] = useState(0);
  const [paidNow, setPaidNow] = useState(0);
  const [payError, setPayError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [savingSale, setSavingSale] = useState(false);
  const savingSaleRef = useRef(false);
  // One key per sale draft. A retry of the same draft reuses it, so the server
  // returns the sale it already saved instead of creating a duplicate.
  const saleRequestRef = useRef<{ draft: string; id: string } | null>(null);

  /* ---- money on the current draft ---- */
  const subtotal = api.lines.reduce((a, l) => a.plus(toDecimal((Number(l.qty) || 0) * (Number(l.rate) || 0))), new Decimal(0)).toNumber();
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
    setSubmitError("");
    setSaleDate(new Date().toISOString().slice(0, 10));
    setExistingId("");
    setNewOpen(true);
  };

  const saveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name.trim() || isPending("customer:create")) return;
    try {
      const id = await addCustomer({
        name: newCust.name.trim(),
        shop: newCust.shop.trim(),
        phone: newCust.phone.trim(),
      });
      setExistingId(id);
      setNewCust({ name: "", shop: "", phone: "" });
      onNewCustClose();
    } catch (reason) {
      setNewCustError(userFacingError(reason, "Could not add this customer."));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSaleRef.current || !canSave || isPending("sale:create")) return;
    const paying = Number(paidNow) || 0;
    if (paying > grandTotal + 0.001) {
      setPayError(`Amount paid (${fmtMoney(paying)}) can't be more than this sale's total of ${fmtMoney(grandTotal)}.`);
      return;
    }
    savingSaleRef.current = true;
    setSavingSale(true);
    setPayError("");
    setSubmitError("");
    try {
      const draft = {
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
    };
      const draftKey = JSON.stringify(draft);
      if (saleRequestRef.current?.draft !== draftKey) {
        saleRequestRef.current = { draft: draftKey, id: crypto.randomUUID() };
      }
      const saleId = await addSale({ ...draft, clientRequestId: saleRequestRef.current.id });
      saleRequestRef.current = null;
      api.removeAll();
      setNewOpen(false);
      setJustSavedId(saleId);
      setViewId(saleId);
    } catch (reason) {
      setSubmitError(userFacingError(reason, "Could not save this sale. Check stock and try again."));
    } finally {
      savingSaleRef.current = false;
      setSavingSale(false);
    }
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
        title="Sales"
        sub="Create a sale, open it, print it, or take payment"
        action={
          tab === "invoices" ? (
            <button className="btn-primary" onClick={startNewSale}>
              + New Sale
            </button>
          ) : undefined
        }
      />

      <div role="tablist" className="flex gap-6 border-b border-[#E5E5E5] mb-6">
        {([
          ["invoices", "Sales"],
          ["dues", `Customer dues (${duesCustomerCount})`],
          ["print", "Print"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              // Keep the business slug in the URL — a bare /sales would make
              // the router treat "sales" as an unknown tenant and bounce to
              // the dashboard.
              const next = businessHref(key === "invoices" ? "/sales" : `/sales?tab=${key}`);
              window.history.replaceState(null, "", next);
            }}
            className={`min-h-10 pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? "border-ink text-[#171717]" : "border-transparent text-[#171717]/60 hover:text-[#171717]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "invoices" ? (
        <SalesTable
          sales={invoiceList.sales}
          allSales={sales}
          transactionsReady={transactionsReady}
          customerName={customerName}
          customers={customers}
          hasInventory={api.hasStock}
          productOfLine={productOfLine}
          categoryNameOf={categoryNameOf}
          attrRowsOf={attrRowsOf}
          salePaid={salePaid}
          loading={invoiceList.loading}
          error={invoiceList.error}
          onRetry={() => void invoiceList.refetch()}
          listTotal={invoiceList.total}
          page={invoiceList.page}
          totalPages={invoiceList.totalPages}
          onPageChange={invoiceList.setPage}
          onView={(id) => setViewId(id)}
          onReceive={(id) => setPaySaleId(id)}
          onDelete={(id) => deleteSale(id)}
          onNewSale={startNewSale}
        />
      ) : tab === "dues" ? (
        <CustomerDuesTab onReceive={(id) => setPaySaleId(id)} />
      ) : (
        <PrintPack sales={sales} salePaid={salePaid} />
      )}

      <SaleDetailModal
        saleId={viewId}
        onClose={() => {
          setViewId(null);
          setJustSavedId(null);
        }}
        justSaved={!!viewId && viewId === justSavedId}
        onNewSale={() => {
          setViewId(null);
          setJustSavedId(null);
          startNewSale();
        }}
      />
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
        submitting={savingSale || isPending("sale:create")}
        showOptionalDetails={prefs.showOptionalDetails}
        submitError={submitError}
      />

      {/* add customer popup — the only popup left */}
      <Modal open={newCustOpen} onClose={onNewCustClose} busy={isPending("customer:create")} title="New Customer">
        <form onSubmit={saveNewCustomer} className="grid gap-4">
          {newCustError ? <InlineFormError message={newCustError} /> : null}
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
            <button type="button" className="btn-ghost" onClick={onNewCustClose} disabled={isPending("customer:create")}>Cancel</button>
            <BusyButton type="submit" loading={isPending("customer:create")} disabled={!newCust.name.trim()}>
              Add Customer
            </BusyButton>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
