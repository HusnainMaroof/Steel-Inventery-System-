import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/PublicPages";
import { CONTACT_EMAIL, publicPageMetadata } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  path: "/privacy-policy",
  title: "Privacy Policy",
  description:
    "What information Tijartt collects, how it is used, shared and protected, how WhatsApp messages are handled, how long data is kept and how to ask for deletion.",
});

export default function Page() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="This policy explains what information Tijartt collects, why, who it is shared with, how it is protected, and the choices you have."
      updated="October 29, 2026"
      sections={[
        {
          title: "Who we are",
          paragraphs: [
            `Tijartt is inventory, billing and khata software for traders. It is run by a sole proprietor based in Pakistan. In this policy "Tijartt", "we" and "us" mean that operator. You can reach us at ${CONTACT_EMAIL}.`,
            'A business that uses Tijartt (the "business") decides what records to keep about its own customers, suppliers and staff. For those records the business is responsible for the data, and Tijartt processes it on the business\'s behalf to run the service.',
          ],
        },
        {
          title: "Information we collect",
          paragraphs: ["We only collect what the service needs:"],
          bullets: [
            "Account details: the owner's and staff members' names, email addresses, job titles and sign-in details, and the business name, logo and the contact details the business chooses to print on its bills.",
            "Business records entered by the business: products, stock, purchases, sales bills, payments, expenses, stock checks and reports.",
            "Customer and supplier details entered by the business: names, shop or mill names, phone numbers and balances owed.",
            "WhatsApp messaging data, when the business uses it: the recipient's phone number, the content of bills, reminders and support messages, and delivery and read status reported by WhatsApp.",
            "Technical data: one sign-in cookie, and basic request records such as IP address and time, used for security and to limit abuse.",
          ],
        },
        {
          title: "How we use information",
          paragraphs: [
            "We use information to sign users in, run the features the business uses (stock, bills, dues, payments, reports, staff access), send WhatsApp messages the business asks us to send, answer support requests, and keep the service secure and working.",
            "We do not sell personal information. We do not use business records or messages for advertising, and we do not build marketing profiles of anyone.",
          ],
        },
        {
          title: "WhatsApp messages (Meta)",
          paragraphs: [
            "Tijartt can send messages through the WhatsApp Business Platform, which is provided by Meta. We use it for three things: sending a sales bill to the business's customer, sending that customer a reminder about an unpaid balance, and support conversations between Tijartt and its users.",
            "To deliver a message, the recipient's phone number and the message content are passed to WhatsApp. WhatsApp handles that data under its own terms and privacy policy. We receive delivery and read status and any reply, and we use them only to show message status and to answer the conversation.",
            "A business must only message customers who have agreed to receive messages from it. Anyone who no longer wants messages can tell the business, contact us, or block the number in WhatsApp, and we will stop sending to that number.",
          ],
        },
        {
          title: "Who we share information with",
          paragraphs: [
            "We share information only with providers that help us run the service, and only what each one needs:",
          ],
          bullets: [
            "Neon, which hosts our database.",
            "Cloudinary, which stores business logo images.",
            "Meta (WhatsApp Business Platform), which delivers WhatsApp messages.",
            "Our server hosting provider, which runs the application.",
          ],
        },
        {
          title: "Where information is stored",
          paragraphs: [
            "Our providers may store and process information on servers outside Pakistan. We choose providers that protect information with industry-standard security and use it only to provide their service to us.",
          ],
        },
        {
          title: "How we protect information",
          paragraphs: ["We use these safeguards:"],
          bullets: [
            "All traffic is encrypted with HTTPS.",
            "Passwords are stored only as one-way hashes, never in plain text.",
            "The sign-in cookie cannot be read by page scripts and is never sent to other sites.",
            "Each business's records are kept separate. A business's logins can only read that business's records.",
            "Owners choose which pages each staff member can open, and signing out ends a session immediately.",
          ],
        },
        {
          title: "How long we keep information",
          paragraphs: [
            "We keep information while the business account is active. After an account is closed we delete its information within 30 days, except records the law requires us to keep. Copies in backups are removed as those backups expire.",
          ],
        },
        {
          title: "Your choices and rights",
          paragraphs: [
            `A business owner can ask us to access, correct, export or delete the business's information by emailing ${CONTACT_EMAIL} from the owner's registered email. Full steps are on the data deletion page at tijartt.com/data-deletion.`,
            "If you are a customer, supplier or staff member of a business that uses Tijartt, contact that business first, as it controls those records. You can also email us and we will help.",
          ],
        },
        {
          title: "Cookies",
          paragraphs: [
            "Tijartt uses one cookie to keep you signed in. We do not use advertising or tracking cookies.",
          ],
        },
        {
          title: "Children",
          paragraphs: ["Tijartt is a business tool and is not meant for anyone under 18."],
        },
        {
          title: "Changes to this policy",
          paragraphs: [
            "We update this policy when the service or the law changes. The current version and its date are always on this page.",
          ],
        },
      ]}
    />
  );
}
