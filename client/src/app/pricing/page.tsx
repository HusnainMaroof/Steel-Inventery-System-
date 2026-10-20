import type { Metadata } from "next";
import { PricingPage } from "@/components/marketing/PublicPages";

export const metadata: Metadata = {
  title: "Pricing and Plans",
  description:
    "Monthly, yearly and lifetime plans for Tijartt. Pick the modules your business needs, from purchases and sales to reports and staff logins.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing and Plans | Tijartt",
    description:
      "Monthly, yearly and lifetime plans for Tijartt. Pick the modules your business needs, from purchases and sales to reports and staff logins.",
    url: "/pricing",
    images: ["/opengraph-image.png"],
  },
};

export default function Page() {
  return <PricingPage />;
}
