import type { Metadata } from "next";
import { FocusedLandingPage } from "@/components/marketing/FocusedLandingPage";
import {
  CONTACT_EMAIL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  publicPageMetadata,
} from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  path: "/",
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  absoluteTitle: true,
});

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
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        email: CONTACT_EMAIL,
        url: `${SITE_URL}/contact`,
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Inventory and billing software",
      operatingSystem: "Web browser",
      description: SITE_DESCRIPTION,
      featureList: [
        "Purchases with landed cost",
        "Stock by product, variant and lot",
        "Numbered sales bills with your logo",
        "Customer dues and supplier payables",
        "Expenses",
        "Profit, stock, cash and dues reports with Excel and PDF export",
        "Staff logins with page access",
      ],
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
