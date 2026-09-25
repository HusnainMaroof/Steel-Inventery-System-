"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";

const views = {
  Overview: {
    title: "Business overview",
    description: "A simple view of the numbers that matter today.",
    metrics: [["Sales this month", "Rs 248,500"], ["Payments received", "Rs 192,000"], ["Items in stock", "126"]],
    activityTitle: "Recent activity",
    rows: [["Invoice #1048", "Sale recorded", "Rs 18,500"], ["Cement · 24 bags", "Stock received", "Today"]],
  },
  Stock: {
    title: "Stock on hand",
    description: "Purchases and sales keep inventory up to date.",
    metrics: [["Items in stock", "126"], ["Low stock items", "8"], ["Stock value", "Rs 486,200"]],
    activityTitle: "Stock activity",
    rows: [["Portland cement", "Received · 24 bags", "Today"], ["Steel bar · 12 mm", "Sold · 8 lengths", "Today"]],
  },
  Sales: {
    title: "Sales and invoices",
    description: "See invoices, payments, and outstanding amounts together.",
    metrics: [["Sales this month", "Rs 248,500"], ["Invoices", "38"], ["Amount due", "Rs 56,500"]],
    activityTitle: "Recent invoices",
    rows: [["Invoice #1048", "Paid · A. Traders", "Rs 18,500"], ["Invoice #1047", "Due · City Stores", "Rs 12,000"]],
  },
  Payments: {
    title: "Payments in and out",
    description: "Keep each payment linked to the right customer, supplier, or bill.",
    metrics: [["Received", "Rs 192,000"], ["Paid", "Rs 84,300"], ["Open balances", "14"]],
    activityTitle: "Recent payments",
    rows: [["A. Traders", "Payment received", "Rs 18,500"], ["North Supply Co.", "Supplier payment", "Rs 24,000"]],
  },
  Reports: {
    title: "Reports at a glance",
    description: "Review business activity using the records you already keep.",
    metrics: [["Sales this month", "Rs 248,500"], ["Purchase total", "Rs 173,200"], ["Expenses", "Rs 31,400"]],
    activityTitle: "Period summary",
    rows: [["This month", "Sales recorded", "Rs 248,500"], ["This month", "Payments collected", "Rs 192,000"]],
  },
} as const;

type ViewName = keyof typeof views;
const tabs = Object.keys(views) as ViewName[];
const panelMotion = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -3 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

export function ProductTabs() {
  const [activeTab, setActiveTab] = useState<ViewName>("Overview");
  const reduceMotion = useReducedMotion();
  const view = views[activeTab];

  const selectTab = (tab: ViewName) => {
    setActiveTab(tab);
    document.getElementById(`product-tab-${tab.toLowerCase()}`)?.focus();
  };

  return (
    <section className="relative z-10 mx-auto -mt-[30px] w-[min(calc(100%-48px),1200px)] pb-14 max-sm:-mt-5 max-sm:w-[calc(100%-32px)] max-sm:pb-10" id="product" aria-labelledby="product-heading">
      <div className="mb-6 text-center max-sm:mb-4">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#777c86]">ONE PLACE FOR DAILY RECORDS</p>
        <h2 id="product-heading" className="mt-3 text-[clamp(30px,4vw,40px)] font-semibold leading-[1.15] tracking-[-0.055em] text-[#121722]">See your business clearly.</h2>
        <p className="mt-2.5 text-[15px] leading-[1.55] text-[#777c86] max-sm:text-sm">Choose a view to see how Tijaratt keeps the day-to-day connected.</p>
      </div>

      <div className="mx-auto mb-4 flex w-max max-w-full items-center justify-center gap-1 overflow-x-auto rounded-full p-1 max-sm:mb-3 max-sm:w-full max-sm:justify-start max-sm:rounded-none max-sm:px-0" role="tablist" aria-label="Tijaratt product views">
        {tabs.map((tab) => (
          <button
            key={tab}
            id={`product-tab-${tab.toLowerCase()}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls="product-tab-panel"
            tabIndex={activeTab === tab ? 0 : -1}
            className={cn(
              "min-h-11 shrink-0 rounded-full border-0 px-4 py-2 text-sm font-medium text-[#121722] transition-colors duration-200 hover:text-[#0068f9] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0074dd] motion-reduce:transition-none max-sm:px-3 max-sm:text-[13px]",
              activeTab === tab && "bg-[#fbfaf7]",
            )}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const direction = event.key === "ArrowRight" ? 1 : -1;
              const next = (tabs.indexOf(activeTab) + direction + tabs.length) % tabs.length;
              selectTab(tabs[next]);
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-[rgba(0,0,0,.07)_0_1px_1px_0,rgba(0,0,0,.04)_0_-1px_1px_0_inset,rgba(0,0,0,.14)_0_0_0_.5px_inset,rgba(0,0,0,.04)_0_20px_20px_-8px] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#0074dd]" id="product-tab-panel" role="tabpanel" aria-labelledby={`product-tab-${activeTab.toLowerCase()}`} tabIndex={0}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={reduceMotion ? false : panelMotion.initial}
            animate={panelMotion.animate}
            exit={reduceMotion ? undefined : panelMotion.exit}
            transition={reduceMotion ? { duration: 0 } : panelMotion.transition}
          >
            <div className="flex h-[49px] items-center justify-between border-b border-[#efefef] px-6 text-[13px] font-semibold text-[#121722] max-sm:px-4">
              <span>Tijaratt</span>
              <span className="text-[10px] font-medium tracking-[0.08em] text-[#a5a5a5]">SAMPLE BUSINESS</span>
            </div>
            <div className="p-7 max-sm:px-4 max-sm:py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-semibold tracking-[0.077em] text-[#777c86]">{activeTab.toUpperCase()}</span>
                  <h3 className="mt-2 text-[21px] font-semibold tracking-[-0.03em] text-[#121722] max-sm:text-lg">{view.title}</h3>
                  <p className="mt-1 text-[13px] text-[#777c86] max-sm:max-w-[250px] max-sm:text-[11px]">{view.description}</p>
                </div>
                <span className="shrink-0 rounded-full border border-[#efefef] px-3 py-2 text-xs text-[#121722] max-sm:px-2 max-sm:text-[10px]">This month</span>
              </div>
              <div className="mt-6 grid grid-cols-3 rounded-xl border border-[#efefef] max-sm:mt-4">
                {view.metrics.map(([label, value], index) => (
                  <div key={label} className={cn("min-w-0 p-4 max-sm:px-2 max-sm:py-2.5", index > 0 && "border-l border-[#efefef]")}>
                    <span className="block text-xs text-[#777c86] max-sm:text-[9px]">{label}</span>
                    <strong className="mt-2 block overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(15px,2vw,23px)] font-semibold tracking-[-0.035em] text-[#121722] max-sm:text-[clamp(12px,3.2vw,16px)]">{value}</strong>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-[1.05fr_.95fr] gap-6 max-sm:grid-cols-1 max-sm:gap-5">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#121722]"><span>Business activity</span><span className="text-[11px] font-normal text-[#777c86]">Last 7 days</span></div>
                  <div className="relative mt-3 h-[130px] max-sm:h-[105px]" aria-hidden="true">
                    <div className="absolute inset-0 flex flex-col justify-between"><i className="border-t border-[#efefef]" /><i className="border-t border-[#efefef]" /><i className="border-t border-[#efefef]" /></div>
                    <svg className="relative h-full w-full overflow-visible" viewBox="0 0 460 116" preserveAspectRatio="none">
                      <path className="fill-none stroke-[#0068f9] stroke-2" vectorEffect="non-scaling-stroke" d="M0 91 C36 86 38 65 76 72 S125 89 153 58 S205 66 229 45 S275 62 306 36 S353 55 381 28 S425 35 460 9" />
                      <path className="fill-[#0068f9] opacity-[0.08]" d="M0 91 C36 86 38 65 76 72 S125 89 153 58 S205 66 229 45 S275 62 306 36 S353 55 381 28 S425 35 460 9 V116 H0 Z" />
                    </svg>
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-[#a5a5a5]"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#121722]"><span>{view.activityTitle}</span><span className="text-[11px] font-normal text-[#777c86]">Sample records</span></div>
                  {view.rows.map(([name, detail, amount]) => (
                    <div className="flex items-center justify-between gap-3 border-b border-[#efefef] py-3.5" key={name}>
                      <span className="min-w-0"><b className="block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-[#121722]">{name}</b><small className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[#777c86]">{detail}</small></span>
                      <strong className="shrink-0 text-xs font-medium text-[#121722]">{amount}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-center text-[11px] text-[#a5a5a5]">Sample business data shown for illustration.</p>
    </section>
  );
}
