"use client";

import { useRef, useState, type FormEvent } from "react";
import { BusyButton, Page, PageTitle } from "@/components/ui";
import { useAuth, type BusinessProfile } from "@/lib/auth";
import { displayName, roleLabel } from "@/lib/auth-types";
import { useUiPreferences } from "@/lib/preferences";
import { uploadBusinessLogoAction } from "@/app/actions/media";
import { logoSrcFromPrefs } from "@/lib/logo-src";
import { InvoiceBrandHeader } from "@/components/invoice/InvoiceBrandHeader";
import { WarehousePanel } from "@/components/settings/WarehousePanel";

export default function SettingsPage() {
  const { user } = useAuth();
  const { prefs, setPref, patchPrefs } = useUiPreferences();
  const fileRef = useRef<HTMLInputElement>(null);
  const [invoiceName, setInvoiceName] = useState(prefs.invoiceName);
  const [address, setAddress] = useState(prefs.address);
  const [city, setCity] = useState(prefs.city);
  const [phone, setPhone] = useState(prefs.phone);
  const [invoiceEmail, setInvoiceEmail] = useState(prefs.invoiceEmail);
  const [invoiceNote, setInvoiceNote] = useState(prefs.invoiceNote);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");

  const shopName =
    invoiceName.trim() || user?.businessName?.trim() || "Your factory";
  const preview: BusinessProfile = {
    businessName: shopName,
    ownerName: user?.name ?? "",
    address,
    city,
    phone,
    email: invoiceEmail.trim() || user?.email || "",
    logoSrc: logoSrcFromPrefs(prefs) || undefined,
    invoiceNote: invoiceNote.trim() || undefined,
  };

  const markDirty = () => setSaved(false);

  const saveShop = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await patchPrefs({
        invoiceName: invoiceName.trim(),
        address: address.trim(),
        city: city.trim(),
        phone: phone.trim(),
        invoiceEmail: invoiceEmail.trim(),
        invoiceNote: invoiceNote.trim(),
      });
      setSaved(true);
    } catch {
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const onPickLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoBusy(true);
    setLogoError("");
    try {
      const payload = new FormData();
      payload.append("logo", file);
      const upload = await uploadBusinessLogoAction(payload);
      if (!upload.ok) throw new Error(upload.error);
      await patchPrefs({ logoUrl: upload.url, logoDataUrl: "" });
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Could not use that image.");
    } finally {
      setLogoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Page>
      <PageTitle title="Settings" sub="Shop setup — bills, forms, and where stock sits." />

      <section className="panel p-5 mb-4">
        <h2 className="text-sm font-semibold text-[#171717]">Bills & invoices</h2>
        <p className="text-[13px] text-[#171717]/70 mt-1 mb-4">
          Your factory logo shows in the menu and on bills. If there is no logo, bills show the factory name instead.
        </p>

        <div className="mb-6 max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.12em] font-medium text-[#171717] mb-2">
            Factory logo
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-20 w-40 border border-[#e5e5e5] bg-white flex items-center justify-center p-2">
              {logoSrcFromPrefs(prefs) ? (
                <img
                  src={logoSrcFromPrefs(prefs)}
                  alt={shopName}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <p className="text-[12px] text-[#171717]/70 text-center px-2">No logo yet</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => void onPickLogo(e.target.files?.[0])}
              />
              <BusyButton
                type="button"
                loading={logoBusy}
                onClick={() => fileRef.current?.click()}
              >
                {logoSrcFromPrefs(prefs) ? "Change logo" : "Add logo"}
              </BusyButton>
              {logoSrcFromPrefs(prefs) ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    void patchPrefs({ logoUrl: "", logoDataUrl: "" });
                    setLogoError("");
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-[12px] text-[#171717]/70 mt-2">PNG, JPG or WebP. Under 8 MB.</p>
          {logoError ? (
            <p className="text-[13px] text-[#a12b1f] mt-2">{logoError}</p>
          ) : null}
        </div>

        <form onSubmit={saveShop} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <label className="block sm:col-span-2">
            Factory name on bills
            <input
              value={invoiceName}
              onChange={(e) => {
                setInvoiceName(e.target.value);
                markDirty();
              }}
              placeholder={user?.businessName || "Factory name"}
              className="mt-1"
            />
          </label>
          <label className="block sm:col-span-2">
            Address
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                markDirty();
              }}
              placeholder="Street, area"
              className="mt-1"
            />
          </label>
          <label className="block">
            City
            <input
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                markDirty();
              }}
              placeholder="Lahore"
              className="mt-1"
            />
          </label>
          <label className="block">
            Phone
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                markDirty();
              }}
              placeholder="0300 1234567"
              className="mt-1"
            />
          </label>
          <label className="block sm:col-span-2">
            Email on bills
            <input
              type="email"
              value={invoiceEmail}
              onChange={(e) => {
                setInvoiceEmail(e.target.value);
                markDirty();
              }}
              placeholder={user?.email || "shop@email.com"}
              className="mt-1"
            />
          </label>
          <label className="block sm:col-span-2">
            Line at the bottom of the bill
            <input
              value={invoiceNote}
              onChange={(e) => {
                setInvoiceNote(e.target.value);
                markDirty();
              }}
              placeholder="Thank you for your business."
              className="mt-1"
            />
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <BusyButton type="submit" loading={saving}>
              Save bill details
            </BusyButton>
            {saved ? <p className="text-[13px] text-[#171717]">Saved.</p> : null}
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-[#e5e5e5]">
          <p className="text-[11px] uppercase tracking-[0.12em] font-medium text-[#171717] mb-3">
            Bill preview
          </p>
          <div className="border border-[#e5e5e5] bg-white px-6 py-5 max-w-2xl">
            <InvoiceBrandHeader business={preview} />
            <p className="text-[11px] text-[#171717]/70 text-center mt-6 pt-3 border-t border-[#e5e5e5]">
              {preview.invoiceNote || "Thank you for your business."}
            </p>
          </div>
        </div>
      </section>

      <section className="panel p-5 mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#171717]">Purchase & sale forms</h2>
          <p className="text-[13px] text-[#171717]/70 mt-1">
            Extra fields on those forms — lot numbers, heat/batch, warehouse, and source lots.
          </p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer !mb-0 !normal-case shrink-0">
          <span className="text-[13px] text-[#171717]">Show extra fields</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.showOptionalDetails}
            onClick={() => setPref("showOptionalDetails", !prefs.showOptionalDetails)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              prefs.showOptionalDetails ? "bg-[#171717]" : "bg-[#e5e5e5]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                prefs.showOptionalDetails ? "translate-x-5" : ""
              }`}
            />
          </button>
        </label>
      </section>

      <section className="mb-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[#171717]">Warehouses & locations</h2>
          <p className="text-[13px] text-[#171717]/70 mt-1">
            Optional — for lot tracking in Inventory.
          </p>
        </div>
        <WarehousePanel />
      </section>

      {user ? (
        <section className="panel p-5">
          <h2 className="text-sm font-semibold text-[#171717]">Your login</h2>
          <p className="text-[13px] text-[#171717]/70 mt-1 mb-4">
            Sign-in details for this shop.
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#171717] max-w-2xl">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] font-medium">Name</dt>
              <dd className="mt-0.5 font-medium">{displayName(user)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] font-medium">Email</dt>
              <dd className="mt-0.5 font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] font-medium">Role</dt>
              <dd className="mt-0.5 font-medium">{roleLabel(user.role)}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </Page>
  );
}
