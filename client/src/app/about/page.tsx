import type { Metadata } from "next";
import { ScrollFocusImage } from "@/components/motion/ScrollFocusImage";
import { PublicPageShell } from "@/components/marketing/PublicChrome";
import { CONTACT_EMAIL } from "@/lib/site";
import {
  reveal,
  Container,
  PanelHero,
  SectionHeader,
  PanelCta,
  CtaLink,
  TextLink,
  RowList,
  Steps,
} from "@/components/marketing/PublicKit";

export const metadata: Metadata = {
  title: "About",
  description: "What Tijartt is, why it exists, and how a business account is set up.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About | Tijartt",
    description: "What Tijartt is, why it exists, and how a business account is set up.",
    url: "/about",
    images: ["/opengraph-image.png"],
  },
};

const modules: Array<[string, string]> = [
  ["Dashboard", "The figures that matter, first."],
  ["Products", "Categories, attributes, variants."],
  ["Purchases", "Landed cost included."],
  ["Inventory", "Lots, movements, stock checks."],
  ["Sales and invoices", "Printed bills. Numbers never reused."],
  ["Customers", "What each one owes."],
  ["Suppliers / Mills", "What you still have to pay."],
  ["Payments", "Oldest unpaid settled first."],
  ["Expenses", "For the shop or one product."],
  ["Reports", "Profit, stock, cash, dues."],
  ["Staff", "Logins with the pages you choose."],
  ["Settings", "Invoice and display options."],
];

const principles = [
  "Stock and dues come from real records.",
  "Each business sees only its own records.",
  "No ads, no tracking. Records are never sold.",
  "Sign-in lasts up to 12 hours. Sign out ends every session.",
  "A backup before every update.",
  "Money in Pakistani rupees.",
];

const accountSteps = [
  { title: "We create your account", text: "Set up with you. Login handed over." },
  { title: "Pick a plan", text: "Monthly, yearly, lifetime or custom." },
  { title: "Add your staff", text: "Each with the pages you allow." },
];

export default function Page() {
  return (
    <PublicPageShell>
      <main id="main-content">
        <PanelHero
          eyebrow="About Tijartt"
          title="A plain record for traders."
          actions={
            <>
              <CtaLink href="/contact">Talk to the team</CtaLink>
              <TextLink href={`mailto:${CONTACT_EMAIL}?subject=Tijartt%20enquiry`} onPanel>
                Email {CONTACT_EMAIL}
              </TextLink>
            </>
          }
          aside={
            <ScrollFocusImage
              src="/images/feature-dashboard.png"
              alt="Three Tijartt tiles for stock, bills and sales"
              width={1774}
              height={887}
              priority
            />
          }
        />

        <section className="py-16 sm:py-20">
          <Container className="grid gap-6">
            <div>
              <SectionHeader title="Why Tijartt exists" />
            </div>
            <div className={`${reveal} max-w-[22ch] text-[clamp(28px,3.6vw,48px)] leading-[1.1] font-semibold tracking-[-0.035em] text-[#171717]`}>
              <p>
                What did I buy. What did I sell. Who owes me. Answered in the words used behind the counter.
              </p>
            </div>
          </Container>
        </section>

        <section className="py-16 sm:py-20">
          <Container className="grid gap-6">
            <div>
              <SectionHeader title="Modules" />
            </div>
            <div className="mt-10">
              <RowList
                rows={modules.map(([title, text]) => ({ title, text }))}
              />
            </div>
          </Container>
        </section>

        <section className="py-16 sm:py-20">
          <Container>
            <SectionHeader title="How it starts" />
            <div className="mt-10">
              <Steps
                steps={accountSteps.map(({ title, text }) => ({ title, text }))}
              />
            </div>
          </Container>
        </section>

        <section className="py-16 sm:py-20">
          <Container className="grid gap-6">
            <div>
              <SectionHeader title="What we hold to" />
            </div>
            <div>
              <RowList
                numbered
                rows={principles.map((title) => ({ title }))}
              />
            </div>
          </Container>
        </section>

        <PanelCta
          title="Talk to us."
          actions={<CtaLink href="/contact">Contact Tijartt</CtaLink>}
        />
      </main>
    </PublicPageShell>
  );
}