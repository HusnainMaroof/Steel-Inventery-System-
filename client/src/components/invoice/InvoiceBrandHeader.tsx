import type { BusinessProfile } from "@/lib/auth";

export function InvoiceBrandHeader({ business }: { business: BusinessProfile }) {
  const line = [business.address, business.city, business.phone, business.email]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0">
      <img
        src={business.logoSrc || "/images/logo.png"}
        alt={business.logoSrc ? business.businessName : "Logo"}
        title={business.businessName}
        className="h-20 w-auto max-w-full object-contain object-left"
      />
      {!business.logoSrc ? (
        <p className="text-[18px] font-bold tracking-tight text-[#171717] leading-tight mt-2">
          {business.businessName}
        </p>
      ) : null}
      {line ? (
        <p className="text-[12px] text-[#171717]/70 mt-2 leading-relaxed">{line}</p>
      ) : null}
    </div>
  );
}
