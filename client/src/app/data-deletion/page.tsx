import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/PublicPages";
import { CONTACT_EMAIL, publicPageMetadata } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  path: "/data-deletion",
  title: "Data Deletion",
  description:
    "How to ask Tijartt to delete your business account and data, including WhatsApp message records, what gets deleted, and how long it takes.",
});

export default function Page() {
  return (
    <LegalPage
      title="Data deletion"
      intro="How to ask us to delete your Tijartt account and data, including data from WhatsApp messages."
      updated="October 29, 2026"
      sections={[
        {
          title: "How to request deletion",
          paragraphs: ["If you own a business account on Tijartt:"],
          bullets: [
            `Email ${CONTACT_EMAIL} from the owner's registered email address.`,
            'Use the subject "Data deletion request" and include your business name.',
            "We confirm the request with you by email before deleting anything.",
            "We delete the data within 30 days and email you when it is done.",
          ],
        },
        {
          title: "What we delete",
          paragraphs: ["Everything linked to the business account:"],
          bullets: [
            "The owner and staff logins.",
            "Products, stock, purchases, sales bills, payments, expenses and reports.",
            "Customer and supplier details.",
            "The business logo and settings.",
            "WhatsApp message records: phone numbers, message content and delivery status.",
          ],
        },
        {
          title: "What we may keep",
          paragraphs: [
            "We keep only records the law requires us to keep, for as long as it requires. Copies in backups are removed as those backups expire.",
          ],
        },
        {
          title: "If you are a customer of a business on Tijartt",
          paragraphs: [
            `A business that uses Tijartt controls the records it keeps about you, so ask that business first. You can also email ${CONTACT_EMAIL} with your phone number and the business name, and we will help.`,
            "To stop WhatsApp messages, tell the business, email us, or block the number in WhatsApp.",
          ],
        },
      ]}
    />
  );
}
