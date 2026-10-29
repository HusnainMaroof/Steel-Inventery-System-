import type { Metadata } from "next";
import { PublicPageShell } from "@/components/marketing/PublicChrome";
import { CONTACT_EMAIL, publicPageMetadata } from "@/lib/site";
import {
  btnOnPanel,
  eyebrow,
  Container,
  PanelHero,
  SectionHeader,
  PanelCta,
  RowList,
} from "@/components/marketing/PublicKit";

export const metadata: Metadata = publicPageMetadata({
  path: "/contact",
  title: "Contact",
  description:
    "Contact the Tijartt team about a new account, plan pricing, support or your data. We set up your business account and owner login for you.",
});

const include = [
  "Your business name.",
  "What you sell.",
  "How many staff logins you need.",
  "The plan you want, or say you are not sure.",
];

const topics = [
  ["New account", "Get a business account."],
  ["Pricing", "Price and modules."],
  ["Support", "Help with a page or a figure."],
  ["Your data", "Access, correction, export or deletion."],
];

const emailHref = `mailto:${CONTACT_EMAIL}?subject=Tijartt%20enquiry`;

export default function Page() {
  return (
    <PublicPageShell>
      <main id="main-content">
        <PanelHero
          eyebrow="Contact"
          title="Talk to us."
          actions={<a className={btnOnPanel} href={emailHref}>Email {CONTACT_EMAIL}</a>}
        />

        <section className="py-16 sm:py-20">
          <Container className="grid gap-6">
            <div>
              <SectionHeader title="Write to us" />
            </div>
            <div>
              <a
                href={emailHref}
                className="text-[clamp(26px,3.4vw,44px)] font-semibold tracking-[-0.03em] text-[#171717] underline decoration-[#171717]/25 underline-offset-[6px] transition-colors hover:decoration-[#171717]"
              >
                {CONTACT_EMAIL}
              </a>
              <p className={`${eyebrow} mt-10 mb-3`}>What to include</p>
              <RowList
                numbered
                rows={include.map((title) => ({ title }))}
              />
            </div>
          </Container>
        </section>

        <section className="py-16 sm:py-20">
          <Container className="grid gap-6">
            <div>
              <SectionHeader title="Topics" />
            </div>
            <div>
              <RowList
                rows={topics.map(([title, text]) => ({
                  title,
                  text,
                  href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Tijartt: ${title}`)}`,
                  action: "Email",
                }))}
              />
            </div>
          </Container>
        </section>

        <PanelCta
          title="Get started."
          actions={<a className={btnOnPanel} href={emailHref}>Email {CONTACT_EMAIL}</a>}
        />
      </main>
    </PublicPageShell>
  );
}