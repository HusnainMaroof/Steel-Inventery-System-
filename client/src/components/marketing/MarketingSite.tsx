import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MarketingEntrance, MarketingReveal } from "@/components/marketing/MarketingMotion";
import { ProductTabs } from "@/components/marketing/ProductTabs";

const buttonBase = "inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 text-[15px] font-medium transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#0074dd]";
const cobaltButton = cn(buttonBase, "border border-transparent bg-[#0068f9] text-white hover:bg-[#024bb1]");
const outlineButton = cn(buttonBase, "border border-[#efefef] bg-white text-[#121722] hover:border-[#d6e4f1] hover:bg-[#fbfaf7]");

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#efefef] bg-white">
      <div className="mx-auto flex h-[72px] w-[min(calc(100%-48px),1200px)] items-center justify-between gap-5 max-sm:h-16 max-sm:w-[calc(100%-32px)] max-sm:gap-2">
        <Link href="/" className="shrink-0 text-[19px] font-semibold tracking-[-0.04em] text-[#121722] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0074dd] max-sm:text-base" aria-label="Tijaratt home">Tijaratt</Link>
        <nav className="flex items-center gap-7 max-md:gap-4 max-sm:gap-3" aria-label="Main navigation">
          <Link className="text-sm font-medium text-[#121722] transition-colors hover:text-[#0068f9] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0074dd] max-sm:text-[11px]" href="/#product">Product</Link>
          <Link className="text-sm font-medium text-[#121722] transition-colors hover:text-[#0068f9] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0074dd] max-sm:text-[11px]" href="/#pricing">Pricing</Link>
          <Link className="text-sm font-medium text-[#121722] transition-colors hover:text-[#0068f9] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0074dd] max-sm:text-[11px]" href="/#contact">Contact</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-3 max-md:gap-2 max-sm:gap-1.5">
          <Link className="text-sm font-medium text-[#121722] transition-colors hover:text-[#0068f9] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0074dd] max-md:hidden" href="/login">Log in</Link>
          <Link className={cn(outlineButton, "min-h-10 px-4 py-2 text-[13px] max-sm:hidden")} href="/pricing">Ask about pricing</Link>
          <Link className={cn(cobaltButton, "min-h-10 px-4 py-2 text-[13px] max-sm:px-3 max-sm:text-[11px]")} href="/login">Sign in</Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#efefef] bg-white">
      <div className="mx-auto flex min-h-[92px] w-[min(calc(100%-48px),1200px)] items-center gap-6 max-sm:w-[calc(100%-36px)] max-sm:flex-wrap max-sm:gap-4 max-sm:py-5">
        <Link href="/" className="text-[16px] font-semibold tracking-[-0.04em] text-[#121722]">Tijaratt</Link>
        <nav className="ml-auto flex items-center gap-6 max-sm:order-3 max-sm:ml-0 max-sm:w-full max-sm:justify-between max-sm:gap-3" aria-label="Legal and account links">
          <Link className="text-[13px] text-[#777c86] transition-colors hover:text-[#0068f9]" href="/pricing">Pricing</Link>
          <Link className="text-[13px] text-[#777c86] transition-colors hover:text-[#0068f9]" href="/privacy-policy">Privacy</Link>
          <Link className="text-[13px] text-[#777c86] transition-colors hover:text-[#0068f9]" href="/terms-and-conditions">Terms</Link>
          <Link className="text-[13px] text-[#777c86] transition-colors hover:text-[#0068f9]" href="/login">Sign in</Link>
        </nav>
        <span className="ml-2 text-[13px] text-[#a5a5a5] max-sm:ml-auto max-sm:text-[11px]">© {new Date().getFullYear()} Tijaratt</span>
      </div>
    </footer>
  );
}

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#faf9f7] font-sans text-[#121722] [font-feature-settings:'kern','ss01']">
      <a className="fixed left-3 top-3 z-[100] -translate-y-[160%] rounded-full bg-[#121722] px-4 py-3 text-white focus:translate-y-0 focus-visible:outline-3 focus-visible:outline-[#0074dd]" href="#main-content">Skip to content</a>
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}

export function HomeLandingPage() {
  return (
    <MarketingLayout>
      <main id="main-content" className="bg-[#faf9f7]">
        <MarketingEntrance className="bg-[linear-gradient(180deg,#faf9f7_0%,#faf9f7_55%,#f2f7fc_100%)] px-6 pb-[72px] pt-[76px] text-center max-sm:px-5 max-sm:pb-14 max-sm:pt-[58px]">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[#777c86]">BUSINESS RECORDS, MADE SIMPLE</p>
          <h1 className="mt-6 text-[clamp(48px,7vw,84px)] font-semibold leading-[1.06] tracking-[-0.065em] text-[#121722] max-sm:mt-5 max-sm:text-[clamp(43px,10vw,61px)]">
            Run your business<br />with <span className="text-[#0068f9]">clearer records.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[640px] text-[18px] leading-[1.56] text-[#121722] max-sm:mt-4 max-sm:text-base">
            Stock, sales, purchases, and payments in one place. Keep track of the day without juggling separate records.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a className={outlineButton} href="#product">See how it works</a>
            <Link className={cobaltButton} href="/pricing">Ask about pricing</Link>
          </div>
        </MarketingEntrance>

        <ProductTabs />

        <MarketingReveal>
          <section className="mx-auto grid w-[min(calc(100%-48px),1030px)] grid-cols-[.8fr_1fr] items-start gap-[70px] bg-[#fbfaf7] px-8 py-[84px] max-md:grid-cols-1 max-md:gap-7 max-sm:w-full max-sm:gap-6 max-sm:px-[22px] max-sm:py-[62px]" id="features">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-[#777c86]">ONE CONNECTED VIEW</p>
              <h2 className="mt-4 max-w-[440px] text-[clamp(32px,4vw,44px)] font-semibold leading-[1.12] tracking-[-0.06em] text-[#121722]">Records that work together.</h2>
              <p className="mt-4 max-w-[430px] text-base leading-[1.56] text-[#777c86]">One purchase changes your stock. One sale updates an invoice. One payment updates a balance.</p>
            </div>
            <div className="border-t border-[#efefef]">
              <div className="grid min-h-[54px] grid-cols-[.55fr_1fr] items-center gap-4 border-b border-[#efefef] text-[13px] font-medium text-[#777c86]"><span>Daily work</span><span>With Tijaratt</span></div>
              <div className="grid min-h-[58px] grid-cols-[.55fr_1fr] items-center gap-4 border-b border-[#efefef] py-3 text-[14px] leading-[1.5] text-[#121722]"><span className="font-medium">Stock</span><span>Updates as you record purchases and sales</span></div>
              <div className="grid min-h-[58px] grid-cols-[.55fr_1fr] items-center gap-4 border-b border-[#efefef] py-3 text-[14px] leading-[1.5] text-[#121722]"><span className="font-medium">Invoices</span><span>Paid and due amounts stay together</span></div>
              <div className="grid min-h-[58px] grid-cols-[.55fr_1fr] items-center gap-4 border-b border-[#efefef] py-3 text-[14px] leading-[1.5] text-[#121722]"><span className="font-medium">Payments</span><span>Linked to the right customer or supplier</span></div>
            </div>
          </section>
        </MarketingReveal>

        <MarketingReveal>
          <section className="mx-auto grid w-[min(calc(100%-48px),1030px)] grid-cols-[1fr_.78fr] items-center gap-20 py-24 max-md:gap-10 max-sm:w-[calc(100%-44px)] max-sm:grid-cols-1 max-sm:gap-7 max-sm:py-[66px]" id="pricing">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-[#777c86]">PRICING</p>
              <h2 className="mt-4 max-w-[480px] text-[clamp(32px,4vw,44px)] font-semibold leading-[1.12] tracking-[-0.06em]">A straightforward place to start.</h2>
              <p className="mt-4 max-w-[420px] text-base leading-[1.56] text-[#777c86]">Tell us what your business needs and we’ll walk you through the available plans.</p>
            </div>
            <div className="rounded-2xl border border-[#efefef] bg-white p-7 shadow-[rgba(0,0,0,.07)_0_1px_1px_0,rgba(0,0,0,.04)_0_-1px_1px_0_inset,rgba(0,0,0,.14)_0_0_0_.5px_inset] max-sm:p-6">
              <span className="text-[11px] font-semibold tracking-[0.12em] text-[#777c86]">TIJARATT FOR YOUR BUSINESS</span>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em]">Find the right plan</h3>
              <p className="mt-2 mb-5 text-[15px] leading-[1.56] text-[#777c86]">We’ll help you understand the available options for your business.</p>
              <Link className={outlineButton} href="/pricing">View pricing</Link>
            </div>
          </section>
        </MarketingReveal>

        <MarketingReveal>
          <section className="grid grid-cols-[.72fr_1fr] gap-[86px] bg-[#fbfaf7] px-[max(32px,calc((100vw-1030px)/2))] py-[83px] max-md:gap-10 max-sm:grid-cols-1 max-sm:gap-6 max-sm:px-[22px] max-sm:py-[66px]" id="faq">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-[#777c86]">FAQ</p>
              <h2 className="mt-4 text-[40px] font-semibold leading-tight tracking-[-0.06em]">Good to know.</h2>
              <p className="mt-3 max-w-[280px] text-[15px] leading-[1.56] text-[#777c86]">A few answers about using Tijaratt.</p>
            </div>
            <div className="border-t border-[#efefef]">
              <details className="group border-b border-[#efefef]"><summary className="relative min-h-14 cursor-pointer list-none py-4 pr-9 text-[15px] font-medium marker:hidden after:absolute after:right-1 after:top-3 after:text-xl after:font-normal after:text-[#777c86] after:content-['+'] group-open:after:rotate-45">What can I keep track of in Tijaratt?</summary><p className="max-w-[520px] pb-5 text-[14px] leading-[1.56] text-[#777c86]">Stock, purchases, sales, invoices, payments, customer and supplier balances, expenses, and reports.</p></details>
              <details className="group border-b border-[#efefef]"><summary className="relative min-h-14 cursor-pointer list-none py-4 pr-9 text-[15px] font-medium after:absolute after:right-1 after:top-3 after:text-xl after:font-normal after:text-[#777c86] after:content-['+'] group-open:after:rotate-45">Does a sale update my stock?</summary><p className="max-w-[520px] pb-5 text-[14px] leading-[1.56] text-[#777c86]">Yes. Sales and purchases update inventory, so stock follows the transactions you enter.</p></details>
              <details className="group border-b border-[#efefef]"><summary className="relative min-h-14 cursor-pointer list-none py-4 pr-9 text-[15px] font-medium after:absolute after:right-1 after:top-3 after:text-xl after:font-normal after:text-[#777c86] after:content-['+'] group-open:after:rotate-45">Can my staff use it too?</summary><p className="max-w-[520px] pb-5 text-[14px] leading-[1.56] text-[#777c86]">You can provide staff access and manage which parts of the business they can use.</p></details>
              <details className="group border-b border-[#efefef]"><summary className="relative min-h-14 cursor-pointer list-none py-4 pr-9 text-[15px] font-medium after:absolute after:right-1 after:top-3 after:text-xl after:font-normal after:text-[#777c86] after:content-['+'] group-open:after:rotate-45">How do I learn about pricing?</summary><p className="max-w-[520px] pb-5 text-[14px] leading-[1.56] text-[#777c86]">Visit the pricing page or contact us to ask about plans for your business.</p></details>
            </div>
          </section>
        </MarketingReveal>

        <MarketingReveal>
          <section className="bg-[linear-gradient(135deg,#faf9f7_0%,#f6f8fc_48%,#d6e4f1_83%,#0068f9_145%)] px-6 py-20 text-center max-sm:px-5 max-sm:py-[62px]" id="contact">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#777c86]">TIJARATT</p>
            <h2 className="mt-4 text-[clamp(38px,5vw,56px)] font-semibold leading-[1.08] tracking-[-0.06em]">Want to see how it works?</h2>
            <p className="mt-4 text-base leading-[1.56] text-[#121722]">Keep your stock, sales, and payments together in one clear view.</p>
            <div className="mt-6"><a className={cobaltButton} href="mailto:contact@tijaratt.com">Talk to us</a></div>
          </section>
        </MarketingReveal>
      </main>
    </MarketingLayout>
  );
}

export function PricingPage() {
  return (
    <MarketingLayout>
      <main id="main-content" className="min-h-[70vh] bg-[#faf9f7] px-8 py-20 max-sm:px-5 max-sm:py-16">
        <MarketingEntrance>
          <section className="mx-auto w-full max-w-[810px] text-center">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#777c86]">PRICING</p>
            <h1 className="mt-5 text-[clamp(42px,6vw,64px)] font-semibold leading-[1.06] tracking-[-0.065em]">A plan that fits<br />the way you work.</h1>
            <p className="mx-auto mt-5 max-w-[530px] text-base leading-[1.56] text-[#777c86]">Tell us what your business needs and we’ll help you find the right Tijaratt plan.</p>
          </section>
        </MarketingEntrance>
        <section className="mx-auto mt-16 grid w-full max-w-[890px] grid-cols-[1fr_.82fr] gap-12 rounded-2xl border border-[#efefef] bg-white p-12 shadow-[rgba(0,0,0,.07)_0_1px_1px_0,rgba(0,0,0,.04)_0_-1px_1px_0_inset,rgba(0,0,0,.14)_0_0_0_.5px_inset] max-sm:mt-10 max-sm:grid-cols-1 max-sm:gap-5 max-sm:p-6">
          <div><p className="text-[11px] font-semibold tracking-[0.14em] text-[#777c86]">TIJARATT PLANS</p><h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.05em]">Clear options for your business.</h2><p className="mt-4 mb-6 text-[15px] leading-[1.56] text-[#777c86]">Talk with our team about your business, the people who need access, and the tools you need day to day.</p><a className={cobaltButton} href="mailto:contact@tijaratt.com?subject=Tijaratt%20pricing%20enquiry">Ask about pricing</a></div>
          <ul className="self-center border-l border-[#efefef] pl-7 text-[15px] leading-[1.5] text-[#777c86] max-sm:border-l-0 max-sm:border-t max-sm:pl-0 max-sm:pt-4"><li className="py-3">Stock and purchase records</li><li className="py-3">Sales and customer invoices</li><li className="py-3">Customer and supplier balances</li><li className="py-3">Payments and business reports</li></ul>
        </section>
        <p className="mt-7 text-center text-[13px] text-[#777c86]">Already have an account? <Link className="font-medium text-[#0068f9] hover:underline" href="/login">Log in to Tijaratt</Link></p>
      </main>
    </MarketingLayout>
  );
}

type LegalSection = { title: string; paragraphs: string[]; bullets?: string[] };

export function LegalPage({ title, intro, sections, updated }: { title: string; intro: string; sections: LegalSection[]; updated: string }) {
  return (
    <MarketingLayout>
      <main id="main-content" className="min-h-[70vh] bg-[#faf9f7] px-8 py-20 max-sm:px-5 max-sm:py-14">
        <MarketingEntrance>
          <section className="mx-auto w-full max-w-[810px]">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#777c86]">TIJARATT · POLICIES</p>
            <h1 className="mt-5 text-[clamp(42px,5vw,60px)] font-semibold leading-[1.06] tracking-[-0.065em]">{title}</h1>
            <p className="mt-5 max-w-[640px] text-base leading-[1.56] text-[#777c86]">{intro}</p>
            <span className="mt-4 inline-block text-[13px] text-[#a5a5a5]">Last updated: {updated}</span>
          </section>
        </MarketingEntrance>
        <article className="mx-auto mt-12 w-full max-w-[810px] border-t border-[#efefef] pt-2">
          {sections.map((section) => (
            <section className="border-b border-[#efefef] py-6" key={section.title}>
              <h2 className="mb-3 text-xl font-semibold tracking-[-0.02em]">{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p className="mt-2 text-[15px] leading-[1.65] text-[#777c86]" key={paragraph}>{paragraph}</p>)}
              {section.bullets ? <ul className="mt-3 list-disc pl-5 text-[15px] leading-[1.65] text-[#777c86]">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
            </section>
          ))}
          <p className="mt-6 text-[15px] text-[#777c86]">Questions about this page? <a className="font-medium text-[#0068f9] hover:underline" href="mailto:contact@tijaratt.com">Contact us at contact@tijaratt.com</a>.</p>
        </article>
      </main>
    </MarketingLayout>
  );
}
