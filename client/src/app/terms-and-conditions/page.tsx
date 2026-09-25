import { LegalPage } from "@/components/marketing/PublicPages";

export const metadata = {
  title: "Terms and Conditions | Tijaratt",
  description: "Terms for accessing and using Tijaratt.",
};

export default function Page() {
  return (
    <LegalPage
      title="Terms and conditions"
      intro="These terms set out the responsibilities that come with using Tijaratt. By accessing the service, you agree to use it lawfully and keep your account secure."
      updated="September 25, 2026"
      sections={[
        {
          title: "Using Tijaratt",
          paragraphs: [
            "Tijaratt provides tools for keeping business records, including stock, purchases, sales, invoices, payments, and reports. The service is provided to support your operations; it is not a substitute for professional accounting, tax, or legal advice.",
            "You may use the service only for lawful business purposes and in line with these terms. Do not attempt to disrupt the service, gain access to another account, or use Tijaratt to store or share unlawful material.",
          ],
        },
        {
          title: "Your account and records",
          paragraphs: [
            "You are responsible for the accuracy of information entered into your account, protecting sign-in details, and deciding which staff members can access business records. Tell us promptly if you believe an account has been accessed without permission.",
            "Your business retains responsibility for its records and for meeting applicable requirements to retain invoices, transaction histories, and personal information. Keep appropriate backups of records important to your business.",
          ],
        },
        {
          title: "Availability and changes",
          paragraphs: [
            "We work to keep Tijaratt reliable, but the service may sometimes be unavailable for maintenance, updates, or reasons outside our control. Features may change as the product develops, and we will take reasonable care not to make unnecessary disruption to normal use.",
            "If you no longer want to use Tijaratt, contact us about your account and available record export or closure options. Certain information may need to be retained where required by law or for legitimate security purposes.",
          ],
        },
        {
          title: "Liability and updates to these terms",
          paragraphs: [
            "To the extent permitted by law, Tijaratt is provided without a guarantee that it will meet every specific business need or operate without interruption. Nothing in these terms limits rights or liabilities that cannot legally be limited.",
            "We may update these terms when the service or applicable requirements change. The latest version and revision date will appear on this page. Continued use after an update means you accept the updated terms.",
          ],
        },
      ]}
    />
  );
}
