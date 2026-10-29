import type { Metadata } from "next";

export const SITE_URL = "https://www.tijartt.com";
export const SITE_NAME = "Tijartt";
export const CONTACT_EMAIL = "contact@tijartt.com";

export const SITE_TITLE = "Tijartt: Inventory, Billing and Khata Software for Traders";
export const SITE_DESCRIPTION =
  "Tijartt is inventory, billing and khata software for traders. Track stock, sales bills, customer dues, supplier payments and profit in one simple ledger.";

export const OG_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "Tijartt, inventory, billing and khata software for traders",
};

/** Title, description, canonical and full Open Graph tags for one public page. */
export function publicPageMetadata({
  path,
  title,
  description,
  absoluteTitle = false,
}: {
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
}): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: path,
      title: absoluteTitle ? title : `${title} | ${SITE_NAME}`,
      description,
      images: [OG_IMAGE],
    },
  };
}
