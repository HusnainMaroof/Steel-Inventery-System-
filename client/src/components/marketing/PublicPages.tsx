import Link from "next/link";
import { PublicPageShell } from "@/components/marketing/PublicChrome";

const outlineButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#0f46d8] bg-[#0f46d8] px-7 py-3 text-[14px] font-medium text-white transition-[background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#0a36aa] hover:shadow-[0_10px_28px_-16px_rgba(15,70,216,.7)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#0099ff] motion-reduce:transform-none motion-reduce:transition-none";

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

export function PricingPage() {
  return (
    <PublicPageShell>
      <main id="main-content">
        <section className="bg-[#f3f5f9] px-5 py-20 text-center sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[820px]">
            <h1 className="text-[clamp(48px,7vw,72px)] font-semibold leading-[1.03] tracking-[-0.037em] text-[#020520]">
              Choose a plan that fits
              <br />
              <span className="text-[#0f46d8]">how you use Tijaratt.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[590px] text-[17px] leading-[1.63] text-[#374151]">
              Monthly, yearly, and lifetime access are available. Contact us
              for the current price and the modules included for your business.
            </p>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1040px]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[clamp(34px,4vw,46px)] font-semibold leading-[1.05] tracking-[-0.037em] text-[#020520]">
                  Available plans
                </h2>
                <p className="mt-3 max-w-[560px] text-[15px] leading-[1.6] text-[#374151]">
                  Choose the billing period that suits your business. Prices
                  are confirmed before your account is activated.
                </p>
              </div>
              <a
                className={`${outlineButton} shrink-0`}
                href="mailto:contact@tijaratt.com?subject=Tijaratt%20pricing%20enquiry"
              >
                Ask about pricing
              </a>
            </div>

            <div className="mt-10 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white">
              <div className="hidden grid-cols-[1fr_.8fr_1.2fr_auto] gap-6 border-b border-[#e2e8f0] bg-[#fcfcfc] px-6 py-3 text-[11px] font-medium text-[#6b7280] sm:grid">
                <span>Plan</span>
                <span>Billing</span>
                <span>Price</span>
                <span className="w-28">Next step</span>
              </div>
              {[
                ["Monthly", "Every month", "Contact for current price"],
                ["Yearly", "Every year", "Contact for current price"],
                ["Lifetime access", "No expiry date", "Contact for current price"],
              ].map(([name, billing, price]) => (
                <div className="grid gap-3 border-b border-[#e2e8f0] px-5 py-5 last:border-0 sm:grid-cols-[1fr_.8fr_1.2fr_auto] sm:items-center sm:gap-6 sm:px-6" key={name}>
                  <div>
                    <span className="text-[15px] font-semibold text-[#020520]">{name}</span>
                    <span className="mt-1 block text-[11px] text-[#6b7280] sm:hidden">{billing}</span>
                  </div>
                  <span className="hidden text-[13px] text-[#374151] sm:block">{billing}</span>
                  <span className="text-[13px] text-[#374151]">{price}</span>
                  <a
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#e2e8f0] px-4 text-[12px] font-medium text-[#0f46d8] transition-colors hover:border-[#0f46d8] sm:w-28"
                    href={`mailto:contact@tijaratt.com?subject=${encodeURIComponent(`Tijaratt ${name} plan`)}`}
                  >
                    Contact us
                  </a>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12px] leading-[1.6] text-[#6b7280]">
              Custom-duration plans can also be configured when required.
              Module access is set for each plan by Tijaratt administration.
            </p>
          </div>
        </section>

        <section className="border-y border-[#e2e8f0] bg-white px-5 py-20 sm:px-6">
          <div className="mx-auto grid max-w-[1040px] gap-10 lg:grid-cols-[.65fr_1.35fr] lg:gap-16">
            <div>
              <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.037em] text-[#020520]">
                One system, with access matched to your plan.
              </h2>
              <p className="mt-4 text-[14px] leading-[1.65] text-[#374151]">
                Tijaratt plans can include the business areas below. We will
                confirm exactly what your selected plan includes.
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-[#e2e8f0] sm:grid-cols-3">
              {included.map((label) => (
                <span className="border-b border-[#e2e8f0] py-3 pr-3 text-[13px] text-[#374151]" key={label}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 text-center sm:px-6 sm:py-24">
          <h2 className="text-[clamp(38px,5vw,56px)] font-semibold leading-[1.05] tracking-[-0.037em] text-[#020520]">
            Ready to choose your plan?
          </h2>
          <p className="mx-auto mt-4 max-w-[470px] text-[15px] leading-[1.63] text-[#374151]">
            Tell us which billing period and business areas you need.
          </p>
          <a
            className={`${outlineButton} mt-7`}
            href="mailto:contact@tijaratt.com?subject=Tijaratt%20pricing%20enquiry"
          >
            Contact Tijaratt
          </a>
          <p className="mt-5 text-[12px] text-[#6b7280]">
            Already have an account?{" "}
            <Link className="font-medium text-[#0f46d8] hover:underline" href="/login">Log in</Link>
          </p>
        </section>
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
        <section className="border-b border-[#e2e8f0] bg-[#f3f5f9] px-5 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-[1000px]">
            <p className="font-mono text-[12px] font-medium tracking-[-0.03em] text-[#0f46d8]">
              TIJARATT / POLICIES
            </p>
            <h1 className="mt-5 text-[clamp(44px,6vw,64px)] font-semibold leading-[1.03] tracking-[-0.037em] text-[#020520]">
              {title}
            </h1>
            <p className="mt-5 max-w-[680px] text-[16px] leading-[1.63] text-[#374151]">
              {intro}
            </p>
            <span className="mt-5 inline-flex rounded-full border border-[#0f46d8]/15 bg-white/70 px-3 py-1.5 font-mono text-[10px] text-[#6b7280]">
              LAST UPDATED / {updated.toUpperCase()}
            </span>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1000px] gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-28 rounded-2xl border border-[#e2e8f0] bg-white p-4">
              <p className="px-2 font-mono text-[10px] font-medium tracking-[-0.03em] text-[#6b7280]">
                ON THIS PAGE
              </p>
              <nav className="mt-3 space-y-1" aria-label={`${title} sections`}>
                {sections.map((section, index) => (
                  <a
                    className="flex items-center gap-2 rounded-xl px-2 py-2 text-[12px] leading-[1.4] text-[#374151] hover:bg-[#f3f5f9] hover:text-[#0f46d8]"
                    href={`#legal-section-${index + 1}`}
                    key={section.title}
                  >
                    <span className="font-mono text-[9px] text-[#6b7280]">
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
                className="scroll-mt-28 border-b border-[#e2e8f0] py-8 first:pt-0"
                id={`legal-section-${index + 1}`}
                key={section.title}
              >
                <div className="flex items-start gap-4">
                  <span className="mt-1 font-mono text-[11px] text-[#0f46d8]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className="text-[24px] font-semibold tracking-[-0.027em] text-[#020520]">
                      {section.title}
                    </h2>
                    {section.paragraphs.map((paragraph) => (
                      <p className="mt-4 text-[15px] leading-[1.75] text-[#374151]" key={paragraph}>
                        {paragraph}
                      </p>
                    ))}
                    {section.bullets ? (
                      <ul className="mt-4 space-y-2">
                        {section.bullets.map((bullet) => (
                          <li className="flex gap-3 text-[15px] leading-[1.7] text-[#374151]" key={bullet}>
                            <span className="mt-[10px] size-1 shrink-0 rounded-full bg-[#0f46d8]" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </section>
            ))}
            <div className="mt-8 rounded-2xl border border-[#e2e8f0] bg-[#f3f5f9] p-5">
              <p className="text-[14px] text-[#374151]">
                Questions about this page?{" "}
                <a className="font-medium text-[#0f46d8] hover:underline" href="mailto:contact@tijaratt.com">
                  Contact us at contact@tijaratt.com
                </a>
                .
              </p>
            </div>
          </article>
        </div>
      </main>
    </PublicPageShell>
  );
}
