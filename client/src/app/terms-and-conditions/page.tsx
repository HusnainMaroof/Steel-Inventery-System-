import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/PublicPages";
import { CONTACT_EMAIL, publicPageMetadata } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  path: "/terms-and-conditions",
  title: "Terms and Conditions",
  description:
    "The terms for using Tijartt, including accounts and plans, WhatsApp messaging rules, your records, account security, closing an account and governing law.",
});

export default function Page() {
  return (
    <LegalPage
      title="Terms and conditions"
      intro="These terms apply to everyone who uses Tijartt. By using the service you agree to them."
      updated="October 29, 2026"
      sections={[
        {
          title: "Who provides Tijartt",
          paragraphs: [
            `Tijartt is provided by a sole proprietor based in Pakistan ("Tijartt", "we", "us"). Contact: ${CONTACT_EMAIL}.`,
          ],
        },
        {
          title: "The service",
          paragraphs: [
            "Tijartt is software for keeping business records: stock, purchases, sales bills, payments, dues, expenses and reports, with optional WhatsApp messaging. It helps you run your business. It is not accounting, tax or legal advice.",
          ],
        },
        {
          title: "Accounts and plans",
          paragraphs: [
            "Accounts are set up by the Tijartt team for a business owner. The owner can create staff logins and choose which pages each one can open. Access depends on an active plan (monthly, yearly, lifetime or an agreed period). When a plan ends, sign-in stops until it is renewed. Your records are not deleted because a plan ended.",
          ],
        },
        {
          title: "Your records",
          paragraphs: [
            "The records you enter belong to your business. We process them only to provide the service, as described in our privacy policy.",
            "You are responsible for the accuracy of what you enter, and for having a lawful reason to keep information about your customers, suppliers and staff.",
          ],
        },
        {
          title: "WhatsApp messaging",
          paragraphs: ["If you use Tijartt to send WhatsApp messages, you agree to these rules:"],
          bullets: [
            "Only message customers who have agreed to receive messages from your business.",
            "Use messages for bills, payment reminders and service conversations. Do not send spam, bulk promotions or misleading content.",
            "Stop messaging anyone who asks you to stop.",
            "Follow the WhatsApp Business Messaging Policy and Meta's terms.",
          ],
        },
        {
          title: "Acceptable use",
          paragraphs: [
            "Use Tijartt only for lawful business purposes. Do not try to access another business's records, disrupt the service, or use it to store or send unlawful material. We may suspend an account or its messaging if it breaks these terms.",
          ],
        },
        {
          title: "Account security",
          paragraphs: [
            "Keep your sign-in details private and remove staff access that is no longer needed. Tell us at once if you think someone has used your account without permission.",
          ],
        },
        {
          title: "Availability",
          paragraphs: [
            "We work to keep Tijartt available and reliable, but it may sometimes be unavailable for maintenance or for reasons outside our control. Features may change as the product grows.",
          ],
        },
        {
          title: "Closing your account",
          paragraphs: [
            `To close your account, email ${CONTACT_EMAIL} from the owner's registered email. Ask for an export of your records first if you need one. After closure we delete your information within 30 days, as set out in our privacy policy and on the data deletion page.`,
          ],
        },
        {
          title: "Liability",
          paragraphs: [
            "As far as the law allows, Tijartt is provided as it is, without a promise that it will meet every business need or run without interruption, and we are not liable for indirect losses. Nothing in these terms limits a right or liability that the law does not allow to be limited.",
          ],
        },
        {
          title: "Governing law",
          paragraphs: ["These terms are governed by the laws of Pakistan."],
        },
        {
          title: "Changes to these terms",
          paragraphs: [
            "We may update these terms when the service or the law changes. The current version and its date are always on this page. Using Tijartt after a change means you accept the updated terms.",
          ],
        },
      ]}
    />
  );
}
