import type { BusinessProfile } from "@/lib/auth";

export function InvoiceBrandHeader({ business }: { business: BusinessProfile }) {
  const line = [business.address, business.city, business.phone, business.email]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0">
      {business.logoSrc ? (
        <img
          src={business.logoSrc}
          alt={business.businessName}
          title={business.businessName}
          className="h-20 w-auto max-w-full object-contain object-left"
        />
      ) : (
        <p className="text-[22px] font-bold tracking-tight text-[#171717] leading-tight">
          {business.businessName}
        </p>
      )}
      {line ? (
        <p className="text-[12px] text-[#171717]/70 mt-2 leading-relaxed">{line}</p>
      ) : null}
    </div>
  );
}
