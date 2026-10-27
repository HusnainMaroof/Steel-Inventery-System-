import { PublicPageShell } from "@/components/marketing/PublicChrome";
import {
  btnOnPanel,
  Container,
  CtaLink,
  eyebrow,
  PanelCta,
  PanelHero,
  reveal,
  RowList,
  SectionHeader,
  Steps,
  TextLink,
} from "@/components/marketing/PublicKit";
import { CONTACT_EMAIL } from "@/lib/site";

const included = [
  "Dashboard",
  "Purchases",
  "Products",
  "Inventory",
  "Sales & Invoices",
  "Customers",
  "Mills / Suppliers",
  "Payments",
  "Expenses",
  "Profit & Reports",
  "Staff",
  "Settings",
] as const;

const plans = [
  { name: "Monthly", billing: "Every month" },
  { name: "Yearly", billing: "Every year" },
  { name: "Lifetime access", billing: "No expiry date" },
  { name: "Custom duration", billing: "An agreed period" },
] as const;

const steps = [
  {
    title: "Tell us",
    text: "What you sell, and how many logins.",
  },
  {
    title: "We set it up",
    text: "Your account, with your modules.",
  },
  {
    title: "Sign in",
    text: "Add staff. Choose their pages.",
  },
];

export function PricingPage() {
  return (
    <PublicPageShell>
      <main id="main-content">
        <PanelHero
          eyebrow="Pricing"
          title="Plans"
          intro="Price on request."
          actions={
            <>
              <CtaLink href="/contact">Ask about a plan</CtaLink>
              <TextLink
                href={`mailto:${CONTACT_EMAIL}?subject=Tijartt%20pricing%20enquiry`}
                onPanel
              >
                Email {CONTACT_EMAIL}
              </TextLink>
            </>
          }
        />

        <section className="py-16 sm:py-20">
          <Container className="grid gap-6">
            <SectionHeader title="Billing" />
            <div>
              <RowList
                rows={plans.map((plan) => ({
                  title: plan.name,
                  text: plan.billing,
                  href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Tijartt ${plan.name} plan`)}`,
                  action: "Ask",
                }))}
              />
            </div>
          </Container>
        </section>

        <section className="py-16 sm:py-20">
          <Container className="grid gap-6">
            <SectionHeader title="Included" />
            <ul className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
              {included.map((label) => (
                <li
                  className="border-t border-line pt-3 text-[clamp(18px,1.8vw,22px)] font-semibold tracking-[-0.02em] text-[#171717]"
                  key={label}
                >
                  {label}
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section className="py-16 sm:py-20">
          <Container>
            <SectionHeader title="How it starts" />
            <div className="mt-10">
              <Steps steps={steps} />
            </div>
          </Container>
        </section>

        <PanelCta
          title="Choose your plan."
          actions={
            <>
              <CtaLink href="/contact">Contact Tijartt</CtaLink>
              <TextLink href="/login" onPanel>
                Log in
              </TextLink>
            </>
          }
        />
      </main>
    </PublicPageShell>
  );
}

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export function LegalPage({
  title,
  intro,
  sections,
  updated,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
  updated: string;
}) {
  return (
    <PublicPageShell>
      <main id="main-content">
        <PanelHero
          eyebrow="Policies"
          title={title}
          intro={intro}
          actions={
            <span className="text-[14px] text-white">Last updated {updated}</span>
          }
        />

        <Container className="grid gap-12 py-16 sm:py-20 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className={eyebrow}>On this page</p>
              <nav className="mt-4 space-y-1" aria-label={`${title} sections`}>
                {sections.map((section, index) => (
                  <a
                    className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm text-[#171717]/70 transition-colors hover:bg-white hover:text-[#171717]"
                    href={`#legal-section-${index + 1}`}
                    key={section.title}
                  >
                    <span className="tabular-nums text-[13px] text-[#171717]/70">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
          <article>
            {sections.map((section, index) => (
              <section
                className={`${reveal} scroll-mt-24 border-b border-line py-8`}
                id={`legal-section-${index + 1}`}
                key={section.title}
              >
                <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-[#171717]">
                  {section.title}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p
                    className="mt-4 max-w-[68ch] text-[16px] leading-[1.75] text-[#171717]/70"
                    key={paragraph}
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-4 max-w-[68ch] space-y-2">
                    {section.bullets.map((bullet) => (
                      <li
                        className="flex gap-3 text-[16px] leading-[1.75] text-[#171717]/70"
                        key={bullet}
                      >
                        <span className="mt-[10px] size-1 shrink-0 rounded-full bg-primary" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
            <p className="mt-8 text-[15px] text-[#171717]/70">
              Questions about this page?{" "}
              <TextLink href={`mailto:${CONTACT_EMAIL}`}>Email {CONTACT_EMAIL}</TextLink>
            </p>
          </article>
        </Container>

        <PanelCta
          title="Questions about your records?"
          actions={
            <a className={btnOnPanel} href={`mailto:${CONTACT_EMAIL}`}>
              Email {CONTACT_EMAIL}
            </a>
          }
        />
      </main>
    </PublicPageShell>
  );
}
