import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/PublicPages";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Tijartt collects, uses and protects your business records, customer details and account information when you use the service.",
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    title: "Privacy Policy | Tijartt",
    description:
      "How Tijartt collects, uses and protects your business records, customer details and account information when you use the service.",
    url: "/privacy-policy",
    images: ["/opengraph-image.png"],
  },
};

export default function Page() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="This policy explains how Tijartt handles information when you use our business management service."
      updated="September 25, 2026"
      sections={[
        {
          title: "Information used by the service",
          paragraphs: [
            "Tijartt processes the account details and business records needed to provide the service. These may include contact and sign-in details, product and stock records, purchases, sales, invoices, payments, and information about customers, suppliers, and staff entered by your business.",
            "The business using Tijartt is responsible for ensuring it has an appropriate reason to enter information about its customers, suppliers, and staff, and for providing any notices required by local law.",
          ],
        },
        {
          title: "How information is used",
          paragraphs: [
            "Information is used to authenticate users, operate business features, keep records available to the authorised business, maintain the security and reliability of the service, and respond to support requests.",
            "Tijartt does not sell business records or use them to serve advertising. Access is limited to authorised users and to service operations that require it.",
          ],
        },
        {
          title: "Access, security, and retention",
          paragraphs: [
            "Businesses control staff access through their accounts and should use strong passwords and remove access when it is no longer needed. No online service can guarantee absolute security, but reasonable safeguards are used to protect information from unauthorised access or loss.",
            "Records are retained while needed to provide the service and support the business account. A business owner can contact us to ask about access, correction, export, or deletion of information, subject to applicable record-keeping requirements.",
          ],
        },
        {
          title: "Service providers and changes",
          paragraphs: [
            "Tijartt may rely on carefully selected providers to host, secure, and operate the service. Those providers may process information only to deliver their services to Tijartt and are expected to protect it.",
            "This policy may change as the service or applicable requirements change. The current version will be published on this page with its revision date.",
          ],
        },
      ]}
    />
  );
}
