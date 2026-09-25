"use client";

import type { FormEvent } from "react";
import { BusyButton, Modal } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import PurchaseItemForm from "./PurchaseItemForm";
import PurchaseSummaryPanel from "./PurchaseSummaryPanel";
import type { PurchaseDraftApi } from "./usePurchaseDraft";

export default function NewPurchaseModal({
  open,
  onClose,
  onSubmit,
  purchaseDate,
  setPurchaseDate,
  supplierId,
  setSupplierId,
  suppliers,
  api,
  formError,
  showOptionalDetails = false,
  submitting = false,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  purchaseDate: string;
  setPurchaseDate: (d: string) => void;
  supplierId: string;
  setSupplierId: (id: string) => void;
  suppliers: { id: string; name: string }[];
  api: PurchaseDraftApi;
  formError?: string;
  showOptionalDetails?: boolean;
  submitting?: boolean;
}) {
  const supplierLabel = suppliers.find((s) => s.id === supplierId)?.name ?? "supplier";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add purchase"
      subtitle="One item per purchase — stock updates when you save"
      full
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <BusyButton type="submit" form="new-purchase-form" loading={submitting} disabled={!api.canSave}>
            Save purchase
          </BusyButton>
        </div>
      }
    >
      <form id="new-purchase-form" noValidate onSubmit={onSubmit}>
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-[#f0d2cc] bg-[#fdf1ef] text-[#a12b1f] text-[13px] px-4 py-3 mb-5"
          >
            {formError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 xl:gap-8 items-start">
          <div className="min-w-0 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label>Date</label>
                <DatePicker
                  value={purchaseDate}
                  onChange={setPurchaseDate}
                  ariaLabel="Purchase date"
                  disableFuture
                />
              </div>
              <div>
                <label htmlFor="purchase-supplier">Supplier</label>
                <select
                  id="purchase-supplier"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full"
                >
                  {suppliers.length === 0 && <option value="">No suppliers yet</option>}
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <PurchaseItemForm api={api} showOptionalDetails={showOptionalDetails} />
          </div>

          <div className="min-w-0 xl:sticky xl:top-0">
            <PurchaseSummaryPanel api={api} supplierName={supplierLabel} hideSubmit />
          </div>
        </div>
      </form>
    </Modal>
  );
}
