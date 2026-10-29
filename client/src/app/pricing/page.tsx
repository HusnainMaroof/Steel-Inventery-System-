import type { Metadata } from "next";
import { PricingPage } from "@/components/marketing/PublicPages";
import { publicPageMetadata } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  path: "/pricing",
  title: "Pricing: Monthly, Yearly and Lifetime Plans",
  description:
    "Monthly, yearly and lifetime plans for Tijartt inventory and khata software. Pick the modules your business needs, from purchases and sales to reports and staff logins.",
});

export default function Page() {
  return <PricingPage />;
}
