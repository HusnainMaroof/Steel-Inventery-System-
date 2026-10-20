import {
  BarChart3,
  Boxes,
  Receipt,
  ShoppingCart,
  UserCog,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const items = [
  {
    Icon: ShoppingCart,
    title: "Purchases with landed cost",
    text: "Record what you buy from each mill or supplier. Transport, loading and labour are added to the cost of every bag or kg.",
  },
  {
    Icon: Boxes,
    title: "Stock that matches the yard",
    text: "Every purchase adds stock and every sale removes it, so the stock you see is always the sum of real records.",
  },
  {
    Icon: Receipt,
    title: "Sales and printed bills",
    text: "Sell from what is in stock and print a numbered bill with your logo, one at a time or many at once.",
  },
  {
    Icon: Wallet,
    title: "Customer dues and supplier payments",
    text: "See who owes you and what you owe each mill. A payment can never be more than what is due.",
  },
  {
    Icon: BarChart3,
    title: "Profit and reports",
    text: "Profit, stock, cash and dues reports come from the same records, for any period or product. Export to Excel or PDF.",
  },
  {
    Icon: UserCog,
    title: "Staff with limited access",
    text: "Give each staff member their own login and choose exactly which pages they can open.",
  },
] as const;

export function FeatureHighlights() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mt-32 max-[640px]:mt-20"
    >
      <div className="mx-auto max-w-[1180px] px-10 max-[1024px]:px-6 max-[640px]:px-4">
        <h2
          id="features-heading"
          className="text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.03em] text-[#111] text-center"
        >
          One ledger for buying, selling and getting paid
        </h2>
        <p className="mt-4 text-center text-[17px] text-[#171717]/70 max-w-[680px] mx-auto">
          Made for steel, cement, wire, paint and tiles traders, and any
          business that buys and sells stock.
        </p>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const Icon: LucideIcon = item.Icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-[#E5E5E5] bg-white p-6"
              >
                <div className="size-10 rounded-lg bg-[#F8F8F7] grid place-items-center">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-[#171717] mt-4">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#171717]/70 mt-2">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
