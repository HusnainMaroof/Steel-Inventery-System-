import type { Metadata } from "next";
import { FocusedLandingPage } from "@/components/marketing/FocusedLandingPage";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site";

const homeDescription =
  "Track stock, purchases, sales, customer dues, supplier payments and profit in one simple ledger. Made for steel, cement, wire, paint and tiles traders.";

export const metadata: Metadata = {
  title: { absolute: "Tijartt | Stock, Sales and Dues Ledger for Traders" },
  description: homeDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Tijartt | Stock, Sales and Dues Ledger for Traders",
    description: homeDescription,
    url: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/images/tijartt-logo.png`,
      email: CONTACT_EMAIL,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: homeDescription,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <FocusedLandingPage />
    </>
  );
}
