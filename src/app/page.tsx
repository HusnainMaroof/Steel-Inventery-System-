"use client";

import Link from "next/link";

/* what the product does — one plain line each, straight from the app */
const FEATURES = [
  {
    title: "Stock & Inventory",
    desc: "What is in stock right now, at landed cost. A purchase adds it, a sale removes it — no manual tallies.",
  },
  {
    title: "Purchases",
    desc: "Record every lot you buy — quantity, rate, transport and other costs — so the true cost of each unit is known.",
  },
  {
    title: "Sales & Invoices",
    desc: "Bill customers, print an invoice with every sale, and track what is paid and what is still due on each bill.",
  },
  {
    title: "Customers & Suppliers",
    desc: "Who owes you and who you owe — a balance per customer and per supplier, never one blurred total.",
  },
  {
    title: "Payments",
    desc: "Cash, bank or cheque. Money in and money out is recorded against the right bill, so dues stay honest.",
  },
  {
    title: "Reports & Profit",
    desc: "Monthly and yearly profit — counted from money actually collected, after the running costs of the shop.",
  },
];

const SECTION = "px-5 sm:px-8 lg:px-14";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f8f8f7] text-[#171717]">
      {/* ================= navbar ================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#e5e5e5]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 sm:px-8 lg:px-14 py-3">
          <Link href="/" className="leading-tight">
            <span className="text-lg font-semibold tracking-tight">Tradex</span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-500 mt-0.5">
              Business Ledger
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-1.5">
            <a
              href="#about"
              className="px-3 py-2 text-[13px] font-medium text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-md transition-colors"
            >
              About
            </a>
            <a
              href="#contact"
              className="px-3 py-2 text-[13px] font-medium text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-md transition-colors"
            >
              Contact us
            </a>
            <Link
              href="/login"
              className="ml-2 bg-[#171717] text-white text-[13px] font-medium px-4 py-2 rounded-md hover:bg-neutral-800 active:scale-[0.98] transition"
            >
              Login
            </Link>
          </nav>
        </div>
      </header>

      {/* ================= intro ================= */}
      <section className="bg-white border-b border-[#e5e5e5]">
        <div className={`${SECTION} py-16 sm:py-24 lg:py-28`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Tradex — one ledger for your shop, depot or factory
          </p>
          <h1 className="mt-6 text-[38px] sm:text-[52px] lg:text-[60px] font-bold tracking-tight leading-[1.05] max-w-4xl">
            Stock, sales, payments and profit — kept together, so the numbers
            always match.
          </h1>
          <p className="mt-7 text-[17px] leading-relaxed text-neutral-500 max-w-2xl">
            Record each purchase and sale once. Tradex keeps the stock, the
            invoices, the dues and the profit from that single entry, and every
            screen shows the same figures.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3.5">
            <Link
              href="/login"
              className="inline-flex items-center gap-2.5 bg-[#171717] text-white text-sm font-medium pl-6 pr-5 py-3.5 rounded-md hover:bg-neutral-800 active:scale-[0.98] transition"
            >
              Login
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
              </svg>
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 border border-[#e5e5e5] text-sm font-medium px-6 py-3.5 rounded-md bg-white hover:border-[#171717] hover:bg-[#fafafa] transition"
            >
              What it does
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ================= what it does ================= */}
      <section id="features" className={`${SECTION} py-16 sm:py-24 scroll-mt-20`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          What Tradex does
        </p>
        <h2 className="mt-5 text-[28px] sm:text-[36px] font-bold tracking-tight leading-tight max-w-3xl">
          The day-to-day records of a trading business, in six screens.
        </h2>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="bg-white border border-[#e5e5e5] rounded-lg p-6 sm:p-7 flex flex-col hover:border-neutral-400 transition-colors"
            >
              <h3 className="text-[15px] font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-neutral-600">
                {f.desc}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ================= about ================= */}
      <section id="about" className={`${SECTION} py-16 sm:py-24 scroll-mt-20`}>
        <div className="grid lg:grid-cols-12 gap-x-10 gap-y-6">
          <div className="lg:col-span-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              About
            </p>
            <h2 className="mt-5 text-[26px] sm:text-[32px] font-bold tracking-tight leading-tight">
              Where Tradex comes from
            </h2>
          </div>
          <div className="lg:col-span-8 max-w-3xl space-y-5 text-[15px] leading-relaxed text-neutral-600">
            <p>
              Tradex started as the bookkeeping system of a steel and cement
              depot. The owner wanted every purchase, sale and payment written
              down once, with stock and profit following automatically — no
              separate registers that could fall out of step.
            </p>
            <p>
              Today it is the same ledger, opened up so any shop, depot or
              factory owner can run their business on it.
            </p>
          </div>
        </div>
      </section>

      {/* ================= contact ================= */}
      <section
        id="contact"
        className={`${SECTION} py-16 sm:py-24 bg-white border-t border-[#e5e5e5] scroll-mt-20`}
      >
        <div className="grid lg:grid-cols-12 gap-x-10 gap-y-6">
          <div className="lg:col-span-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Contact us
            </p>
            <h2 className="mt-5 text-[26px] sm:text-[32px] font-bold tracking-tight leading-tight">
              Questions, or want a login for your business?
            </h2>
          </div>
          <div className="lg:col-span-8 max-w-3xl">
            <p className="text-[15px] leading-relaxed text-neutral-600">
              Questions about Tradex or getting access for your business? Reach
              out and we will reply.
            </p>
            <p className="mt-6 text-[15px] font-medium text-neutral-800">
              contact@tradex.example&nbsp;·&nbsp;(0300) 000-0000
            </p>
          </div>
        </div>
      </section>

      {/* ================= footer ================= */}
      <footer className="px-5 sm:px-8 lg:px-14 py-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e5e5]">
        <p className="text-xs text-neutral-400">
          © {new Date().getFullYear()} Tradex — Business Ledger
        </p>
        <p className="text-xs text-neutral-400">
          <Link
            href="/login"
            className="font-medium text-neutral-600 hover:text-black transition-colors"
          >
            Login
          </Link>
        </p>
      </footer>
    </div>
  );
}
