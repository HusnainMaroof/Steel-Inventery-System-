"use client";

import { useRef, useState, type FormEvent } from "react";
import { BusyButton, Page, PageTitle, InlineFormError } from "@/components/ui";
import { userFacingError } from "@/lib/user-error";
import { useAuth, type BusinessProfile } from "@/lib/auth";
import { displayName, roleLabel } from "@/lib/auth-types";
import { useUiPreferences } from "@/lib/preferences";
import { uploadBusinessLogoAction } from "@/app/actions/media";
import { MAX_LOGO_BYTES } from "@/lib/logo-limits";
import { logoSrcFromPrefs } from "@/lib/logo-src";
import { InvoiceBrandHeader } from "@/components/invoice/InvoiceBrandHeader";

export default function SettingsPage() {
  const { user } = useAuth();
  const { prefs, patchPrefs } = useUiPreferences();
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
  const [saveError, setSaveError] = useState("");

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
    setSaveError("");
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
    } catch (reason) {
      setSaved(false);
      setSaveError(userFacingError(reason, "Could not save shop details."));
    } finally {
      setSaving(false);
    }
  };

  const onPickLogo = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("This image is larger than 8 MB. Choose a smaller file.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
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
      <PageTitle title="Settings" meta="Logo and bill details" />

      <section className="border border-[#E5E5E5] bg-white rounded-2xl p-5 sm:p-6 mb-6">
        <h2 className="text-[16px] font-bold text-[#171717]">Bills & invoices</h2>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-6 lg:gap-8 items-start">
          <div className="min-w-0">
            <div className="mb-6">
              <p className="text-[14px] font-semibold text-[#171717] mb-2">
                Factory logo
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-20 w-40 rounded-2xl border border-[#E5E5E5] bg-white flex items-center justify-center p-2">
                  {logoSrcFromPrefs(prefs) ? (
                    <img
                      src={logoSrcFromPrefs(prefs)}
                      alt={shopName}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <p className="text-[12px] text-[#171717]/70 text-center px-2">Your logo</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
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
              <p className="text-[13px] text-[#171717]/70 mt-2">PNG, JPG or WebP. Under 8 MB.</p>
              {logoError ? (
                <p className="text-[13px] font-medium text-destructive mt-2">{logoError}</p>
              ) : null}
            </div>

            <form onSubmit={saveShop} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
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
                {saveError ? <InlineFormError message={saveError} /> : null}
                {saved ? <p className="text-[13px] text-[#171717]">Saved.</p> : null}
              </div>
            </form>
          </div>

          <div className="mt-6 pt-5 border-t border-[#E5E5E5] lg:mt-0 lg:pt-0 lg:border-t-0 lg:sticky lg:top-6">
            <p className="text-[14px] font-semibold text-[#171717] mb-3">
              Bill preview
            </p>
            <div className="border border-[#E5E5E5] bg-white rounded-2xl px-6 py-5">
              <InvoiceBrandHeader business={preview} />
              <p className="text-xs text-[#171717]/70 text-center mt-6 pt-3 border-t border-[#E5E5E5]">
                {preview.invoiceNote || "Thank you for your business."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {user ? (
      <section className="border border-[#E5E5E5] bg-white rounded-2xl p-5 sm:p-6">
        <h2 className="text-[16px] font-bold text-[#171717]">Your login</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#171717] max-w-2xl">
          <div>
            <dt className="text-[13px] font-medium text-[#171717]">Name</dt>
            <dd className="mt-0.5 font-medium">{displayName(user)}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-medium text-[#171717]">Email</dt>
            <dd className="mt-0.5 font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-medium text-[#171717]">Role</dt>
            <dd className="mt-0.5 font-medium">{roleLabel(user.role)}</dd>
          </div>
        </dl>
      </section>
      ) : null}
    </Page>
  );
}
